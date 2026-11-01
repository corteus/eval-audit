import fs from 'node:fs'; import path from 'node:path';
const base = process.argv[2];
const meta = Object.fromEntries(fs.readFileSync(path.join(base,'tools/meta.tsv'),'utf8').trim().split('\n').slice(1).map(l=>l.split('\t')).map(r=>[r[0],{lang:r[1],url:r[2],http:r[3],sha:r[4],commitDate:r[5],stars:Number(r[6]),pushed:r[7]}]));
const hand = JSON.parse(fs.readFileSync(path.join(base,'tools/handcheck.json'),'utf8'));
const rows = [];
for (const repo of Object.keys(meta)) {
  const f = repo.replace('/','_')+'.json';
  const j = JSON.parse(fs.readFileSync(path.join(base,'raw',f)));
  const b = JSON.parse(fs.readFileSync(path.join(base,'raw-baseline',f)));
  const evalTypes = {}; for (const e of j.evals) evalTypes[e.type]=(evalTypes[e.type]||0)+1;
  rows.push({ repo, ...meta[repo], j, b,
    verdict: j.verdict ?? 'no verdict (0 call sites)', calls: j.coverage.totalCallSites, covered: j.coverage.coveredCallSites, pct: j.coverage.percentage,
    evalFiles: j.summary.evalFilesFound, evalTypes: Object.entries(evalTypes).map(([k,v])=>`${k}:${v}`).join(' '),
    unitTests: j.summary.unitTestFilesTouchingTargets, coveredLoose: j.coverageIncludingUnitTests.coveredCallSites, pctLoose: j.coverageIncludingUnitTests.percentage,
    verdictLoose: j.verdictIncludingUnitTests ?? 'no verdict', ciCmds: j.ci.commands.length, ciGated: j.ci.gated,
    ciTriggers: [...new Set(j.ci.commands.flatMap(c=>c.triggers))].join(' '),
    prompts: j.summary.promptsFound, promptsCovered: j.summary.promptsFound - j.summary.orphanedPrompts,
    files: j.summary.filesScanned, truncated: j.summary.skipped.maxFiles,
    bVerdict: b.verdict ?? 'no verdict', bCalls: b.coverage.totalCallSites, bPct: b.coverage.percentage, bTrunc: b.summary.skipped.maxFiles, bFiles: b.summary.filesScanned,
    hand: hand[repo] });
}
// CSV
const csvCols = [['repo','repo'],['language','lang'],['url','url'],['url_http_status','http'],['commit_sha','sha'],['commit_date','commitDate'],['stars_at_scan','stars'],['files_scanned','files'],['walk_truncated','truncated'],
 ['verdict','verdict'],['llm_call_sites','calls'],['call_sites_covered_by_evals','covered'],['eval_coverage_pct','pct'],['explicit_eval_files','evalFiles'],['eval_file_types','evalTypes'],
 ['ci_eval_commands','ciCmds'],['ci_eval_triggers','ciTriggers'],['ci_gated','ciGated'],['unit_test_files_touching_llm_code','unitTests'],['call_sites_covered_incl_unit_tests','coveredLoose'],['coverage_incl_unit_tests_pct','pctLoose'],['verdict_incl_unit_tests','verdictLoose'],
 ['prompts_found','prompts'],['prompts_covered_by_evals','promptsCovered'],
 ['v010_verdict','bVerdict'],['v010_call_sites','bCalls'],['v010_coverage_pct','bPct'],['v010_walk_truncated_at_8000','bTrunc']];
const q = v => { const s = v===null||v===undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
let csv = [...csvCols.map(c=>c[0]),'hand_checked','hand_check_evals_exist','hand_check_result','hand_check_note'].join(',')+'\n';
for (const r of rows) csv += [...csvCols.map(c=>q(r[c[1]])), r.hand?'yes':'no', q(r.hand?.[0]), q(r.hand?.[1]), q(r.hand?.[2])].join(',')+'\n';
fs.writeFileSync(path.join(base,'data.csv'), csv);
// Markdown pieces
const out = [];
const short = s => s.slice(0,7);
out.push('| # | Repo | Lang | Stars | Commit | Verdict | Call sites | Covered by evals | Eval cov. | Eval files | CI eval cmd / gated | Incl. unit tests | Hand-checked |');
out.push('|---|---|---|---:|---|---|---:|---:|---:|---:|---|---:|---|');
rows.forEach((r,i)=> out.push(`| ${i+1} | [${r.repo}](${r.url}) | ${r.lang==='Python'?'Py':'TS'} | ${r.stars.toLocaleString('en-US')} | \`${short(r.sha)}\` | ${r.verdict} | ${r.calls} | ${r.covered} | ${r.pct===null?'n/a':r.pct+'%'} | ${r.evalFiles} | ${r.ciCmds} / ${r.ciGated?'yes':'no'} | ${r.pctLoose===null?'n/a':r.pctLoose+'%'} | ${r.hand?r.hand[1]:'-'} |`));
const count = (key) => { const m={}; for (const r of rows) m[r[key]]=(m[r[key]]||0)+1; return m; };
const median = a => { const s=[...a].sort((x,y)=>x-y); const n=s.length; return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2; };
const withV = rows.filter(r=>r.pct!==null);
const stats = {
  repos: rows.length, python: rows.filter(r=>r.lang==='Python').length, ts: rows.filter(r=>r.lang==='TypeScript').length,
  verdicts: count('verdict'), verdictsLoose: count('verdictLoose'), verdictsV010: count('bVerdict'),
  reposWithVerdict: withV.length,
  medianEvalPct: median(withV.map(r=>r.pct)), medianLoosePct: median(withV.map(r=>r.pctLoose)),
  meanEvalPct: Math.round(withV.reduce((a,r)=>a+r.pct,0)/withV.length*10)/10,
  totalCalls: rows.reduce((a,r)=>a+r.calls,0), totalCovered: rows.reduce((a,r)=>a+r.covered,0), totalCoveredLoose: rows.reduce((a,r)=>a+r.coveredLoose,0),
  reposWithAnyEvalFile: rows.filter(r=>r.evalFiles>0).length,
  reposWithAnyCoveredCall: rows.filter(r=>r.covered>0).length,
  reposWithUnitTestsTouching: rows.filter(r=>r.unitTests>0).length,
  reposWithCiEvalCmd: rows.filter(r=>r.ciCmds>0).map(r=>r.repo), reposCiGated: rows.filter(r=>r.ciGated).map(r=>r.repo),
  medianCalls: median(rows.map(r=>r.calls)), minCalls: Math.min(...rows.map(r=>r.calls)), maxCalls: Math.max(...rows.map(r=>r.calls)),
  reposCallsLe3: rows.filter(r=>r.calls<=3).map(r=>`${r.repo} (${r.calls})`),
  truncatedV010: rows.filter(r=>r.bTrunc).map(r=>r.repo), truncatedNow: rows.filter(r=>r.truncated).map(r=>r.repo),
  maxFiles: Math.max(...rows.map(r=>r.files)),
  commitDates: [rows.map(r=>r.commitDate).sort()[0], rows.map(r=>r.commitDate).sort().at(-1)],
  starsRange: [Math.min(...rows.map(r=>r.stars)), Math.max(...rows.map(r=>r.stars))],
  http: count('http'),
  toolVersions: [...new Set(rows.map(r=>r.j.toolVersion))], schema: [...new Set(rows.map(r=>r.j.schemaVersion))],
  byLang: Object.fromEntries(['Python','TypeScript'].map(l=>[l, (()=>{const m={}; for(const r of rows.filter(r=>r.lang===l)) m[r.verdict]=(m[r.verdict]||0)+1; return m;})()]))
};
fs.writeFileSync(path.join(base,'tools/table.md'), out.join('\n')+'\n');
fs.writeFileSync(path.join(base,'tools/stats.json'), JSON.stringify(stats,null,1));
console.log(JSON.stringify(stats,null,1));
