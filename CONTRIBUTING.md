# Contributing

`eval-audit` is intentionally small: zero runtime dependencies, no network calls, and static rules that should be easy to inspect in review.

## Development

```sh
npm test
```

Keep changes single-purpose. Tests should use fixture repositories under `tests/fixtures` when behavior depends on file layout, scanner rules, or coverage mapping heuristics.

## Scanner changes

Prefer conservative matches. An eval should cover a prompt or LLM call site only when the evidence is local and explainable: an import, a prompt name or path reference, or close file-path proximity. When a rule is uncertain, leave the target uncovered and add a fixture before broadening it.
