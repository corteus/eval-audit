// Deterministic sample of call sites for precision hand-check: seeded LCG, n per run.
import fs from 'node:fs'; import path from 'node:path';
const [rawDir, repoDir, n] = process.argv.slice(2);
const all = [];
for (const f of fs.readdirSync(rawDir).filter(f=>f.endsWith('.json')).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(rawDir,f)));
  for (const c of j.callSites) all.push({ repo: f.replace('.json',''), ...c });
}
let seed = 20261101; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const picked = new Set(); while (picked.size < Math.min(Number(n), all.length)) picked.add(Math.floor(rnd()*all.length));
console.log('population', all.length);
for (const i of [...picked].sort((a,b)=>a-b)) {
  const c = all[i]; const lines = fs.readFileSync(path.join(repoDir, c.repo, c.file),'utf8').split('\n');
  console.log(`${i}\t${c.repo.slice(0,18)}\t${c.file.slice(-55)}:${c.line}\t${c.kind}\t| ${lines[c.line-1].trim().slice(0,90)}`);
}
