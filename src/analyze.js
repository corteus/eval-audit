import path from 'node:path';
import { analyzeCiGating } from './ci.js';
import { VERSION } from './constants.js';
import { mapCoverage } from './coverage.js';
import { discoverSurfaces } from './discover.js';
import { collectReadableFiles } from './file-walk.js';

export async function analyzeRepository(targetPath, options = {}) {
  const { root, files, skipped } = await collectReadableFiles(targetPath, { maxFiles: options.maxFiles });
  const ci = await analyzeCiGating(root);
  const discovery = discoverSurfaces(files);
  const mapped = mapCoverage(discovery, ci);
  const status = mapped.coverage.totalCallSites === 0 ? 'no-llm-call-sites' : 'scanned';

  return {
    schemaVersion: 2,
    toolVersion: VERSION,
    targetPath: root,
    targetName: path.basename(root),
    status,
    verdict: mapped.verdict,
    verdictIncludingUnitTests: mapped.verdictIncludingUnitTests,
    coverage: mapped.coverage,
    coverageIncludingUnitTests: mapped.coverageIncludingUnitTests,
    ci,
    callSites: mapped.callSites,
    prompts: mapped.prompts,
    evals: mapped.evals,
    unitTests: mapped.unitTests,
    summary: {
      filesScanned: files.length,
      skipped,
      llmCallSites: mapped.callSites.length,
      promptsFound: mapped.prompts.length,
      evalFilesFound: mapped.evals.length,
      unitTestFilesTouchingTargets: mapped.unitTests.length,
      coveredCallSites: mapped.coverage.coveredCallSites,
      coveredCallSitesIncludingUnitTests: mapped.coverageIncludingUnitTests.coveredCallSites,
      uncoveredCallSites: mapped.callSites.filter((callSite) => !callSite.covered).length,
      orphanedPrompts: mapped.prompts.filter((prompt) => !prompt.covered).length,
      ciGated: ci.gated
    }
  };
}
