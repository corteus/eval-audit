import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2];
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir,f)));
  const kinds = {}; for (const c of j.callSites) kinds[c.kind]=(kinds[c.kind]||0)+1;
  const et = {}; for (const e of j.evals) et[e.type]=(et[e.type]||0)+1;
  console.log([f.replace('.json','').padEnd(34), (j.verdict||'-').padEnd(16), `${j.coverage.coveredCallSites}/${j.coverage.totalCallSites}`.padEnd(9), String(j.coverage.percentage).padEnd(5), 'files', j.summary.filesScanned, j.summary.skipped.maxFiles?'TRUNC':'', 'ci', j.ci.gated, JSON.stringify(et), JSON.stringify(kinds)].join(' '));
}
