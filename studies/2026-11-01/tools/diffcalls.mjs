// usage: node diffcalls.mjs old.json new.json repoDir
import fs from 'node:fs';
const [a,b,repo]=process.argv.slice(2).map((x,i)=>i<2?JSON.parse(fs.readFileSync(x)):x);
const kb=new Set(b.callSites.map(c=>c.file+':'+c.line)), ka=new Set(a.callSites.map(c=>c.file+':'+c.line));
for (const [label,src,other] of [['removed',a,kb],['added',b,ka]]) for (const c of src.callSites) if(!other.has(c.file+':'+c.line)) {
  const line=fs.readFileSync(repo+'/'+c.file,'utf8').split('\n')[c.line-1].trim().slice(0,110);
  console.log(label, c.file+':'+c.line, '|', line);
}
