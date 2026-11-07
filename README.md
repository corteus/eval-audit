# eval-audit

`eval-audit` is a zero-dependency Node.js CLI that statically maps LLM call sites and prompts to the eval files that appear to cover them.

Part of the Corteus AI due-diligence toolkit with [`wrapper-test`](https://github.com/corteus/wrapper-test), [`model-rot`](https://github.com/corteus/model-rot), and the methodology guide: [Technical due diligence checklist for AI startups](https://corteus.com/blog/technical-due-diligence-checklist-for-ai-startups).

## Why it exists

Code coverage is common. Eval coverage is not. An empirical study of 39 agent frameworks and 439 agentic applications found that agent-specific eval tooling and prompt-focused tests appear in roughly 1% of tests, leaving a critical blind spot in AI product quality: [arXiv:2509.19185](https://arxiv.org/abs/2509.19185).

`eval-audit` turns that blind spot into a concrete repo review question: which prompts and LLM call sites have eval evidence, and which ones are shipping uncovered?

## Install and usage

Run against a local repository:

```sh
git clone https://github.com/corteus/eval-audit
cd eval-audit
node bin/eval-audit.js <path-to-repo>
```

Print JSON:

```sh
node bin/eval-audit.js --json <path-to-repo>
```

Raise the file limit for large monorepos (default 8000 readable files; the JSON reports `skipped.maxFiles` when the walk stopped early):

```sh
node bin/eval-audit.js --json --max-files 100000 <path-to-repo>
```

Fail below a minimum call-site coverage threshold:

```sh
node bin/eval-audit.js --min-coverage 75 <path-to-repo>
```

The tool makes no network calls. It reads local text/source files only, skips common generated directories, and skips dotenv- and credential-like file names at the filesystem walk layer.

## What it scans

`eval-audit` discovers three surfaces:

| Surface | Static signals |
|---|---|
| LLM call sites | OpenAI chat completions (`create`, `parse`, `stream`, legacy `ChatCompletion.create`) and responses, Anthropic messages (`create`, `stream`, `beta`), Vercel AI SDK `generateText`, `streamText`, `generateObject` and `streamObject`, Google `generateContent` and Python `generate_content`, LiteLLM `completion`/`acompletion`, Ollama `chat`/`generate`, Mistral `chat.complete`, `client.chat(...)`, LlamaIndex-style `llm.complete`/`achat`, and `.invoke(...)`/`.ainvoke(...)` on LLM-like receivers (`llm`, `model`, `chain`, `agent`, ...). Receiver-name patterns run on Python and JS/TS only. Mentions in comments and docstrings, Storybook stories and Twilio's `client.messages.create` are ignored. |
| Prompt definitions | Prompt-like string constants such as `systemPrompt`, `PROMPT`, and `instructions`; `.prompt` and `.txt` files in prompt directories; `prompts/*.md`; and chat template YAML. |
| Eval surface | Promptfoo config, DeepEval usage, imports of Inspect AI, Ragas, Braintrust/autoevals, LangSmith `evaluate`, openevals, evalite, vitest-evals, `@botpress/vai`, Phoenix evals, TruLens and `mlflow.evaluate`; Langfuse experiments (a Langfuse import plus `run_experiment`/`runExperiment`/`experiment.run`, `run_batched_evaluation`, or a dataset loop with the older `item.run(run_name=...)`/`item.link(...)`; tracing, prompts and scores alone do not count); `*.eval(s).(js\|ts\|py\|jsonl\|yaml)`, `eval_*.py`, `*_eval.py`; files under `eval/` or `evals/` directories; JSONL datasets under `eval/`, `evals/` or `golden/`. |
| Unit tests (reported separately) | Test files (`tests/`, `__tests__/`, `*.test.*`, `*.spec.*`, `test_*.py`) that import a call-site or prompt module. They usually mock the model, so they do not count towards the eval verdict. |

Coverage is mapped conservatively. A call site or prompt is counted as covered when an eval file imports the same module (relative imports, Python dotted imports resolved by a unique path suffix, and `@/`, `~/`, `$lib/` aliases), references the prompt name or prompt file path, or sits in a mirrored eval folder (`agent/x.py` and `evals/agent/y.py`). Imports are followed one level only. Uncertain matches remain uncovered.

Directories named `evaluation`/`evaluations` are not treated as evals, because that is a common product-feature name. Hidden directories (`.agents`, `.cursor`, `.qwen`, ...) are skipped; `.github/workflows` is read separately for CI.

## Verdict bands

| Verdict | Meaning |
|---|---|
| `No evals` | LLM call sites were found, but no eval surface was detected. |
| `Smoke only` | Evals exist, but fewer than 25% of LLM call sites appear covered. |
| `Partial coverage` | 25-75% of LLM call sites appear covered. |
| `Well covered` | More than 75% of LLM call sites appear covered. |
| `Gated in CI` | The repo is well covered and a GitHub Actions workflow appears to run evals. |

If no LLM call sites are found, the report says so and does not force a verdict.

JSON output also carries `verdictIncludingUnitTests` and `coverageIncludingUnitTests`, the 0.1.0 behaviour in which a unit test that imports an LLM module counts as coverage. Use it to see how much of a repo's apparent coverage comes from mocked tests.

## CI gating

The GitHub Actions check looks for workflow commands such as:

- `promptfoo eval` (including `npx promptfoo@<version> eval`) and the promptfoo GitHub Action
- `deepeval`, `inspect eval`, `braintrust eval`, `evalite`, `oaieval`
- the Langfuse experiment GitHub Action (`langfuse/experiment-action`)
- `npm|pnpm|yarn|bun run eval(s)`, `make eval(s)`, `python` scripts under `eval(s)/`
- `node --test` over eval files or directories
- `pytest` over eval files or directories

A command only gates when its workflow runs on `push`, `pull_request`, `pull_request_target` or `merge_group`. Commands in schedule-only or manual-only workflows are listed with their triggers but do not gate.

This is a gating signal, not proof that the eval suite is meaningful or passing in production.

## Limitations

Static mapping approximates coverage. It cannot judge eval quality, whether assertions are meaningful, or whether the eval set represents production risk.

Dynamic prompt assembly is not traced. Prompts built from databases, feature flags, remote configuration, or runtime string composition can be missed.

Langfuse is detected only where the SDK runs an experiment or an evaluation. Importing Langfuse, `@observe` tracing, prompt management and `create_score` calls stay uncovered, because most apps use them in production. A hand-written loop over a Langfuse dataset that only calls `create_score` is not counted either: it looks the same as an admin page that lists dataset items next to a user-feedback score.

The scanner under-claims by design. It may leave real coverage marked as uncovered when evidence is indirect, cross-process, or hidden behind custom tooling.

## Studies

- [Eval coverage in 30 open-source AI applications, 2026-11-01](studies/2026-11-01/README.md)

## Development

```sh
npm test
```

The test suite uses fixture repositories under `tests/fixtures`.
