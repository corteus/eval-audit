import path from 'node:path';
import { analyzeCiGating } from './ci.js';
import { mapCoverage } from './coverage.js';
import { discoverSurfaces } from './discover.js';
import { collectReadableFiles } from './file-walk.js';

export async function analyzeRepository(targetPath) {
  const { root, files, skipped } = await collectReadableFiles(targetPath);
  const ci = await analyzeCiGating(root);
  const discovery = discoverSurfaces(files);
  const mapped = mapCoverage(discovery, ci);
  const status = mapped.coverage.totalCallSites === 0 ? 'no-llm-call-sites' : 'scanned';

  return {
    schemaVersion: 1,
    targetPath: root,
    targetName: path.basename(root),
    status,
    verdict: mapped.verdict,
    coverage: mapped.coverage,
    ci,
    callSites: mapped.callSites,
    prompts: mapped.prompts,
    evals: mapped.evals,
    summary: {
      filesScanned: files.length,
      skipped,
      llmCallSites: mapped.callSites.length,
      promptsFound: mapped.prompts.length,
      evalFilesFound: mapped.evals.length,
      coveredCallSites: mapped.coverage.coveredCallSites,
      uncoveredCallSites: mapped.callSites.filter((callSite) => !callSite.covered).length,
      orphanedPrompts: mapped.prompts.filter((prompt) => !prompt.covered).length,
      ciGated: ci.gated
    }
  };
}
