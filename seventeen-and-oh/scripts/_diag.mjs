// Throwaway diagnostic: rating spread + data availability for pilot team-seasons.
import { readCsv } from "./lib/csv.mjs";
import { fromRoot, num } from "./lib/util.mjs";
import { STAT_COLUMNS } from "./lib/schema.mjs";

const ratings = readCsv(fromRoot("data", "processed", "ratings.csv"));
const ps = readCsv(fromRoot("data", "processed", "player_seasons.csv"));
const psByKey = new Map();
for (const p of ps) psByKey.set(`${p.player_id}|${num(p.season)}|${p.team_code}`, p);

const PILOT = [
  [1996, "NYG"], [1985, "CHI"], [1999, "STL"], [2000, "BAL"], [2007, "NE"],
  [2013, "SEA"], [2018, "KC"], [2020, "TB"], [2023, "SF"],
];

function median(a) { const s=[...a].sort((x,y)=>x-y); const n=s.length; return n? (n%2? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2):0; }
function mode(a){ const m={}; let best=null,bc=0; for(const v of a){m[v]=(m[v]||0)+1; if(m[v]>bc){bc=m[v];best=v;}} return {value:best,count:bc}; }

console.log("team      | n  | min | med | max | mode(cnt) | %@mode | gs✓ | stats✓ | awards✓ | statuses");
console.log("-".repeat(120));
for (const [season, tc] of PILOT) {
  const rows = ratings.filter((r) => num(r.season) === season && r.team_code === tc);
  if (!rows.length) { console.log(`${season} ${tc} — no rows`); continue; }
  const ovr = rows.map((r) => num(r.overall)).filter((v)=>v!=null);
  const md = mode(ovr);
  let gs=0, st=0, aw=0;
  const statusT={};
  for (const r of rows) {
    const p = psByKey.get(`${r.player_id}|${season}|${tc}`) || {};
    if (p.games_started!=="" && p.games_started!=null) gs++;
    if (STAT_COLUMNS.some((c)=>p[c]!=="" && p[c]!=null)) st++;
    if ((p.awards||"").trim()) aw++;
    statusT[r.status]=(statusT[r.status]||0)+1;
  }
  const n=rows.length;
  const sT=Object.entries(statusT).map(([k,v])=>`${k.replace("generated_","g_").replace("_confidence","")}=${v}`).join(" ");
  console.log(
    `${season} ${tc.padEnd(3)} | ${String(n).padStart(2)} | ${String(Math.min(...ovr)).padStart(3)} | ${String(median(ovr)).padStart(3)} | ${String(Math.max(...ovr)).padStart(3)} | ${String(md.value).padStart(2)}(${String(md.count).padStart(2)})    | ${String(Math.round(md.count/n*100)).padStart(3)}%  | ${String(Math.round(gs/n*100)).padStart(3)}%| ${String(Math.round(st/n*100)).padStart(4)}% | ${String(Math.round(aw/n*100)).padStart(5)}%  | ${sT}`
  );
}
