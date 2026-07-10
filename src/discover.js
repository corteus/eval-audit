import path from 'node:path';
import { LOCAL_IMPORT_EXTENSIONS } from './constants.js';

const LLM_CALL_PATTERNS = [
  { kind: 'openai.chat.completions', pattern: /\b(?:\w+\.)?chat\.completions\.create\s*\(/g },
  { kind: 'openai.responses', pattern: /\b(?:\w+\.)?responses\.create\s*\(/g },
  { kind: 'anthropic.messages', pattern: /\b(?:anthropic|client|claude|anthropicClient)\.messages\.create\s*\(/g },
  { kind: 'ai-sdk.generateText', pattern: /\bgenerateText\s*\(/g },
  { kind: 'ai-sdk.streamText', pattern: /\bstreamText\s*\(/g },
  { kind: 'google.generateContent', pattern: /\b(?:model|genAI|client|gemini)\w*\.generateContent\s*\(/g },
  { kind: 'client.chat', pattern: /\b(?:client|llm|model|chatModel|languageModel|agent)\w*\.chat\s*\(/g },
  { kind: 'llm.invoke', pattern: /\b(?:llm|model|chatModel|languageModel|chain|runnable|agent|chat|client)\w*\.invoke\s*\(/g }
];

const PROMPT_ASSIGNMENT =
  /\b(?<name>[A-Z0-9_]*(?:PROMPT|INSTRUCTIONS|TEMPLATE)[A-Z0-9_]*|[A-Za-z_$][\w$]*(?:Prompt|prompt|Instructions|instructions|Template|template))\b\s*(?::\s*[^=]+)?=\s*(?:`|"""|'''|"|')/g;

const PROMPT_PROPERTY =
  /\b(?<name>(?:system|user|developer)?Prompt|instructions|template|prompt)\s*:\s*(?:`|"|')/gi;

export function discoverSurfaces(files) {
  const fileIndex = buildFileIndex(files);
  const callSites = [];
  const prompts = [];
  const explicitEvalFiles = [];
  const testFiles = [];
  const seenCalls = new Set();
  const seenPrompts = new Set();
  const seenEvals = new Set();

  for (const file of files) {
    const flags = classifyFile(file);

    if (file.kind === 'code' && !flags.eval && !flags.test) {
      for (const match of findLlmCalls(file)) {
        const key = `${file.relativePath}:${match.line}:${match.kind}`;
        if (seenCalls.has(key)) continue;
        seenCalls.add(key);
        callSites.push({
          id: `call:${callSites.length + 1}`,
          file: file.relativePath,
          line: match.line,
          kind: match.kind,
          callee: match.callee,
          covered: false,
          coverage: []
        });
      }

      for (const prompt of findPromptConstants(file)) {
        const key = `${file.relativePath}:${prompt.line}:${prompt.name}`;
        if (seenPrompts.has(key)) continue;
        seenPrompts.add(key);
        prompts.push({
          id: `prompt:${prompts.length + 1}`,
          file: file.relativePath,
          line: prompt.line,
          name: prompt.name,
          source: 'constant',
          covered: false,
          coverage: []
        });
      }
    }

    if (!flags.eval && isPromptFile(file)) {
      const name = promptNameFromPath(file.relativePath);
      const key = `${file.relativePath}:1:${name}`;
      if (!seenPrompts.has(key)) {
        seenPrompts.add(key);
        prompts.push({
          id: `prompt:${prompts.length + 1}`,
          file: file.relativePath,
          line: 1,
          name,
          source: 'file',
          covered: false,
          coverage: []
        });
      }
    }

    if (flags.eval) {
      addEval(explicitEvalFiles, seenEvals, file, flags.evalType);
    } else if (flags.test) {
      testFiles.push(buildEvalCandidate(file, 'test'));
    }
  }

  const withImports = (candidate) => ({
    ...candidate,
    imports: resolveImports(parseImports(candidate.text), candidate.file, fileIndex)
  });

  return {
    callSites: callSites.sort(sortByLocation),
    prompts: prompts.sort(sortByLocation),
    explicitEvalFiles: explicitEvalFiles.map(withImports),
    testFiles: testFiles.map(withImports)
  };
}

function findLlmCalls(file) {
  const matches = [];

  for (const { kind, pattern } of LLM_CALL_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of file.text.matchAll(pattern)) {
      if (looksLikeFunctionDeclaration(file.text, match.index)) continue;
      matches.push({
        kind,
        callee: match[0].replace(/\s*\($/, ''),
        line: lineForIndex(file.text, match.index)
      });
    }
  }

  return matches.sort((a, b) => a.line - b.line || a.kind.localeCompare(b.kind));
}

function looksLikeFunctionDeclaration(text, index) {
  const before = text.slice(Math.max(0, index - 50), index);
  return /\bfunction\s+\*?\s*$/.test(before);
}

function findPromptConstants(file) {
  const matches = [];

  for (const pattern of [PROMPT_ASSIGNMENT, PROMPT_PROPERTY]) {
    pattern.lastIndex = 0;
    for (const match of file.text.matchAll(pattern)) {
      matches.push({
        name: match.groups.name,
        line: lineForIndex(file.text, match.index)
      });
    }
  }

  return matches;
}

function classifyFile(file) {
  const lower = file.relativePath.toLowerCase();
  const basename = file.basename.toLowerCase();
  const segments = lower.split('/');
  const inEvalDir = segments.some((segment) => ['eval', 'evals', 'evaluation', 'evaluations'].includes(segment));
  const inTestDir = segments.some((segment) => ['test', 'tests', '__tests__'].includes(segment));
  const promptfoo = /(?:^|\/)promptfooconfig(?:\.[\w.-]+)?$/i.test(lower) || /\.promptfoo\.(?:ya?ml|json)$/i.test(lower);
  const evalName = /\.eval\.(?:js|mjs|cjs|ts|tsx|py|jsonl)$/i.test(basename);
  const goldenJsonl = /\.jsonl$/i.test(basename) && segments.some((segment) => ['eval', 'evals', 'golden', 'fixtures'].includes(segment));
  const deepeval = file.kind === 'code' && /\bdeepeval\b/i.test(file.text);
  const promptfooText = /\bpromptfoo\b/i.test(file.text) && /\.(?:ya?ml|json|js|mjs|cjs|ts)$/i.test(basename);
  const test = inTestDir || /\.(?:test|spec)\.(?:js|mjs|cjs|ts|tsx|py)$/i.test(basename);

  if (promptfoo) return { eval: true, evalType: 'promptfoo', test };
  if (deepeval) return { eval: true, evalType: 'deepeval', test };
  if (evalName) return { eval: true, evalType: 'eval-file', test };
  if (inEvalDir) return { eval: true, evalType: 'eval-dir', test };
  if (goldenJsonl) return { eval: true, evalType: 'golden-dataset', test };
  if (promptfooText) return { eval: true, evalType: 'promptfoo', test };
  return { eval: false, evalType: null, test };
}

function addEval(evals, seen, file, type) {
  const key = `${file.relativePath}:${type}`;
  if (seen.has(key)) return;
  seen.add(key);
  evals.push(buildEvalCandidate(file, type));
}

function buildEvalCandidate(file, type) {
  return {
    id: `eval:${file.relativePath}`,
    file: file.relativePath,
    line: 1,
    type,
    text: file.text,
    imports: []
  };
}

function isPromptFile(file) {
  const lower = file.relativePath.toLowerCase();
  const segments = lower.split('/');
  const inPromptDir = segments.some((segment) =>
    ['prompt', 'prompts', 'instruction', 'instructions', 'chat_templates', 'chat-templates'].includes(segment)
  );

  if (lower.endsWith('.prompt')) return true;
  if (inPromptDir && /\.(?:md|mdx|txt|prompt)$/i.test(lower)) return true;
  if (/prompts?\/[^/]+\.mdx?$/i.test(lower)) return true;
  if (/(?:chat[_-]?template|chat[_-]?templates).*\.(?:ya?ml)$/i.test(lower)) return true;
  return false;
}

function promptNameFromPath(filePath) {
  const parsed = path.parse(filePath);
  return parsed.name.replace(/[^A-Za-z0-9_.$-]+/g, '-');
}

function parseImports(text) {
  const imports = new Set();
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*from\s+([.\w]+)\s+import\b/gm,
    /^\s*import\s+([.\w]+)\b/gm
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      imports.add(match[1]);
    }
  }

  return [...imports];
}

function resolveImports(imports, fromFile, fileIndex) {
  const resolved = new Set();

  for (const specifier of imports) {
    for (const candidate of importCandidates(specifier, fromFile)) {
      if (fileIndex.has(candidate)) {
        resolved.add(candidate);
      }
    }
  }

  return [...resolved].sort();
}

function importCandidates(specifier, fromFile) {
  const candidates = new Set();
  const fromDir = path.posix.dirname(fromFile);
  let base;

  if (specifier.startsWith('.')) {
    base = normalizePosix(path.posix.join(fromDir, specifier));
  } else {
    base = specifier.includes('.') ? specifier.replace(/\./g, '/') : specifier;
  }

  addCandidates(candidates, base);
  return candidates;
}

function addCandidates(candidates, base) {
  candidates.add(base);
  for (const ext of LOCAL_IMPORT_EXTENSIONS) {
    candidates.add(`${base}${ext}`);
    candidates.add(`${base}/index${ext}`);
  }
}

function buildFileIndex(files) {
  return new Set(files.map((file) => file.relativePath));
}

function normalizePosix(value) {
  return path.posix.normalize(value).replace(/^\.\//, '');
}

function lineForIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

function sortByLocation(a, b) {
  return a.file.localeCompare(b.file) || a.line - b.line || a.name?.localeCompare(b.name ?? '') || 0;
}

export { classifyFile, parseImports, resolveImports };
