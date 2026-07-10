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
  assert.equal(parsed.schemaVersion, 1);
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
