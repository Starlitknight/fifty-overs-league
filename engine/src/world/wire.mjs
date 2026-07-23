// ===========================================================================
//  The Living World — the Wire
//
//  Turns a resolved day of the world into headlines: upsets, fallen bosses,
//  Thorne's serene progress, qualifications, knockout drama and the crowning of
//  a champion. Pure and deterministic — it reads the day's real results out of
//  the world state and ranks them by newsworthiness. These become the world
//  news feed and the keys for home-page art panels.
// ===========================================================================
import { REGIONS, THORNE_ID, dayState } from "./timeline.mjs";

// a season-wide id -> {name, strength, kind, regionId} index from the state
function teamIndex(state, season) {
  const idx = {};
  for (const region of REGIONS) {
    const L = state.leagues[season + ":" + region.id];
    if (L) for (const t of L.league.teams) idx[t.id] = { name: t.name, strength: t.strength, kind: t.kind, regionId: region.id };
  }
  const cup = state.cups[season];
  if (cup) for (const t of cup.field) if (!idx[t.id]) idx[t.id] = { name: t.name, strength: t.strength ?? 60, kind: t.kind || "boss", regionId: t.regionId };
  idx[THORNE_ID] = { name: "Thorne's Invincible XI", strength: 999, kind: "thorne" };
  return idx;
}
const nm = (idx, id) => (idx[id] && idx[id].name) || id;

export function wireForDay(state, day) {
  const ds = dayState(day);
  const idx = teamIndex(state, ds.season);
  const heads = [];
  const push = (kind, importance, headline, extra) => heads.push({ kind, importance, headline, art: kind, ...extra });

  if (ds.phase === "league") {
    const fx = [];
    for (const region of REGIONS) {
      const L = state.leagues[ds.season + ":" + region.id];
      if (L) for (const r of L.results.filter(x => x.round === ds.round)) fx.push({ ...r, regionId: region.id });
    }
    // the day's biggest upset (winner much weaker than the side it beat)
    let best = null;
    for (const f of fx) {
      if (!f.winner) continue;
      const w = idx[f.winner], l = idx[f.winner === f.home ? f.away : f.home];
      const surprise = (l.strength || 60) - (w.strength || 60);
      if (surprise > 6 && (!best || surprise > best.surprise)) best = { ...f, w, l, surprise };
    }
    if (best) push("upset", 90, `UPSET in ${REGIONS.find(r => r.id === best.regionId).name}: ${best.w.name} stun ${best.l.name}`, { regionId: best.regionId });
    // fallen bosses (the region's marquee side beaten)
    for (const f of fx) {
      if (!f.winner) continue;
      const loserId = f.winner === f.home ? f.away : f.home;
      if (idx[loserId] && idx[loserId].kind === "boss" && (!best || loserId !== best.l && best.l.kind !== "boss")) {
        push("boss-fall", 70, `${nm(idx, loserId)} fall at home — ${nm(idx, f.winner)} take the points`, { regionId: f.regionId });
      }
    }
    push("league-day", 20, `Matchday ${ds.round + 1}: ${fx.length} results across the nations`, {});
  } else if (ds.phase === "cup" && ds.stage !== "rest") {
    const cup = state.cups[ds.season];
    const st = ds.stage;
    if (st[0] === "g") {
      // Thorne's group result + the round's upset
      const tRes = (cup.results || []).filter(x => x.stage === st && (x.home === THORNE_ID || x.away === THORNE_ID))[0];
      if (tRes) push("thorne", 80, `Champions Cup: Thorne brush aside ${nm(idx, tRes.winner === THORNE_ID ? (tRes.home === THORNE_ID ? tRes.away : tRes.home) : tRes.winner)}`, {});
      if (st === "g4" && cup.qualifiers) {
        const through = cup.qualifiers.flat().map(t => t.name).slice(0, 8);
        push("cup-groups", 85, `Champions Cup knockouts set — eight through: ${through.join(", ")}`, {});
      } else {
        push("cup-groups", 40, `Champions Cup group stage, round ${+st.slice(1) + 1}`, {});
      }
    } else if (st === "qf" || st === "sf") {
      const ties = st === "qf" ? cup.bracket.qf : cup.bracket.sf;
      const label = st === "qf" ? "quarter-final" : "semi-final";
      for (const t of ties) push("cup-ko", 75, `${t.win.name} beat ${t.lose.name} to reach the ${st === "qf" ? "semis" : "final"}`, {});
      push("cup-ko", 60, `Champions Cup ${label}s decided`, {});
    } else if (st === "third") {
      const t = cup.bracket.third;
      if (t) push("cup-third", 55, `${t.win.name} take third place, beating ${t.lose.name}`, {});
    } else if (st === "final") {
      const f = cup.bracket.final;
      if (f) {
        const retained = f.win.id === THORNE_ID;
        push("cup-final", 100, retained
          ? `THE CROWN HOLDS: Thorne win the Champions Cup again, ${f.lose.name} runners-up`
          : `CHAMPIONS OF THE WORLD: ${f.win.name} lift the Cup — Thorne dethroned!`, {});
      }
    }
  } else {
    push("break", 10, `Season ${ds.season + 1} closes — the world takes a breath`, {});
  }

  // bucket each headline for the Wire's filter tabs (transfers/retirements are
  // synthesised separately in the snapshot builder from the world's aging model)
  const CAT = { upset: "upset", "boss-fall": "upset", thorne: "cup", "cup-groups": "cup", "cup-ko": "cup", "cup-third": "cup", "cup-final": "cup", "league-day": "league", break: "league" };
  for (const h of heads) h.category = CAT[h.kind] || "league";
  heads.sort((a, b) => b.importance - a.importance);
  return { day, season: ds.season, phase: ds.phase, headlines: heads };
}
