const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  green: '\u001b[32m'
};

export function formatReport(result, options = {}) {
  const color = options.color ?? true;
  const c = (code, value) => (color ? `${ANSI[code]}${value}${ANSI.reset}` : value);
  const lines = [];

  lines.push(c('bold', 'eval-audit'));
  lines.push(`Target: ${result.targetPath}`);

  if (result.status === 'no-llm-call-sites') {
    lines.push('Status: No LLM call sites found');
    lines.push('Verdict: no verdict; this repo does not appear to call an LLM from scanned source files.');
    lines.push('');
    lines.push(`Files scanned: ${result.summary.filesScanned}`);
    lines.push(`Prompts found: ${result.summary.promptsFound}`);
    lines.push(`Eval files found: ${result.summary.evalFilesFound}`);
    lines.push(`CI gated: ${result.ci.gated ? 'yes' : 'no'}`);
    return lines.join('\n');
  }

  lines.push(`Verdict: ${colorVerdict(result.verdict, c)}`);
  lines.push(
    `Eval coverage: ${formatCoverage(result.coverage)} (${result.coverage.coveredCallSites}/${result.coverage.totalCallSites} call sites)`
  );
  lines.push(
    `Including unit tests that import the module: ${formatCoverage(result.coverageIncludingUnitTests)} (${result.coverageIncludingUnitTests.coveredCallSites}/${result.coverageIncludingUnitTests.totalCallSites} call sites)`
  );
  lines.push(
    `Eval files: ${result.summary.evalFilesFound}; unit tests touching LLM code: ${result.summary.unitTestFilesTouchingTargets}; prompts: ${result.summary.promptsFound}; orphaned prompts: ${result.summary.orphanedPrompts}; CI gated: ${result.ci.gated ? 'yes' : 'no'}`
  );

  const uncovered = result.callSites.filter((callSite) => !callSite.covered);
  if (uncovered.length > 0) {
    lines.push('');
    lines.push(c('bold', 'Uncovered call sites'));
    for (const callSite of uncovered.slice(0, 12)) {
      lines.push(`- ${callSite.file}:${callSite.line} ${callSite.kind}`);
    }
    if (uncovered.length > 12) {
      lines.push(`- ... ${uncovered.length - 12} more`);
    }
  }

  const orphaned = result.prompts.filter((prompt) => !prompt.covered);
  if (orphaned.length > 0) {
    lines.push('');
    lines.push(c('bold', 'Orphaned prompts'));
    for (const prompt of orphaned.slice(0, 12)) {
      lines.push(`- ${prompt.file}:${prompt.line} ${prompt.name}`);
    }
    if (orphaned.length > 12) {
      lines.push(`- ... ${orphaned.length - 12} more`);
    }
  }

  return lines.join('\n');
}

function colorVerdict(verdict, c) {
  if (verdict === 'Gated in CI' || verdict === 'Well covered') return c('green', verdict);
  if (verdict === 'Partial coverage') return c('yellow', verdict);
  return c('red', verdict);
}

function formatCoverage(coverage) {
  return coverage.percentage === null ? 'n/a' : `${coverage.percentage.toFixed(1)}%`;
}
