// Generate a REAL snapshot of the Living World's first season, played through
// the actual match engine, for the in-client World Desk to render. Run offline
// (it plays a full season through the real engine, ~1 min) and commit the JSON;
// the browser reads it instantly. When the live server tick lands, this same
// deterministic world is computed continuously instead of snapshotted.
//
//   node tools/build-world-snapshot.mjs [seed]
import { writeFileSync } from "node:fs";
import { makeEngine } from "../test/engine-vm.mjs";
import { newWorldState, advanceTo, leagueStandings } from "../engine/src/world/day.mjs";
import { wireForDay } from "../engine/src/world/wire.mjs";
import { makeWorldResultFn, materialiseSquad } from "../engine/src/world/match.mjs";
import { REGIONS, THORNE_ID, SEASON_DAYS, dayState, rng, hash32 } from "../engine/src/world/timeline.mjs";

const seed = (process.argv[2] | 0) || 2026;
const E = makeEngine();
const res = makeWorldResultFn(E);
const s = newWorldState(seed);

const t0 = Date.now();
const wire = [];
for (let d = 0; d < SEASON_DAYS; d++) {
  advanceTo(s, d, res);
  const w = wireForDay(s, d);
  // keep only the newsworthy lines (upsets, fallen bosses, cup drama, crownings)
  // and cap each day to its two biggest — the "season takes a breath" and
  // generic "matchday N" fillers are dropped so the feed reads like a real wire
  const picks = w.headlines.filter(h => h.importance >= 55 && h.kind !== "break" && h.kind !== "league-day").slice(0, 2);
  for (const h of picks) wire.push({ day: d, ...dayState(d), headline: h.headline, art: h.art, category: h.category, importance: h.importance });
}
console.error(`played season 0 (${Date.now() - t0}ms)`);

// de-duplicate the odd shared bot-club name for clean display
function dedupe(rows) {
  const seen = {};
  return rows.map(r => { const n = seen[r.name] = (seen[r.name] || 0) + 1; return n > 1 ? { ...r, name: r.name + " " + ("II III IV".split(" ")[n - 2] || n) } : r; });
}

const leagueOf = id => s.leagues["0:" + id];
const bossTeam = id => Object.values(leagueOf(id).byId).find(t => t.kind === "boss");

const leagues = REGIONS.map(region => {
  const st = leagueStandings(s, 0, region.id);
  const L = leagueOf(region.id);
  const rows = dedupe(st.map(r => ({ id: r.id, name: L.byId[r.id].name, kind: L.byId[r.id].kind, P: r.P, W: r.W, L: r.L, T: r.T, pts: r.pts })));
  return { regionId: region.id, name: region.name, winner: rows[0].name, table: rows };
});

// ---- the bosses: portrait + nation + their side's league finish ------------
const bosses = REGIONS.map(region => {
  const bt = bossTeam(region.id);
  const st = leagueStandings(s, 0, region.id);
  const pos = st.findIndex(r => r.id === bt.id) + 1;
  return { code: region.id, name: region.boss, nation: region.name, club: bt.name, finish: pos };
});

// ---- one global "world table": the best clubs across every nation ----------
const pool = [];
for (const region of REGIONS) {
  const st = leagueStandings(s, 0, region.id);
  const L = leagueOf(region.id);
  for (const r of st) pool.push({ code: region.id, region: region.name, name: L.byId[r.id].name, P: r.P, W: r.W, L: r.L, pts: r.pts, kind: L.byId[r.id].kind });
}
pool.sort((a, b) => b.pts - a.pts || b.W - a.W || a.name.localeCompare(b.name));
const world = dedupe(pool).slice(0, 8);

// ---- the Champions Cup: podium, groups, and the bracket WITH scorelines ----
const cup = s.cups[0];
const teamNm = id => (cup.field.find(t => t.id === id) || {}).name || id;
const codeOf = t => (t && (t.id === THORNE_ID ? "thorne" : t.regionId)) || null;
const tie = t => t ? {
  win: t.win.name, lose: t.lose.name, winCode: codeOf(t.win), loseCode: codeOf(t.lose),
  winScore: t.winScore ? t.winScore.runs + "/" + t.winScore.wkts : null,
  loseScore: t.loseScore ? t.loseScore.runs + "/" + t.loseScore.wkts : null
} : null;
const cupOut = {
  champion: teamNm(cup.champion), runnerUp: teamNm(cup.runnerUp), third: teamNm(cup.third),
  championCode: codeOf(cup.field.find(t => t.id === cup.champion)),
  groups: cup.groups.map(g => Object.values(g.table).sort((a, b) => b.pts - a.pts || b.W - a.W).map(r => ({ name: g.byId[r.id].name, code: codeOf(g.byId[r.id]), pts: r.pts, W: r.W }))),
  bracket: { qf: cup.bracket.qf.map(tie), sf: cup.bracket.sf.map(tie), third: tie(cup.bracket.third), final: tie(cup.bracket.final) }
};

// ---- featured fixtures: the season's climax (the Final + title-deciders) ----
function fx(comp, live, hName, hCode, aName, aCode) { return { comp, live: !!live, home: { name: hName, code: hCode }, away: { name: aName, code: aCode } }; }
const finalTie = cup.bracket.final;
const featured = [fx("Champions Cup — Final", true, finalTie.win.name, codeOf(finalTie.win), finalTie.lose.name, codeOf(finalTie.lose))];
for (const rid of ["eng", "sub", "aus"]) {
  if (featured.length >= 3) break;
  const L = leagueOf(rid), region = REGIONS.find(r => r.id === rid);
  const last = L.schedule[L.schedule.length - 1];
  if (last && last[0]) featured.push(fx(region.name + " League", false, L.byId[last[0][0]].name, rid, L.byId[last[0][1]].name, rid));
}

// ---- transfer & retirement storylets (real player names; deterministic) -----
// The living world's aging model isn't simulated in this snapshot yet, so these
// are seeded flavour drawn from real generated squads. When careers persist,
// they become true events on the tick.
function squadOf(regionId) { const sq = materialiseSquad(E, bossTeam(regionId)); return (sq && sq.players ? sq.players : []).filter(p => p && p.name); }
const stories = [];
const R = rng(hash32("stories|" + seed));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const donors = shuffle(REGIONS.slice());
for (let i = 0; i < 3; i++) {
  const to = donors[i], from = donors[(i + 3) % donors.length];
  const sq = squadOf(from.id); const p = sq[3 + i] || sq[0];
  if (!p) continue;
  stories.push({ day: 14 - i, category: "transfer", art: "transfer", headline: `${bossTeam(to.id).name} sign ${p.age && p.age <= 24 ? "young " : ""}${p.role === "opener" ? "opener" : p.bowlType ? "bowler" : "batter"} ${p.name} from ${from.name} CC` });
}
for (let i = 0; i < 2; i++) {
  const reg = donors[(i + 6) % donors.length];
  const vet = squadOf(reg.id).slice().sort((a, b) => (b.age || 0) - (a.age || 0))[0];
  if (!vet) continue;
  stories.push({ day: 13 - i, category: "retirement", art: "retirement", headline: `${vet.name} hangs up the pads after a storied ${reg.name} career` });
}

// merge storylets into the wire feed, newest first
const feed = wire.concat(stories).sort((a, b) => b.day - a.day || (b.importance || 50) - (a.importance || 50));

const snapshot = {
  seed, season: 0, asOfDay: SEASON_DAYS - 1, matchday: 14,
  status: { nations: REGIONS.length, leagues: REGIONS.length, cups: 1, seasons: s.championsLog.length },
  king: { name: "Reggie Thorne", club: "Thorne's Invincible XI", seasons: s.championsLog.length },
  leagues, bosses, world,
  cup: cupOut, featured, wire: feed
};

writeFileSync(new URL("../world-snapshot.json", import.meta.url), JSON.stringify(snapshot));
console.error(`wrote world-snapshot.json — champion: ${snapshot.cup.champion}, ${feed.length} wire items, ${bosses.length} bosses`);
