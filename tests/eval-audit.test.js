import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { analyzeRepository } from '../src/analyze.js';
import { shouldSkipSensitiveFile } from '../src/file-walk.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const fixtures = path.join(__dirname, 'fixtures');
const node = process.execPath;
const bin = path.join(root, 'bin/eval-audit.js');

test('discovers a well-covered repo and reports CI-gated coverage', async () => {
  const result = await analyzeRepository(path.join(fixtures, 'well-covered'));

  assert.equal(result.status, 'scanned');
  assert.equal(result.verdict, 'Gated in CI');
  assert.equal(result.coverage.totalCallSites, 1);
  assert.equal(result.coverage.coveredCallSites, 1);
  assert.equal(result.coverage.percentage, 100);
  assert.equal(result.summary.promptsFound, 2);
  assert.equal(result.summary.orphanedPrompts, 0);
  assert.equal(result.ci.gated, true);
  assert.ok(result.evals.some((entry) => entry.type === 'promptfoo'));
});

test('reports no evals when LLM code has no eval surface', async () => {
  const result = await analyzeRepository(path.join(fixtures, 'no-evals'));

  assert.equal(result.status, 'scanned');
  assert.equal(result.verdict, 'No evals');
  assert.equal(result.coverage.totalCallSites, 1);
  assert.equal(result.coverage.coveredCallSites, 0);
  assert.equal(result.coverage.percentage, 0);
  assert.equal(result.summary.evalFilesFound, 0);
  assert.deepEqual(
    result.callSites.filter((callSite) => !callSite.covered).map((callSite) => callSite.file),
    ['src/index.js']
  );
});

test('maps partial coverage through test imports', async () => {
  const result = await analyzeRepository(path.join(fixtures, 'partial'));

  assert.equal(result.status, 'scanned');
  assert.equal(result.verdict, 'Partial coverage');
  assert.equal(result.coverage.totalCallSites, 2);
  assert.equal(result.coverage.coveredCallSites, 1);
  assert.equal(result.coverage.percentage, 50);
  assert.equal(result.summary.orphanedPrompts, 2);
  assert.ok(result.callSites.find((callSite) => callSite.file === 'src/support.js').covered);
  assert.equal(result.callSites.find((callSite) => callSite.file === 'src/renewal.js').covered, false);
});

test('handles repositories with no LLM call sites', async () => {
  const result = await analyzeRepository(path.join(fixtures, 'not-ai'));

  assert.equal(result.status, 'no-llm-call-sites');
  assert.equal(result.verdict, null);
  assert.equal(result.coverage.totalCallSites, 0);
  assert.equal(result.coverage.percentage, null);
  assert.deepEqual(result.callSites, []);
});

test('CLI JSON output preserves shape', async () => {
  const result = await execCli(['--json', path.join(fixtures, 'well-covered')]);
  const parsed = JSON.parse(result.stdout);

  assert.equal(result.code, 0);
  assert.equal(parsed.schemaVersion, 2);
  assert.equal(parsed.verdict, 'Gated in CI');
  assert.equal(parsed.coverage.percentage, 100);
  assert.equal(Array.isArray(parsed.callSites), true);
  assert.equal(Array.isArray(parsed.prompts), true);
  assert.equal(Array.isArray(parsed.evals), true);
});

test('CLI min-coverage exits non-zero below threshold only', async () => {
  const passing = await execCli(['--min-coverage', '50', path.join(fixtures, 'partial')]);
  const failingPartial = await execCli(['--min-coverage=75', path.join(fixtures, 'partial')]);
  const failingNoEvals = await execCli(['--min-coverage', '1', path.join(fixtures, 'no-evals')]);
  const notAi = await execCli(['--min-coverage', '100', path.join(fixtures, 'not-ai')]);

  assert.equal(passing.code, 0);
  assert.equal(failingPartial.code, 1);
  assert.equal(failingNoEvals.code, 1);
  assert.equal(notAi.code, 0);
});

test('detects Python SDK call styles and maps src-layout imports from eval files', async () => {
  const result = await analyzeRepository(path.join(fixtures, 'python-app'));
  const kinds = Object.fromEntries(result.callSites.map((callSite) => [callSite.file, callSite.kind]));

  assert.deepEqual(kinds, {
    'src/myapp/chain.py': 'llm.invoke',
    'src/myapp/classify.py': 'anthropic.messages',
    'src/myapp/extract.py': 'google.generate_content',
    'src/myapp/summarize.py': 'litellm.completion'
  });
  // the local `completion()` helper in chain.py is not counted because chain.py does not import litellm
  assert.equal(result.callSites.filter((callSite) => callSite.file === 'src/myapp/chain.py').length, 1);
  assert.deepEqual(
    result.evals.map((entry) => [entry.file, entry.type]),
    [['evals/eval_summarize.py', 'inspect-ai']]
  );
  assert.equal(result.callSites.find((callSite) => callSite.file === 'src/myapp/summarize.py').covered, true);
  assert.equal(result.coverage.coveredCallSites, 1);
  assert.equal(result.coverage.percentage, 25);
  assert.equal(result.verdict, 'Partial coverage');
  assert.equal(result.ci.gated, true);
  assert.equal(result.ci.commands[0].type, 'inspect-ai');

  // a mocked unit test is reported separately and does not raise the eval verdict
  const classify = result.callSites.find((callSite) => callSite.file === 'src/myapp/classify.py');
  assert.equal(classify.covered, false);
  assert.equal(classify.coveredIncludingUnitTests, true);
  assert.equal(result.coverageIncludingUnitTests.coveredCallSites, 2);
  assert.equal(result.coverageIncludingUnitTests.percentage, 50);
  assert.deepEqual(result.unitTests.map((entry) => entry.file), ['tests/test_classify.py']);
});

test('ignores product features named evaluation, test fixtures and hidden agent-tooling dirs', async () => {
  const result = await analyzeRepository(path.join(fixtures, 'ts-app'));

  assert.deepEqual(
    result.callSites.map((callSite) => [callSite.file, callSite.kind]),
    [
      ['src/evaluation/judge.ts', 'ai-sdk.generateObject'],
      ['src/lib/ai.ts', 'ai-sdk.streamText']
    ]
  );
  assert.equal(result.summary.evalFilesFound, 0);
  assert.equal(result.verdict, 'No evals');
  // the `@/lib/ai` alias resolves through tsconfig.json at the package root
  assert.equal(result.callSites.find((callSite) => callSite.file === 'src/lib/ai.ts').coveredIncludingUnitTests, true);
  assert.equal(result.verdictIncludingUnitTests, 'Partial coverage');
});

test('recognises eval frameworks by import and eval commands in CI', async () => {
  const { classifyFile } = await import('../src/discover.js');
  const code = (relativePath, text) => ({
    relativePath,
    basename: path.posix.basename(relativePath),
    kind: 'code',
    text
  });

  assert.equal(classifyFile(code('app/check.py', 'from ragas import evaluate\n')).evalType, 'ragas');
  assert.equal(classifyFile(code('app/bt.ts', "import { Eval } from 'braintrust';\n")).evalType, 'braintrust');
  assert.equal(
    classifyFile(code('app/ls.py', 'from langsmith import Client, evaluate\n')).evalType,
    'langsmith-eval'
  );
  assert.equal(classifyFile(code('app/tracing.py', 'from langsmith import traceable\n')).eval, false);
  assert.equal(classifyFile(code('app/answer_eval.py', 'x = 1\n')).evalType, 'eval-file');
  assert.equal(
    classifyFile(code('pkg/e2e/summarize.test.ts', "import { check } from '@botpress/vai'\n")).evalType,
    'vai'
  );
  assert.equal(classifyFile(code('app/evaluation/judge.py', 'x = 1\n')).eval, false);

  const { analyzeCiGating } = await import('../src/ci.js');
  const ci = await analyzeCiGating(path.join(fixtures, 'python-app'));
  assert.equal(ci.gated, true);
});

test('path proximity needs a mirrored eval/test folder, not a shared generic folder name', async () => {
  const { mapCoverage } = await import('../src/coverage.js');
  const call = (file) => ({ id: file, file, line: 1, kind: 'openai.chat.completions', covered: false, coverage: [] });
  const evalFile = (file) => ({ id: `eval:${file}`, file, line: 1, type: 'eval-dir', text: '', imports: [] });
  const mapped = mapCoverage(
    {
      callSites: [call('skills/research/scripts/run_model.py'), call('agent/client.py')],
      prompts: [],
      explicitEvalFiles: [evalFile('evals/compaction/scripts/report.py'), evalFile('evals/agent/recall.py')],
      testFiles: []
    },
    { gated: false }
  );

  assert.equal(mapped.callSites.find((c) => c.file === 'skills/research/scripts/run_model.py').covered, false);
  assert.equal(mapped.callSites.find((c) => c.file === 'agent/client.py').covered, true);
});

test('does not count IPC invoke() or Twilio messages.create() as LLM calls; schedule-only CI does not gate', async () => {
  const result = await analyzeRepository(path.join(fixtures, 'noise'));

  assert.deepEqual(
    result.callSites.map((callSite) => [callSite.file, callSite.kind]),
    [['src/router.py', 'llm.invoke']]
  );
  assert.equal(result.ci.commands.length, 1);
  assert.equal(result.ci.commands[0].type, 'promptfoo');
  assert.deepEqual(result.ci.commands[0].triggers, ['schedule', 'workflow_dispatch']);
  assert.equal(result.ci.gated, false);
});

test('CLI --max-files limits the walk and is reported', async () => {
  const result = await execCli(['--json', '--max-files', '2', path.join(fixtures, 'python-app')]);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.summary.filesScanned, 2);
  assert.equal(parsed.summary.skipped.maxFiles, true);
});

test('credential-like files are skipped before reading', () => {
  assert.equal(shouldSkipSensitiveFile('.env'), true);
  assert.equal(shouldSkipSensitiveFile('.env.example'), true);
  assert.equal(shouldSkipSensitiveFile('service-account-credentials.json'), true);
  assert.equal(shouldSkipSensitiveFile('id_ed25519'), true);
  assert.equal(shouldSkipSensitiveFile('index.js'), false);
});

async function execCli(args) {
  try {
    const { stdout, stderr } = await execFileAsync(node, [bin, '--no-color', ...args], {
      cwd: root
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
}
