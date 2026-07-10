import assert from 'node:assert/strict';
import { test } from 'node:test';
import { systemPrompt } from '../src/assistant.js';

test('support system prompt requires citations', () => {
  assert.match(systemPrompt, /cite the policy section/);
});
