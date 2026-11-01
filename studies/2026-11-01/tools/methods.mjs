import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2];
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir,f)));
  const strict={}, loose={};
  for (const c of j.callSites) {
    if (c.covered) { const m=[...new Set(c.coverage.map(r=>r.method))].sort().join('+'); strict[m]=(strict[m]||0)+1; }
    else if (c.coveredIncludingUnitTests) { const m=[...new Set(c.unitTestCoverage.map(r=>r.method))].sort().join('+'); loose[m]=(loose[m]||0)+1; }
  }
  console.log(f.replace('.json','').padEnd(32), 'eval:', JSON.stringify(strict), ' unit-only:', JSON.stringify(loose));
}
