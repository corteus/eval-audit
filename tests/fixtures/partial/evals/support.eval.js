import assert from 'node:assert/strict';
import { test } from 'node:test';
import { supportPrompt } from '../src/support.js';

test('support prompt names the warranty matrix', () => {
  assert.match(supportPrompt, /warranty matrix/);
});
