import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePath } from './file-walk.js';

const MAX_WORKFLOW_BYTES = 1_000_000;

const CI_PATTERNS = [
  { type: 'promptfoo', pattern: /\bpromptfoo(?:@[\w.^~-]+)?\s+eval\b/i },
  { type: 'promptfoo', pattern: /\bpromptfoo\/promptfoo-action\b/i },
  { type: 'inspect-ai', pattern: /\binspect\s+eval(?:-set)?\b/i },
  { type: 'braintrust', pattern: /\bbraintrust\s+eval\b/i },
  { type: 'evalite', pattern: /\bevalite\b/i },
  { type: 'openai-evals', pattern: /\boaieval(?:set)?\b/i },
  { type: 'package-script', pattern: /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?evals?(?::[\w-]+)?(?=\s|$|["'])/i },
  { type: 'make', pattern: /\bmake\s+evals?\b/i },
  { type: 'python', pattern: /\bpython3?\s+(?:-m\s+)?\S*\bevals?[/.]/i },
  { type: 'deepeval', pattern: /\b(?:deepeval|python\s+-m\s+deepeval)\b/i },
  { type: 'node-test', pattern: /\bnode\s+--test\b[^\n]*(?:\bevals?\b|\.eval\.)/i },
  { type: 'pytest', pattern: /\bpytest\b[^\n]*(?:\bevals?\b|\.eval\.)/i }
];

export async function analyzeCiGating(rootPath) {
  const root = path.resolve(rootPath);
  const workflowDir = path.join(root, '.github', 'workflows');
  const workflows = [];
  const commands = [];

  let entries;
  try {
    entries = await fs.readdir(workflowDir, { withFileTypes: true });
  } catch {
    return { gated: false, workflows, commands };
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile()) continue;
    if (!/\.(?:ya?ml)$/i.test(entry.name)) continue;

    const absolutePath = path.join(workflowDir, entry.name);
    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch {
      continue;
    }
    if (stat.size > MAX_WORKFLOW_BYTES) continue;

    let text;
    try {
      text = await fs.readFile(absolutePath, 'utf8');
    } catch {
      continue;
    }

    const file = normalizePath(path.relative(root, absolutePath));
    const triggers = workflowTriggers(text);
    // Only workflows that run on code changes can gate a merge; schedule/manual-only runs are reported but do not gate.
    const gating = triggers.some((trigger) => GATING_TRIGGERS.has(trigger));
    workflows.push(file);

    const lines = text.split(/\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const { type, pattern } of CI_PATTERNS) {
        if (pattern.test(line)) {
          commands.push({
            type,
            file,
            line: index + 1,
            triggers,
            gating
          });
        }
      }
    }
  }

  return { gated: commands.some((command) => command.gating), workflows, commands };
}

const GATING_TRIGGERS = new Set(['push', 'pull_request', 'pull_request_target', 'merge_group']);

export function workflowTriggers(text) {
  const lines = text.split(/\n/);
  const index = lines.findIndex((line) => /^(?:on|"on"|'on'|true):/.test(line));
  if (index === -1) return [];
  const inline = lines[index].replace(/^[^:]+:\s*/, '').replace(/#.*$/, '').trim();
  if (inline) return inline.replace(/[[\]]/g, ' ').split(/[\s,]+/).filter(Boolean);

  const triggers = [];
  let indent = null;
  for (const line of lines.slice(index + 1)) {
    if (/^\s*(?:#|$)/.test(line)) continue;
    const match = line.match(/^(\s+)(?:-\s*)?([\w-]+)/);
    if (!match) break;
    if (indent === null) indent = match[1].length;
    if (match[1].length < indent) break;
    if (match[1].length === indent) triggers.push(match[2]);
  }
  return triggers;
}
