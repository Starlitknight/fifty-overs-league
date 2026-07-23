// Generate a REAL snapshot of the Living World's first season, played through
// the actual match engine, for the in-client World Desk to render. Run offline
// (it plays ~1,100 real matches, ~1 min) and commit the JSON; the browser reads
// it instantly. When the live server tick lands, this same deterministic world
// is computed continuously instead of snapshotted.
//
//   node tools/build-world-snapshot.mjs [seed]
import { writeFileSync } from "node:fs";
import { makeEngine } from "../test/engine-vm.mjs";
import { newWorldState, advanceTo, leagueStandings } from "../engine/src/world/day.mjs";
import { wireForDay } from "../engine/src/world/wire.mjs";
import { makeWorldResultFn } from "../engine/src/world/match.mjs";
import { REGIONS, SEASON_DAYS, dayState } from "../engine/src/world/timeline.mjs";

const seed = (process.argv[2] | 0) || 2026;
const E = makeEngine();
const res = makeWorldResultFn(E);
const s = newWorldState(seed);

const t0 = Date.now();
const wire = [];
for (let d = 0; d < SEASON_DAYS; d++) {
  advanceTo(s, d, res);
  const w = wireForDay(s, d);
  if (w.headlines[0]) wire.push({ day: d, ...dayState(d), headline: w.headlines[0].headline, art: w.headlines[0].art, importance: w.headlines[0].importance });
}
console.error(`played season 0 (${Date.now() - t0}ms)`);

// de-duplicate the odd shared bot-club name for clean display
function dedupe(rows) {
  const seen = {};
  return rows.map(r => { const n = seen[r.name] = (seen[r.name] || 0) + 1; return n > 1 ? { ...r, name: r.name + " " + ("II III IV".split(" ")[n - 2] || n) } : r; });
}

const leagues = REGIONS.map(region => {
  const st = leagueStandings(s, 0, region.id);
  const L = s.leagues["0:" + region.id];
  const rows = dedupe(st.map(r => ({ id: r.id, name: L.byId[r.id].name, kind: L.byId[r.id].kind, P: r.P, W: r.W, L: r.L, T: r.T, pts: r.pts })));
  return { regionId: region.id, name: region.name, winner: rows[0].name, table: rows };
});

const cup = s.cups[0];
const teamNm = id => (cup.field.find(t => t.id === id) || {}).name || id;
const snapshot = {
  seed, season: 0, asOfDay: SEASON_DAYS - 1,
  leagues,
  cup: {
    champion: teamNm(cup.champion), runnerUp: teamNm(cup.runnerUp), third: teamNm(cup.third),
    groups: cup.groups.map(g => Object.values(g.table).sort((a, b) => b.pts - a.pts || b.W - a.W).map(r => ({ name: g.byId[r.id].name, pts: r.pts, W: r.W }))),
    bracket: {
      qf: cup.bracket.qf.map(t => ({ win: t.win.name, lose: t.lose.name })),
      sf: cup.bracket.sf.map(t => ({ win: t.win.name, lose: t.lose.name })),
      third: cup.bracket.third ? { win: cup.bracket.third.win.name, lose: cup.bracket.third.lose.name } : null,
      final: cup.bracket.final ? { win: cup.bracket.final.win.name, lose: cup.bracket.final.lose.name } : null
    }
  },
  wire
};

writeFileSync(new URL("../world-snapshot.json", import.meta.url), JSON.stringify(snapshot));
console.error(`wrote world-snapshot.json — champion: ${snapshot.cup.champion}, ${wire.length} headlines`);
