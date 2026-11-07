# Changelog

## Unreleased

### Eval-surface detection

- Added Langfuse experiments. A code file counts when it imports Langfuse (`langfuse`, `langfuse-node` or
  `@langfuse/*`) and also runs an experiment or an evaluation: `run_experiment`/`runExperiment` (on the client, a
  dataset, or the CI `RunnerContext`, called or passed as a reference), `langfuse.experiment.run(...)`,
  `run_batched_evaluation(...)`, or a fetched dataset whose items are run with the older Python v3
  `item.run(run_name=...)` or JS/TS v5 `item.link(span, run)`. Each pattern cites its Langfuse docs page in
  `src/discover.js`.
- A Langfuse import alone is tracing and stays `No evals`; so do prompt fetches, `create_score` feedback and dataset
  reads. Unit tests that mock the client are not counted.
- A file that calls `run_experiment` without importing Langfuse is not counted (many ML repos define their own
  `run_experiment`).

### CI gating

- Added the Langfuse experiment GitHub Action (`langfuse/experiment-action`).

### Tests

- Three fixture repos: `langfuse-python` (runner, v3 loop, the GitHub Action), `langfuse-ts` (`experiment.run`,
  `runExperiment`, v5 `item.link`) and `langfuse-tracing-only` (must stay `No evals`). 16 tests, all passing.

## 0.2.0 (2026-11-01)

Base: `corteus/eval-audit` at `b35a04a903a85f2c872ba849a1caaa23348d26ae` (0.1.0).
Patch: `eval-audit-improvements.patch` (applies cleanly to that commit; `npm test`: 13 tests, 13 pass, 0 fail).
Tests went from 7 to 13, with three new fixture repos: `python-app`, `ts-app` and `noise`.

## Changed meaning (read this first)

- **Unit tests no longer count as eval coverage.** In 0.1.0, any test that imported a module with an LLM call
  covered that call. Those tests almost always mock the model. The verdict now uses explicit eval files only.
  The 0.1.0 behaviour is still reported as `verdictIncludingUnitTests` and `coverageIncludingUnitTests`, and the
  unit tests involved are listed in `unitTests`. `schemaVersion` is now 2.
- **CI gating needs a push or PR trigger.** An eval command in a workflow that only runs on `schedule` or
  `workflow_dispatch` is listed with its `triggers`, but `gated` stays false.

## Call-site detection

- Added: OpenAI `chat.completions.parse/stream`, legacy `ChatCompletion.create`, `responses.parse/stream`;
  Anthropic `messages.stream`, `beta.messages`, and receivers such as `self.anthropic_client` or `request_client`;
  AI SDK `generateObject`/`streamObject`; Google Python `generate_content(_async|_stream)` and JS `generateContentStream`;
  LiteLLM `litellm.completion`/`acompletion`, plus bare `completion(` only in files that import it from litellm;
  Ollama `ollama.chat/generate`; Mistral `chat.complete`; LlamaIndex-style `llm.complete/achat/stream_chat`;
  LangChain `.ainvoke`, and snake_case receivers such as `structured_llm.invoke`.
- Removed false positives found during the study: mentions in comments, docstrings and inline code
  (hermes-agent had 16 of these in 0.1.0); class method declarations such as `async generateText(` (cherry-studio, Vane);
  Electron IPC `fetchModelList.invoke()` (AionUi); `client.invoke` on tool and RPC clients and `agents.invoke` on product
  APIs (dify, paperclip); Twilio `client.messages.create` (botpress); Rust `client.invoke` (qwen-code);
  Storybook `*.stories.*` files.
- Receiver-name patterns (`client.chat`, `llm.invoke`, `llm.complete`) now run on Python and JS/TS only.
- One call site per line, so overlapping patterns cannot double-count a line.

## Eval-surface detection

- Added framework imports: Inspect AI, Ragas, Braintrust/autoevals, LangSmith `evaluate`/`langsmith.evaluation`,
  openevals, evalite, vitest-evals, Phoenix evals, TruLens, `mlflow.evaluate`, and `@botpress/vai`. `@botpress/vai`
  was added after the hand-check found real LLM-assertion evals in botpress.
- Added file names: `*.evals.*`, `*.eval.yaml`, `eval_*.py`, `*_eval.py`, `*_evals.py`. Also added `test_*.py` and
  `*_test.py` as unit tests.
- Removed: `evaluation/` and `evaluations/` directories no longer count as evals. In this study they were always product
  features (FastGPT, prompt-optimizer, open-webui). JSONL under generic `fixtures/` no longer counts as a golden dataset
  (cherry-studio, AutoGPT, suna).
- Hidden directories (`.agents`, `.qwen`, `.cursor`, ...) are skipped. They held coding-agent tooling with its own
  `evals/` folders (paperclip, qwen-code, suna). `.github/workflows` is still read for CI.

## Coverage mapping

- Python imports: relative imports (`from .x import`), submodule imports (`from pkg import module`), and dotted
  imports resolved to `src/`- or `backend/`-style layouts by a unique path-suffix match.
- TS/JS path aliases `@/`, `~/` and `$lib/`, resolved against each enclosing `package.json`/`tsconfig.json` root.
- Path proximity is tightened. Once eval/test folder names are removed, the eval's folder must end with the
  target's last two folder names (`agent/x.py` and `evals/agent/y.py`). In 0.1.0 a shared folder name anywhere was enough,
  which let `evals/compaction/scripts/` cover `optional-skills/.../scripts/` in hermes-agent, and
  `onyx/evals/providers/` cover `onyx/image_gen/providers/` in onyx.
- Imports are still followed one level only. This is deliberate, and it is the main reason the tool under-claims.

## CLI and output

- `--max-files N` (default still 8000). In 0.1.0, 8 of the 30 study repos stopped at 8000 files.
- `toolVersion`, `verdictIncludingUnitTests`, `coverageIncludingUnitTests`, `unitTests`,
  `summary.unitTestFilesTouchingTargets`, and `ci.commands[].triggers/gating`.
- New CI patterns: `npx promptfoo@<ver> eval`, the promptfoo action, `inspect eval`, `braintrust eval`, `evalite`,
  `oaieval`, `npm|pnpm|yarn|bun run eval(s)`, `make eval(s)`, and `python` scripts under `eval(s)/`.
