# Eval coverage in 30 open-source AI applications (2026-11-01)

The data behind the Corteus field note "We scanned 30 open-source AI apps for evals. None runs one on a pull request".

- `results.md`: method, full table, hand-check, limitations and observations. Start here.
- `data.csv`: one row per app, with the commit scanned. `selection.csv`: every repository examined, with the reason it was kept or skipped.
- `raw.tar.gz`: eval-audit JSON output for each app (the scan ran this release's code, labelled `0.2.0-study`).
  `raw-baseline.tar.gz`: output of the unmodified 0.1.0 on the same clones, for comparison.
- `sample_calls_round1.txt`, `sample_calls_round2.txt`: the hand-checked call-site samples.
- `tools/`: the selection search results, dependency check, hand-check notes and the scripts that build every number.

Nothing from the scanned repositories was executed or installed. A public repository without eval files does not prove a
team has no evals. If we got your project wrong, open an issue and we will correct it.
