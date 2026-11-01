# Eval coverage in 30 open-source AI applications: data and methods note

Scan date: 2026-11-01. Tool: eval-audit 0.2.0-study (`corteus/eval-audit` at `b35a04a`, plus `eval-audit-improvements.patch`), Node v26.4.0.
This is the data and the method behind a possible post, not the post itself. Every number below comes from the saved JSON in `raw/` (0.2.0-study) or `raw-baseline/` (unmodified 0.1.0). `tools/build_results.mjs` derives the numbers into `data.csv` and `tools/stats.json`. Hand-check judgements are in `tools/handcheck.json` and are repeated in `data.csv`.

## Headline

- 30 apps (15 Python, 15 TypeScript), stars 14,973 to 259,424.
- **0 of 30 are "Well covered" or "Gated in CI".** 17 are No evals, 11 Smoke only, 1 Partial coverage (hermes-agent, 60.9%). 1 gets no verdict because the scanner found no LLM call sites (open-webui calls models over raw HTTP).
- Median eval coverage of LLM call sites: **0%** across the 29 repos with a verdict (mean 3.0%). Across all repos, 18 of 318 call sites (5.7%) link to an eval file.
- 12 of 30 repos contain at least one explicit eval file. Only 5 have an eval file that links statically to an LLM call site.
- 1 repo runs a recognised eval command in CI (paperclip, in a weekly or manual workflow). None runs one on push or pull request. qwen-code's post-merge and nightly e2e job, which includes live-model tests, is not a recognised eval command.
- If unit tests that import LLM code are counted (the tool's 0.1.0 rule), the picture flips: 19 "Well covered", median 91.7%, and 238 of 318 call sites (74.8%) covered. In the repos we opened (AstrBot, paperless-ngx), those tests mock the model. Which of these two rules the study uses decides the headline.
- Hand-check of 23 repos: the "do evals exist in this repo?" answer was right for 19 of the 22 with a verdict (1 false positive, 2 false negatives). The coverage percentage under-claims wherever evals exercise prompts or whole pipelines rather than importing the module that holds the SDK call.

## Method

### Selection rule (mechanical, logged in `selection.csv`)

1. GitHub search API, run 2026-11-01: `topic:llm language:<Python|TypeScript> stars:>8000 pushed:>2026-08-03 archived:false fork:false`, sorted by stars. This returned 117 Python and 53 TypeScript repos. "Language" is GitHub's primary-language field, so several TypeScript-primary apps have Python backends.
2. Walk each list in star order and take the first 15 repos that pass both tests:
   - **Application test.** The repo's description or README opening describes something an end user runs to get a job done (chat app, assistant, agent product, generator, knowledge base, bot, app platform with its own UI). Excluded: libraries, frameworks, SDKs, inference/serving/training, memory/RAG/data infrastructure, gateways/proxies, MCP servers, eval/observability tools, tutorials, books, lists, skill collections. This test is a judgement. Every decision and its reason is in `selection.csv`.
   - **LLM SDK test.** At least one manifest (`pyproject.toml`, `setup.*`, `requirements*.txt`, `package.json`, up to 5 folders deep) declares an LLM client: openai, anthropic, litellm, langchain*, llama-index*, google-genai/generativeai, ollama, mistralai, cohere, groq, dashscope, zhipuai, instructor, pydantic-ai, the AI SDK (`ai`, `@ai-sdk/*`), `@langchain/*` or `@google/genai`. The point is that the scanner can see the calls at all.
3. Python: ranks 1 to 51 examined, 36 excluded (35 not applications, 1 application without an SDK dependency). TypeScript: ranks 1 to 34 examined, 19 excluded (14 not applications, 5 applications without an SDK dependency: OpenHands, oh-my-pi, repomix, hypit, opcode).

All 30 repository URLs returned HTTP 200 on 2026-11-01. Stars were read from the GitHub API when the repos were cloned. Commits are the default-branch HEAD of a shallow clone, with commit dates from 2026-09-01 to 2026-11-01 (UTC). Full SHAs are in `data.csv`.

### Scanning

- `node eval-audit/bin/eval-audit.js --json --max-files 100000 repos/<repo>` for each repo. No repo hit the file limit (largest: 18,913 readable files). Raw output is in `raw/<owner>_<repo>.json`.
- The cloned repos were treated as data. Nothing from them was executed or installed, and dotenv/credential-like files are skipped by the scanner's file walk.
- **Verdict rule (0.2.0-study).** A call site is covered when an explicit eval file imports its module directly, or sits in a mirrored eval folder. Explicit eval files are eval/evals folders, `*.eval.*` or `*_eval.py` names, promptfoo, DeepEval, an eval-framework import, or golden JSONL under eval folders. Bands as in the README: No evals, Smoke only (<25%), Partial (25 to 75%), Well covered (>75%), Gated in CI (well covered and a push/PR workflow runs an eval command).
- **What 0.1.0 could not see, and what was changed.** It missed LiteLLM, Python Gemini (`generate_content`), `ainvoke`, Anthropic `stream`/`beta` and named receivers, `generateObject`/`streamObject`, Inspect AI, Ragas, Braintrust, LangSmith evaluators, Python `*_eval.py` names, and `src/`-layout or `@/` alias imports. It also counted unit tests as evals, treated product folders named `evaluation/` and test fixtures as eval suites, counted comments and docstrings as calls, and stopped at 8,000 files (8 of the 30 repos). Details are in `CHANGELOG-eval-audit.md`. The patch adds 6 tests (13 total, all passing), and applying it to `b35a04a` reproduces the study tool byte for byte.
- **Fixes made during the study, then everything rerun.** From the hand-check: the path-proximity rule (hermes, onyx), CI triggers (paperclip), Twilio and `@botpress/vai` (botpress). From reviewing call-site lists: IPC/RPC `.invoke` false positives (AionUi, dify, paperclip). From the first precision sample: method declarations and docstrings (cherry-studio, Vane, hermes). All 30 repos were rescanned after the last change.

### Baseline for comparison

Unmodified 0.1.0, same clones, default settings: 17 Well covered, 7 Partial, 2 Smoke only, 1 No evals, 3 no verdict (`raw-baseline/`). 8 of those scans stopped at the 8,000-file limit, so the baseline is shown for contrast only.

## Results (all 30 repos)

"Covered by evals" and "Eval cov." use explicit eval files only. "Incl. unit tests" is the 0.1.0-style figure that also counts test files importing the module. "CI eval cmd / gated" is the number of eval commands found in workflows, and whether any of them runs on push or PR.

| # | Repo | Lang | Stars | Commit | Verdict | Call sites | Covered by evals | Eval cov. | Eval files | CI eval cmd / gated | Incl. unit tests | Hand-checked |
|---|---|---|---:|---|---|---:|---:|---:|---:|---|---:|---|
| 1 | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | Py | 259,424 | `c7c7e0f` | Partial coverage | 23 | 14 | 60.9% | 229 | 0 / no | 82.6% | correct |
| 2 | [Significant-Gravitas/AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) | Py | 187,855 | `ef7f41c` | Smoke only | 26 | 1 | 3.8% | 65 | 0 / no | 96.2% | correct band, weak mapping |
| 3 | [langgenius/dify](https://github.com/langgenius/dify) | Py | 160,163 | `a79e211` | No evals | 1 | 0 | 0% | 0 | 0 / no | 100% | correct, thin denominator |
| 4 | [open-webui/open-webui](https://github.com/open-webui/open-webui) | Py | 157,463 | `f7ac7ee` | no verdict (0 call sites) | 0 | 0 | n/a | 0 | 0 / no | n/a | no verdict (call sites missed) |
| 5 | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | Py | 140,422 | `32e5efe` | No evals | 8 | 0 | 0% | 0 | 0 / no | 100% | correct |
| 6 | [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | Py | 137,122 | `4318f3a` | No evals | 2 | 0 | 0% | 0 | 0 / no | 100% | - |
| 7 | [bytedance/deer-flow](https://github.com/bytedance/deer-flow) | Py | 84,833 | `08f343f` | Smoke only | 15 | 0 | 0% | 17 | 0 / no | 86.7% | correct |
| 8 | [ZhuLinsen/daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) | Py | 67,390 | `db0570e` | Smoke only | 10 | 1 | 10% | 5 | 0 / no | 100% | correct band, incidental mapping |
| 9 | [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar) | Py | 63,345 | `946f52a` | No evals | 7 | 0 | 0% | 0 | 0 / no | 42.9% | - |
| 10 | [zhayujie/CowAgent](https://github.com/zhayujie/CowAgent) | Py | 47,732 | `abe84b5` | Smoke only | 6 | 0 | 0% | 3 | 0 / no | 100% | correct |
| 11 | [paperless-ngx/paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) | Py | 47,510 | `5b63c9a` | No evals | 1 | 0 | 0% | 0 | 0 / no | 100% | correct |
| 12 | [AstrBotDevs/AstrBot](https://github.com/AstrBotDevs/AstrBot) | Py | 45,497 | `a6c2b31` | No evals | 9 | 0 | 0% | 0 | 0 / no | 100% | correct |
| 13 | [HKUDS/Vibe-Trading](https://github.com/HKUDS/Vibe-Trading) | Py | 37,361 | `78fab6b` | Smoke only | 10 | 0 | 0% | 12 | 0 / no | 100% | correct |
| 14 | [onyx-dot-app/onyx](https://github.com/onyx-dot-app/onyx) | Py | 33,145 | `3eb6420` | Smoke only | 21 | 1 | 4.8% | 23 | 0 / no | 95.2% | under-claims coverage |
| 15 | [Fosowl/agenticSeek](https://github.com/Fosowl/agenticSeek) | Py | 27,596 | `4f5f924` | No evals | 12 | 0 | 0% | 0 | 0 / no | 91.7% | - |
| 16 | [paperclipai/paperclip](https://github.com/paperclipai/paperclip) | TS | 109,801 | `1a6017d` | Smoke only | 2 | 0 | 0% | 56 | 6 / no | 0% | correct by definition, misleading denominator |
| 17 | [CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio) | TS | 53,159 | `db125b2` | Smoke only | 15 | 0 | 0% | 1 | 0 / no | 60% | false positive |
| 18 | [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) | TS | 40,229 | `3ff8e8c` | No evals | 25 | 0 | 0% | 0 | 0 / no | 100% | correct |
| 19 | [ItzCrazyKns/Vane](https://github.com/ItzCrazyKns/Vane) | TS | 37,943 | `348feca` | No evals | 9 | 0 | 0% | 0 | 0 / no | 0% | correct |
| 20 | [DayuanJiang/next-ai-draw-io](https://github.com/DayuanJiang/next-ai-draw-io) | TS | 36,542 | `c9dc5f5` | No evals | 3 | 0 | 0% | 0 | 0 / no | 66.7% | - |
| 21 | [iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi) | TS | 33,973 | `11cd2a9` | No evals | 5 | 0 | 0% | 0 | 0 / no | 0% | correct after fix |
| 22 | [labring/FastGPT](https://github.com/labring/FastGPT) | TS | 29,967 | `42204a9` | No evals | 2 | 0 | 0% | 0 | 0 / no | 100% | correct, thin denominator |
| 23 | [QwenLM/qwen-code](https://github.com/QwenLM/qwen-code) | TS | 28,857 | `e3c7a6d` | No evals | 11 | 0 | 0% | 0 | 0 / no | 81.8% | false negative |
| 24 | [dyad-sh/dyad](https://github.com/dyad-sh/dyad) | TS | 22,147 | `0ec8cc2` | Smoke only | 12 | 1 | 8.3% | 82 | 0 / no | 100% | under-claims coverage |
| 25 | [kortix-ai/suna](https://github.com/kortix-ai/suna) | TS | 20,344 | `ae91d6f` | Smoke only | 10 | 0 | 0% | 5 | 0 / no | 30% | correct |
| 26 | [ahmedkhaleel2004/gitdiagram](https://github.com/ahmedkhaleel2004/gitdiagram) | TS | 18,673 | `7876ab0` | No evals | 19 | 0 | 0% | 0 | 0 / no | 26.3% | false negative |
| 27 | [rowboatlabs/rowboat](https://github.com/rowboatlabs/rowboat) | TS | 18,114 | `c6091a9` | No evals | 19 | 0 | 0% | 0 | 0 / no | 52.6% | - |
| 28 | [Anionex/banana-slides](https://github.com/Anionex/banana-slides) | TS | 15,931 | `595f95f` | No evals | 18 | 0 | 0% | 0 | 0 / no | 77.8% | - |
| 29 | [NanmiCoder/cc-haha](https://github.com/NanmiCoder/cc-haha) | TS | 15,261 | `4980cce` | No evals | 6 | 0 | 0% | 0 | 0 / no | 100% | - |
| 30 | [botpress/botpress](https://github.com/botpress/botpress) | TS | 14,973 | `27f5f88` | Smoke only | 11 | 0 | 0% | 7 | 0 / no | 27.3% | correct band after fix |

### Summary counts (from `tools/stats.json`)

| | Python (15) | TypeScript (15) | All (30) |
|---|---:|---:|---:|
| No evals | 7 | 10 | 17 |
| Smoke only (<25%) | 6 | 5 | 11 |
| Partial coverage (25 to 75%) | 1 | 0 | 1 |
| Well covered (>75%) | 0 | 0 | 0 |
| Gated in CI | 0 | 0 | 0 |
| No verdict (0 call sites found) | 1 | 0 | 1 |

- LLM call sites per repo: median 10, range 0 to 26. 7 repos have 3 or fewer (dify 1, paperless-ngx 1, MoneyPrinterTurbo 2, paperclip 2, FastGPT 2, next-ai-draw-io 3, open-webui 0). For those, the percentage says very little.
- Unit tests that import LLM code (call sites or prompts) exist in 28 of 30 repos.
- Verdicts if unit tests count (0.1.0 rule, same scan): 19 Well covered, 7 Partial, 2 Smoke only, 1 No evals, 1 no verdict.

## Hand-check

23 repos were checked by opening files: every repo with an eval verdict above No evals (12), 10 of the 17 No evals repos, and the one with no verdict. The eval-like file-name sweep covered all 17 No evals repos. Repo-by-repo notes are in `data.csv` (`hand_check_*` columns).

**Do evals exist in the repo? (tool vs. files)**

| | Count | Repos |
|---|---:|---|
| Tool says evals exist, and they do | 11 | hermes-agent, AutoGPT, onyx, dyad, botpress, paperclip, deer-flow, Vibe-Trading, CowAgent, daily_stock_analysis, suna |
| Tool says evals exist, they don't (false positive) | 1 | cherry-studio: its only "eval" is a bundled skill-creator `run_eval.py` that tests skill triggering, not the app |
| Tool says No evals, and none found | 8 | dify, Vane, prompt-optimizer, FastGPT, AstrBot, paperless-ngx, AionUi, graphify (graphify publishes benchmark results from a harness that is not in the repo) |
| Tool says No evals, but evals exist (false negative) | 2 | gitdiagram: LLM-judge harnesses in `experiments/*/judge.ts`, and 12 of its 19 counted call sites are those judges. qwen-code: terminal-bench and live-model integration tests, and `docs/evaluation.md` publishes SWE-bench Verified scores |
| No verdict | 1 | open-webui: model calls go through aiohttp, so 0 call sites were found |

That is 19 of 22 correct among repos with a verdict, or 19 of 23 if open-webui counts as a miss.

**Is the coverage number right?** Mostly it is a lower bound.
- Under-claims: onyx's Braintrust evals import the whole chat pipeline (`onyx.chat.process_message`). dyad's LLM-judged suite runs production system prompts against the model directly. botpress's `@botpress/vai` e2e evals reach zai through a helper. In all three the evals reach the LLM call indirectly, and the tool follows imports one level only.
- Evals that live elsewhere: AutoGPT's `copilot/eval` says its scorers sit in a separate public repo, [Significant-Gravitas/AgentProbe](https://github.com/Significant-Gravitas/AgentProbe). paperclip's weekly workflow checks out `paperclipai/paperclip-evals`, which is not publicly reachable (HTTP 404).
- Weak or incidental links: AutoGPT's single covered call site is matched by folder proximity only. daily_stock_analysis's single covered call site (`src/config.py`) is linked because the eval imports config.
- Granularity: in hermes-agent, 10 of the 14 covered call sites sit in one large module (`agent/auxiliary_client.py`) imported by 9 eval files. Several of those files are HTTP contract probes rather than quality evals. Coverage counts modules, not individual calls.

**Call-site precision.** Seeded random samples of 40 call sites were checked line by line (`sample_calls_round1.txt`, `sample_calls_round2.txt`).
- Round 1 (population 334): 3 false positives (2 method declarations, 1 docstring). They were fixed and everything was rerun.
- Round 2 (final scan, population 318): **36 of 40 real calls.** The 4 false positives were botpress `public abstract generateText(` (an abstract method declaration) and three code samples inside a docs UI string in suna (`gateway-api-reference.tsx`).
- 4 of the 36 real calls go through an app's own wrapper (e.g. `self.client.chat(messages)` in TrendRadar, `executor.streamText` in cherry-studio). Those were counted as calls.
- 1 sampled call was in gitdiagram's eval harness rather than product code.

## Limitations

- **Static analysis only.** No code was run. The tool sees SDK-shaped calls. It misses raw HTTP (open-webui), in-house runtimes (dify's `invoke_llm`) and agent CLIs that a product drives (paperclip). A mapping means "an eval file imports the module or sits in its mirrored folder", not "this call is evaluated".
- **One import hop.** Evals that drive a pipeline or an entry point are under-counted. Following imports transitively would raise coverage, but would also start crediting every eval with the whole codebase.
- **Dynamic prompts.** Prompts built at runtime, from databases or from config are not traced. Prompt counts are in the JSON but are noisy (any `*Template` or `*prompt` variable), so the study does not rely on them.
- **Private eval suites.** A public repo without eval files does not prove a team has no evals. AutoGPT and paperclip show eval code living in other repos, and qwen-code and graphify publish benchmark results whose harness is mostly elsewhere. This study measures public, in-repo eval evidence only.
- **Monorepos.** Call sites in examples, scripts, optional skills or experiment folders count the same as product code. For example, hermes-agent's optional skills and gitdiagram's `experiments/` judges are counted as call sites. TS workspace-package imports (`@scope/pkg/...`) are not resolved.
- **Definitions are ours.** "Application" is a judgement (logged per repo). "Eval" means an explicit eval surface; a mocked unit test is not one. Someone who counts unit tests gets the 0.1.0-style column instead, and the headline changes completely.
- **One snapshot.** One commit per repo on one day. Shallow clones, primary-language labels from GitHub, and a stars window of 8,000 or more with a push in the last 90 days.
- **The tool was tuned on this data.** Several fixes came from this sample (listed above). Each is a general rule with a fixture test, but a fresh sample is the right check before quoting precision as a property of the tool.

## Observations a founder or engineering lead can act on

1. **Name your eval suite and put it where people look.** gitdiagram's LLM-judge harnesses sit in `experiments/`, and qwen-code's terminal-bench test sits among integration tests, so the scanner found neither. Static tools, new hires and due-diligence reviewers find an `evals/` folder with a runner and a README, and miss the rest. Even where eval files were found, only 5 of 12 repos link one to an LLM call site, and none runs its evals on a pull request.
2. **A green test suite is not an eval suite.** In 28 of 30 apps, unit tests import LLM code, and counting them turns 0 "Well covered" verdicts into 19. The ones we opened check plumbing with a mocked model. Ask which tests call a real model, or a recorded one, and judge the output.
3. **Run at least one eval on every pull request.** The only CI eval run found is a weekly or manual workflow (paperclip). A small fixed set of cases from the existing harness, run on PRs that touch prompts or model code, catches the regressions a weekly run finds too late. qwen-code says its e2e job is kept out of the merge queue because it is flaky, which is a reason to make that subset small and stable.
4. **Point evals at the code that ships.** Some suites call the model themselves: dyad's evals import production prompts and tools but call `generateText` directly, and paperclip's promptfoo suite reads its own prompt file. A change to the product's call path (model, parameters, parsing, retries) is invisible to them. Have evals call the same function the product calls, and drive the real pipeline where you can, as onyx does.
5. **If your evals live in another repo, say so in this one.** AutoGPT points to AgentProbe from its eval package. paperclip's eval repo is not public. A short note in the README with what is evaluated, how often and where saves every outside reviewer from concluding there are no evals.

## Files

- `results.md` (this file) and `data.csv` (one row per repo, all columns).
- `selection.csv`: every repo examined, in star order, with its decision and reason.
- `raw/*.json`: eval-audit 0.2.0-study output. `raw-baseline/*.json`: unmodified 0.1.0 output.
- `eval-audit-improvements.patch` and `CHANGELOG-eval-audit.md`: the tool changes. `eval-audit/` is the patched clone. `eval-audit-v0.1.0-pristine/` is the unmodified clone.
- `sample_calls_round1.txt` and `sample_calls_round2.txt`: the call-site precision samples.
- `tools/`: search results, the dependency check (`deps.py`, `deps.json`), metadata (`meta.tsv`), hand-check notes (`handcheck.json`) and the scripts that build the CSV, table and stats.
- `repos/`: the shallow clones (data only; 42 cloned, 30 scanned).
