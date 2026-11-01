import path from 'node:path';
import { LOCAL_IMPORT_EXTENSIONS } from './constants.js';

// Receiver-name patterns (`client.chat`, `llm.invoke`) are too generic outside Python and JS/TS.
const GENERIC_RECEIVER_LANGUAGES = new Set(['.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

const LLM_CALL_PATTERNS = [
  { kind: 'openai.chat.completions', pattern: /\b(?:\w+\.)?chat\.completions\.(?:create|parse|stream)\s*\(/g },
  { kind: 'openai.chat.completions', pattern: /\bChatCompletion\.a?create\s*\(/g },
  { kind: 'openai.responses', pattern: /\b(?:\w+\.)?responses\.(?:create|parse|stream)\s*\(/g },
  {
    kind: 'anthropic.messages',
    pattern: /\b\w*(?:anthropic|client|claude)\w*(?:\.beta)?\.messages\.(?:create|stream)\s*\(/gi,
    // Twilio's SDK also has `client.messages.create(...)` (it sends an SMS).
    skipIf: (text) => /\btwilio\b/i.test(text) && !/anthropic|claude/i.test(text)
  },
  { kind: 'ai-sdk.generateText', pattern: /\bgenerateText\s*\(/g },
  { kind: 'ai-sdk.streamText', pattern: /\bstreamText\s*\(/g },
  { kind: 'ai-sdk.generateObject', pattern: /\bgenerateObject\s*\(/g },
  { kind: 'ai-sdk.streamObject', pattern: /\bstreamObject\s*\(/g },
  { kind: 'google.generateContent', pattern: /\b(?:model|genAI|client|gemini)\w*\.generateContent(?:Stream)?\s*\(/g },
  { kind: 'google.generate_content', pattern: /\b\w+\.generate_content(?:_async|_stream)?\s*\(/g },
  { kind: 'litellm.completion', pattern: /\blitellm\.a?completion\s*\(/g },
  {
    kind: 'litellm.completion',
    pattern: /(?<![.\w])a?completion\s*\(/g,
    requires: /^\s*from\s+litellm\s+import\s+[^\n]*\ba?completion\b/m
  },
  { kind: 'ollama', pattern: /\bollama\.(?:chat|generate)\s*\(/g },
  { kind: 'mistral.chat.complete', pattern: /\bchat\.complete(?:_async|Async)?\s*\(/g },
  {
    kind: 'client.chat',
    pattern: /\b(?:client|llm|model|chatModel|languageModel|agent)\w*\.chat\s*\(/g,
    languages: GENERIC_RECEIVER_LANGUAGES
  },
  // Receivers must start with the LLM word, optionally after snake_case prefixes (`structured_llm`,
  // `self.routing_chain`). camelCase names that merely contain the word (`fetchModelList.invoke`, an
  // Electron IPC bridge) are not counted.
  {
    kind: 'llm.complete',
    pattern: /\b_*(?:[a-z0-9]+_)*(?:llm|LLM)\w*\.(?:a?complete|achat|a?stream_chat|a?stream_complete)\s*\(/g,
    languages: GENERIC_RECEIVER_LANGUAGES
  },
  // LangChain-style runnables. `client.invoke` (tool/RPC clients) and `agents.invoke` (product APIs)
  // are deliberately not matched; `agent`, `agent_executor`, `agentExecutor` and `agent_graph` are.
  {
    kind: 'llm.invoke',
    pattern:
      /\b_*(?:[a-z0-9]+_)*(?:(?:llm|model|chain|runnable|chat|chatModel|languageModel)\w*|agent(?:_?[eE]xecutor|_?[gG]raph)?)\.a?invoke\s*\(/g,
    languages: GENERIC_RECEIVER_LANGUAGES
  }
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
        const key = `${file.relativePath}:${match.line}`;
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

  if (/\.stories\.[jt]sx?$/i.test(file.relativePath)) return matches;

  for (const { kind, pattern, requires, skipIf, languages } of LLM_CALL_PATTERNS) {
    if (languages && !languages.has(file.extension)) continue;
    if (requires && !requires.test(file.text)) continue;
    if (skipIf && skipIf(file.text)) continue;
    pattern.lastIndex = 0;
    for (const match of file.text.matchAll(pattern)) {
      if (looksLikeFunctionDeclaration(file.text, match.index)) continue;
      if (looksLikeCommentOrDocs(file.text, match.index)) continue;
      matches.push({
        kind,
        callee: match[0].replace(/\s*\($/, ''),
        line: lineForIndex(file.text, match.index)
      });
    }
  }

  return matches.sort((a, b) => a.line - b.line || a.kind.localeCompare(b.kind));
}

// Skips mentions on comment lines (`#`, `//`, `*`, `/*`) and inline-code mentions in docstrings (`` `x.invoke()` ``).
function looksLikeCommentOrDocs(text, index) {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const before = text.slice(lineStart, index);
  if (/^\s*(?:#|\/\/|\*|\/\*)/.test(before)) return true;
  if (/(?:^|\s)(?:#|\/\/)\s/.test(before)) return true; // trailing comment after code
  if (/"""|'''/.test(before)) return true; // same-line Python docstring text
  return /`[\w.()]*$/.test(before);
}

function looksLikeFunctionDeclaration(text, index) {
  const before = text.slice(Math.max(0, index - 50), index);
  if (/\bfunction\s+\*?\s*$/.test(before) || /\bdef\s+$/.test(before)) return true;
  // Class method declarations such as `async generateText(params) {` or `async *streamText(`.
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  return /^\s*(?:(?:public|private|protected|static|override|async)\s+)+\*?\s*$|^\s*(?:(?:public|private|protected|static|override)\s+)*async\s*\*\s*$/.test(
    text.slice(lineStart, index)
  );
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

// Eval frameworks recognised by an import (or require) in a code file.
const EVAL_FRAMEWORK_IMPORTS = [
  { type: 'inspect-ai', pattern: /^\s*(?:from|import)\s+inspect_ai\b/m },
  { type: 'ragas', pattern: /^\s*(?:from|import)\s+ragas\b/m },
  { type: 'braintrust', pattern: /^\s*(?:from|import)\s+(?:braintrust|autoevals)\b|\bfrom\s+['"](?:braintrust|autoevals)['"]|\brequire\s*\(\s*['"](?:braintrust|autoevals)['"]\s*\)/m },
  {
    type: 'langsmith-eval',
    pattern: /^\s*from\s+langsmith(?:\.evaluation)?\s+import\s+[^\n]*\ba?evaluate\b|^\s*(?:from|import)\s+langsmith\.evaluation\b|\bfrom\s+['"]langsmith\/evaluation['"]/m
  },
  { type: 'openevals', pattern: /^\s*(?:from|import)\s+openevals\b|\bfrom\s+['"]openevals['"]/m },
  { type: 'evalite', pattern: /\bfrom\s+['"]evalite(?:\/[\w-]+)?['"]/m },
  { type: 'vitest-evals', pattern: /\bfrom\s+['"]vitest-evals['"]/m },
  { type: 'vai', pattern: /\bfrom\s+['"]@botpress\/vai['"]/m },
  { type: 'phoenix-evals', pattern: /^\s*(?:from|import)\s+phoenix\.evals\b/m },
  { type: 'trulens', pattern: /^\s*(?:from|import)\s+trulens(?:_eval)?\b/m },
  { type: 'mlflow-evaluate', pattern: /\bmlflow\.(?:genai\.)?evaluate\s*\(/m }
];

function classifyFile(file) {
  const lower = file.relativePath.toLowerCase();
  const basename = file.basename.toLowerCase();
  const segments = lower.split('/');
  // Only `eval`/`evals` directories count. `evaluation(s)` is a common product-feature
  // name (apps that let users evaluate things), so it is not treated as an eval surface.
  const inEvalDir = segments.slice(0, -1).some((segment) => ['eval', 'evals'].includes(segment));
  const inTestDir = segments.some((segment) => ['test', 'tests', '__tests__'].includes(segment));
  const promptfoo = /(?:^|\/)promptfooconfig(?:\.[\w.-]+)?$/i.test(lower) || /\.promptfoo\.(?:ya?ml|json)$/i.test(lower);
  const evalName =
    /\.evals?\.(?:js|mjs|cjs|ts|tsx|py|jsonl|ya?ml)$/i.test(basename) ||
    /^evals?_\w+\.py$/i.test(basename) ||
    /^\w+_evals?\.py$/i.test(basename);
  // JSONL datasets only count inside eval or golden directories, not generic test fixtures.
  const goldenJsonl =
    /\.jsonl$/i.test(basename) && segments.slice(0, -1).some((segment) => ['eval', 'evals', 'golden'].includes(segment));
  const deepeval = file.kind === 'code' && /\bdeepeval\b/i.test(file.text);
  const framework = file.kind === 'code' ? EVAL_FRAMEWORK_IMPORTS.find(({ pattern }) => pattern.test(file.text)) : null;
  const promptfooText = /\bpromptfoo\b/i.test(file.text) && /\.(?:ya?ml|json|js|mjs|cjs|ts)$/i.test(basename);
  const test = inTestDir || /\.(?:test|spec)\.(?:js|mjs|cjs|ts|tsx|py)$/i.test(basename) || /^test_\w+\.py$|_test\.py$/i.test(basename);

  if (promptfoo) return { eval: true, evalType: 'promptfoo', test };
  if (deepeval) return { eval: true, evalType: 'deepeval', test };
  if (framework) return { eval: true, evalType: framework.type, test };
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

  // Python `from pkg import module_a, module_b` may import submodules, so also try `pkg.module_a`.
  const fromImport = /^\s*from\s+([.\w]+)\s+import\s+(\([^)]*\)|[^\n]+)/gm;
  for (const match of text.matchAll(fromImport)) {
    const names = match[2].replace(/[()]/g, ' ').replace(/#[^\n]*/g, ' ').split(/[\s,\\]+/);
    for (const name of names) {
      if (!/^[A-Za-z_]\w*$/.test(name) || name === 'as') continue;
      imports.add(match[1].endsWith('.') ? `${match[1]}${name}` : `${match[1]}.${name}`);
    }
  }

  return [...imports];
}

function resolveImports(imports, fromFile, fileIndex) {
  const resolved = new Set();

  for (const specifier of imports) {
    for (const candidate of importCandidates(specifier, fromFile, fileIndex)) {
      if (fileIndex.has(candidate)) {
        resolved.add(candidate);
      }
    }
    const pythonMatch = resolvePythonModuleBySuffix(specifier, fromFile, fileIndex);
    if (pythonMatch) resolved.add(pythonMatch);
  }

  return [...resolved].sort();
}

function importCandidates(specifier, fromFile, fileIndex) {
  const candidates = new Set();
  const fromDir = path.posix.dirname(fromFile);
  const isPython = fromFile.endsWith('.py');

  if (isPython && specifier.startsWith('.')) {
    // Python relative import: one leading dot is the current package, each extra dot goes up one level.
    const dots = specifier.match(/^\.+/)[0].length;
    const rest = specifier.slice(dots).replace(/\./g, '/');
    let baseDir = fromDir;
    for (let i = 1; i < dots; i += 1) baseDir = path.posix.dirname(baseDir);
    addCandidates(candidates, normalizePosix(rest ? path.posix.join(baseDir, rest) : baseDir));
    return candidates;
  }

  if (specifier.startsWith('.')) {
    addCandidates(candidates, normalizePosix(path.posix.join(fromDir, specifier)));
    return candidates;
  }

  const alias = specifier.match(/^(@|~|\$lib)\/(.+)$/);
  if (alias && !isPython) {
    // Common TS/JS path aliases (`@/`, `~/`, SvelteKit `$lib/`) resolved against each enclosing package root.
    for (const packageRoot of packageRoots(fromFile, fileIndex)) {
      const prefix = packageRoot ? `${packageRoot}/` : '';
      if (alias[1] === '$lib') {
        addCandidates(candidates, `${prefix}src/lib/${alias[2]}`);
      } else {
        addCandidates(candidates, `${prefix}${alias[2]}`);
        addCandidates(candidates, `${prefix}src/${alias[2]}`);
      }
    }
    return candidates;
  }

  addCandidates(candidates, specifier.includes('.') && isPythonModuleName(specifier) ? specifier.replace(/\./g, '/') : specifier);
  return candidates;
}

function packageRoots(fromFile, fileIndex) {
  const roots = [];
  let dir = path.posix.dirname(fromFile);
  while (true) {
    const prefix = dir === '.' ? '' : `${dir}/`;
    if (['package.json', 'tsconfig.json', 'jsconfig.json'].some((name) => fileIndex.has(`${prefix}${name}`))) {
      roots.push(dir === '.' ? '' : dir);
    }
    if (dir === '.' || dir === '' || dir === '/') break;
    dir = path.posix.dirname(dir);
  }
  return roots;
}

function isPythonModuleName(specifier) {
  return /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/.test(specifier);
}

// `from app.services.llm import x` in a test usually means `<somewhere>/app/services/llm.py`
// (src layouts, backend/ folders). Accept a suffix match only when it is unique.
function resolvePythonModuleBySuffix(specifier, fromFile, fileIndex) {
  if (!fromFile.endsWith('.py') || !isPythonModuleName(specifier)) return null;
  const modulePath = specifier.replace(/\./g, '/');
  const matches = [
    ...(fileIndex.pythonSuffixes.get(`${modulePath}.py`) ?? []),
    ...(fileIndex.pythonSuffixes.get(`${modulePath}/__init__.py`) ?? [])
  ];
  return matches.length === 1 ? matches[0] : null;
}

function addCandidates(candidates, base) {
  candidates.add(base);
  for (const ext of LOCAL_IMPORT_EXTENSIONS) {
    candidates.add(`${base}${ext}`);
    candidates.add(`${base}/index${ext}`);
  }
  candidates.add(`${base}/__init__.py`);
}

function buildFileIndex(files) {
  const index = new Set(files.map((file) => file.relativePath));
  index.pythonSuffixes = new Map();
  for (const file of files) {
    if (!file.relativePath.endsWith('.py')) continue;
    const segments = file.relativePath.split('/');
    for (let i = 0; i < segments.length; i += 1) {
      const suffix = segments.slice(i).join('/');
      if (!index.pythonSuffixes.has(suffix)) index.pythonSuffixes.set(suffix, []);
      index.pythonSuffixes.get(suffix).push(file.relativePath);
    }
  }
  return index;
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
