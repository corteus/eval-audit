import path from 'node:path';
import { VERDICTS } from './constants.js';

const GENERIC_PROMPT_NAMES = new Set(['prompt', 'PROMPT', 'instructions', 'INSTRUCTIONS', 'template']);
const GENERIC_PATH_SEGMENTS = new Set([
  'app',
  'src',
  'lib',
  'server',
  'services',
  'prompts',
  'prompt',
  'evals',
  'eval',
  'tests',
  'test',
  '__tests__'
]);

export function mapCoverage(discovery, ci) {
  const callSites = cloneTargets(discovery.callSites);
  const prompts = cloneTargets(discovery.prompts);
  const candidates = [...discovery.explicitEvalFiles, ...discovery.testFiles];
  const includedEvalIds = new Set(discovery.explicitEvalFiles.map((candidate) => candidate.id));

  for (const callSite of callSites) {
    callSite.coverage = coverageForTarget(callSite, candidates, 'call-site');
    callSite.covered = callSite.coverage.length > 0;
    if (callSite.covered) {
      for (const reason of callSite.coverage) includedEvalIds.add(reason.evalId);
    }
  }

  for (const prompt of prompts) {
    prompt.coverage = coverageForTarget(prompt, candidates, 'prompt');
    prompt.covered = prompt.coverage.length > 0;
    if (prompt.covered) {
      for (const reason of prompt.coverage) includedEvalIds.add(reason.evalId);
    }
  }

  const evals = candidates
    .filter((candidate) => includedEvalIds.has(candidate.id))
    .map(publicEval)
    .sort((a, b) => a.file.localeCompare(b.file));

  const coveredCallSites = callSites.filter((callSite) => callSite.covered).length;
  const totalCallSites = callSites.length;
  const percentage = totalCallSites === 0 ? null : roundPercentage((coveredCallSites / totalCallSites) * 100);
  const verdict = verdictFor({ totalCallSites, evalsFound: evals.length, percentage, ciGated: ci.gated });

  return {
    callSites,
    prompts,
    evals,
    verdict,
    coverage: {
      coveredCallSites,
      totalCallSites,
      percentage
    }
  };
}

function coverageForTarget(target, candidates, targetType) {
  const reasons = [];
  const seen = new Set();

  for (const candidate of candidates) {
    let method = null;

    if (candidate.imports.includes(target.file)) {
      method = 'module-import';
    } else if (targetType === 'prompt' && referencesPrompt(candidate.text, target)) {
      method = 'prompt-reference';
    } else if (isProximate(target.file, candidate.file)) {
      method = 'path-proximity';
    }

    if (!method) continue;

    const key = `${candidate.id}:${method}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reasons.push({
      evalId: candidate.id,
      evalFile: candidate.file,
      method
    });
  }

  return reasons.sort((a, b) => a.evalFile.localeCompare(b.evalFile) || a.method.localeCompare(b.method));
}

function referencesPrompt(text, prompt) {
  const lowerText = text.toLowerCase();
  const lowerFile = prompt.file.toLowerCase();
  const basename = path.posix.basename(lowerFile);
  const stem = basename.replace(/\.[^.]+$/, '');

  if (lowerText.includes(lowerFile)) return true;
  if (stem.length > 3 && lowerText.includes(stem)) return true;

  if (!GENERIC_PROMPT_NAMES.has(prompt.name)) {
    const pattern = new RegExp(`\\b${escapeRegex(prompt.name)}\\b`, 'i');
    return pattern.test(text);
  }

  return false;
}

function isProximate(targetFile, evalFile) {
  if (!looksEvalLike(evalFile)) return false;

  const targetDir = path.posix.dirname(targetFile);
  const evalDir = path.posix.dirname(evalFile);
  const targetStem = path.posix.basename(targetFile).replace(/\.[^.]+$/, '').toLowerCase();
  const evalStem = path.posix.basename(evalFile).replace(/\.[^.]+$/, '').toLowerCase();

  if (targetStem.length > 3 && evalStem.includes(targetStem)) {
    if (targetDir === evalDir) return true;
    if (evalDir.startsWith(`${targetDir}/`)) return true;
    if (targetDir.startsWith(`${evalDir}/`)) return true;
  }

  const targetFeature = nearestMeaningfulSegment(targetFile);
  const evalFeature = nearestMeaningfulSegment(evalFile);
  return Boolean(targetFeature && targetFeature === evalFeature && sharesAncestor(targetFile, evalFile));
}

function looksEvalLike(filePath) {
  const lower = filePath.toLowerCase();
  return /(?:^|\/)(?:evals?|evaluations?|tests?|__tests__)(?:\/|$)/.test(lower) || /\.(?:eval|test|spec)\./i.test(lower);
}

function nearestMeaningfulSegment(filePath) {
  const segments = path.posix.dirname(filePath).toLowerCase().split('/').filter(Boolean).reverse();
  return segments.find((segment) => !GENERIC_PATH_SEGMENTS.has(segment) && segment.length > 2) ?? null;
}

function sharesAncestor(a, b) {
  const aSegments = path.posix.dirname(a).split('/');
  const bSegments = path.posix.dirname(b).split('/');
  return aSegments.some((segment) => segment.length > 2 && bSegments.includes(segment));
}

function verdictFor({ totalCallSites, evalsFound, percentage, ciGated }) {
  if (totalCallSites === 0) return null;
  if (evalsFound === 0) return VERDICTS.noEvals;
  if (percentage < 25) return VERDICTS.smoke;
  if (percentage <= 75) return VERDICTS.partial;
  if (ciGated) return VERDICTS.gated;
  return VERDICTS.well;
}

function publicEval(candidate) {
  return {
    id: candidate.id,
    file: candidate.file,
    line: candidate.line,
    type: candidate.type,
    imports: candidate.imports
  };
}

function cloneTargets(targets) {
  return targets.map((target) => ({
    ...target,
    coverage: [...target.coverage]
  }));
}

function roundPercentage(value) {
  return Math.round(value * 10) / 10;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
