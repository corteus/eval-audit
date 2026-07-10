# eval-audit

`eval-audit` is a zero-dependency Node.js CLI that statically maps LLM call sites and prompts to the eval files that appear to cover them.

Part of the Corteus AI due-diligence toolkit with [`wrapper-test`](https://github.com/corteus/wrapper-test), [`model-rot`](https://github.com/corteus/model-rot), and the methodology guide: [Technical due diligence checklist for AI startups](https://corteus.com/blog/technical-due-diligence-checklist-for-ai-startups).

## Why it exists

Code coverage is common. Eval coverage is not. An empirical study of 39 agent frameworks and 439 agentic applications found that agent-specific eval tooling and prompt-focused tests appear in roughly 1% of tests, leaving a critical blind spot in AI product quality: [arXiv:2509.19185](https://arxiv.org/abs/2509.19185).

`eval-audit` turns that blind spot into a concrete repo review question: which prompts and LLM call sites have eval evidence, and which ones are shipping uncovered?

## Install and usage

Run against a local repository:

```sh
npx eval-audit <path-to-repo>
```

Run from a checkout of this repo:

```sh
node bin/eval-audit.js <path-to-repo>
```

Print JSON:

```sh
npx eval-audit --json <path-to-repo>
```

Fail below a minimum call-site coverage threshold:

```sh
npx eval-audit --min-coverage 75 <path-to-repo>
```

The tool makes no network calls. It reads local text/source files only, skips common generated directories, and skips dotenv- and credential-like file names at the filesystem walk layer.

## What it scans

`eval-audit` discovers three surfaces:

| Surface | Static signals |
|---|---|
| LLM call sites | OpenAI chat completions and responses, Anthropic messages, Vercel AI SDK `generateText` and `streamText`, Google `generateContent`, `client.chat(...)`, and `.invoke(...)` on LLM-like identifiers. |
| Prompt definitions | Prompt-like string constants such as `systemPrompt`, `PROMPT`, and `instructions`; `.prompt` and `.txt` files in prompt directories; `prompts/*.md`; and chat template YAML. |
| Eval surface | Promptfoo config, DeepEval usage, `*.eval.(js\|ts\|py\|jsonl)`, `evals/` directories, golden JSONL datasets, and tests that import or exercise prompt/call-site modules. |

Coverage is mapped conservatively. A call site or prompt is counted as covered when an eval or test imports the same module, references the prompt name or prompt file path, or sits in a close sibling eval location. Uncertain matches remain uncovered.

## Verdict bands

| Verdict | Meaning |
|---|---|
| `No evals` | LLM call sites were found, but no eval surface was detected. |
| `Smoke only` | Evals exist, but fewer than 25% of LLM call sites appear covered. |
| `Partial coverage` | 25-75% of LLM call sites appear covered. |
| `Well covered` | More than 75% of LLM call sites appear covered. |
| `Gated in CI` | The repo is well covered and a GitHub Actions workflow appears to run evals. |

If no LLM call sites are found, the report says so and does not force a verdict.

## CI gating

The GitHub Actions check looks for workflow commands such as:

- `promptfoo eval`
- `deepeval`
- `node --test` over eval files or directories
- `pytest` over eval files or directories

This is a gating signal, not proof that the eval suite is meaningful or passing in production.

## Limitations

Static mapping approximates coverage. It cannot judge eval quality, whether assertions are meaningful, or whether the eval set represents production risk.

Dynamic prompt assembly is not traced. Prompts built from databases, feature flags, remote configuration, or runtime string composition can be missed.

The scanner under-claims by design. It may leave real coverage marked as uncovered when evidence is indirect, cross-process, or hidden behind custom tooling.

## Development

```sh
npm test
```

The test suite uses fixture repositories under `tests/fixtures`.
