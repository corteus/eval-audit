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
  // Eval evidence: explicit eval files (eval dirs and names, promptfoo, eval frameworks, golden datasets).
  // Unit tests that merely import an LLM module are reported separately: they usually mock the model,
  // so they are evidence of testing, not of evaluating model output.
  const evalCandidates = discovery.explicitEvalFiles.map(withLowerText);
  const testCandidates = discovery.testFiles.map(withLowerText);
  const touchingTestIds = new Set();

  for (const [targets, targetType] of [
    [callSites, 'call-site'],
    [prompts, 'prompt']
  ]) {
    for (const target of targets) {
      target.coverage = coverageForTarget(target, evalCandidates, targetType);
      target.covered = target.coverage.length > 0;
      target.unitTestCoverage = coverageForTarget(target, testCandidates, targetType);
      target.coveredIncludingUnitTests = target.covered || target.unitTestCoverage.length > 0;
      for (const reason of target.unitTestCoverage) touchingTestIds.add(reason.evalId);
    }
  }

  const evals = evalCandidates.map(publicEval).sort((a, b) => a.file.localeCompare(b.file));
  const unitTests = testCandidates
    .filter((candidate) => touchingTestIds.has(candidate.id))
    .map(publicEval)
    .sort((a, b) => a.file.localeCompare(b.file));

  const totalCallSites = callSites.length;
  const coveredCallSites = callSites.filter((callSite) => callSite.covered).length;
  const coveredIncludingUnitTests = callSites.filter((callSite) => callSite.coveredIncludingUnitTests).length;
  const percentage = percentOf(coveredCallSites, totalCallSites);
  const percentageIncludingUnitTests = percentOf(coveredIncludingUnitTests, totalCallSites);
  const verdict = verdictFor({ totalCallSites, evalsFound: evals.length, percentage, ciGated: ci.gated });
  const verdictIncludingUnitTests = verdictFor({
    totalCallSites,
    evalsFound: evals.length + unitTests.length,
    percentage: percentageIncludingUnitTests,
    ciGated: ci.gated
  });

  return {
    callSites,
    prompts,
    evals,
    unitTests,
    verdict,
    verdictIncludingUnitTests,
    coverage: {
      coveredCallSites,
      totalCallSites,
      percentage
    },
    coverageIncludingUnitTests: {
      coveredCallSites: coveredIncludingUnitTests,
      totalCallSites,
      percentage: percentageIncludingUnitTests
    }
  };
}

function withLowerText(candidate) {
  return { ...candidate, lowerText: candidate.text.toLowerCase() };
}

function percentOf(covered, total) {
  return total === 0 ? null : roundPercentage((covered / total) * 100);
}

function coverageForTarget(target, candidates, targetType) {
  const reasons = [];
  const seen = new Set();
  const promptMatcher = targetType === 'prompt' ? buildPromptMatcher(target) : null;

  for (const candidate of candidates) {
    let method = null;

    if (candidate.imports.includes(target.file)) {
      method = 'module-import';
    } else if (promptMatcher && promptMatcher(candidate)) {
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

function buildPromptMatcher(prompt) {
  const lowerFile = prompt.file.toLowerCase();
  const basename = path.posix.basename(lowerFile);
  const stem = basename.replace(/\.[^.]+$/, '');
  const namePattern = GENERIC_PROMPT_NAMES.has(prompt.name)
    ? null
    : new RegExp(`\\b${escapeRegex(prompt.name)}\\b`, 'i');

  return (candidate) => {
    if (candidate.lowerText.includes(lowerFile)) return true;
    if (stem.length > 3 && candidate.lowerText.includes(stem)) return true;
    return namePattern ? namePattern.test(candidate.text) : false;
  };
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

  // Mirror layouts only: once eval/test folders are removed from the eval's directory, it must end
  // with the target's last two directory names (`agent/x.py` <-> `tests/agent/test_y.py`,
  // `onyx/llm/x.py` <-> `tests/unit/onyx/llm/test_y.py`). A folder name that merely appears in
  // both paths (`.../scripts/`, `.../providers/`) does not count.
  const targetSegments = path.posix.dirname(targetFile).toLowerCase().split('/').filter((s) => s && s !== '.');
  if (targetSegments.length === 0) return false;
  const stripped = path.posix
    .dirname(evalFile)
    .toLowerCase()
    .split('/')
    .filter((segment) => segment && segment !== '.' && !EVAL_OR_TEST_SEGMENTS.has(segment));
  const tail = targetSegments.slice(-2);
  if (tail.every((segment) => GENERIC_PATH_SEGMENTS.has(segment))) return false;
  if (stripped.length < tail.length) return false;
  if (stripped.length === path.posix.dirname(evalFile).split('/').length) return false;
  return tail.every((segment, index) => stripped[stripped.length - tail.length + index] === segment);
}

const EVAL_OR_TEST_SEGMENTS = new Set(['eval', 'evals', 'test', 'tests', '__tests__', 'unit', 'integration', 'e2e']);

function looksEvalLike(filePath) {
  const lower = filePath.toLowerCase();
  return /(?:^|\/)(?:evals?|evaluations?|tests?|__tests__)(?:\/|$)/.test(lower) || /\.(?:eval|test|spec)\./i.test(lower);
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
