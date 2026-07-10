import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePath } from './file-walk.js';

const MAX_WORKFLOW_BYTES = 1_000_000;

const CI_PATTERNS = [
  { type: 'promptfoo', pattern: /\bpromptfoo\s+eval\b/i },
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
    workflows.push(file);

    const lines = text.split(/\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const { type, pattern } of CI_PATTERNS) {
        if (pattern.test(line)) {
          commands.push({
            type,
            file,
            line: index + 1
          });
        }
      }
    }
  }

  return { gated: commands.length > 0, workflows, commands };
}
