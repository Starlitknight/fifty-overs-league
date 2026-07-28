// ratings.mjs — WHAT A MATCH WAS WORTH
//
// Two things come out of a banked scorecard and nothing else.
//
// FANTASY POINTS: what each man's day was worth, by the shipped client's own
// arithmetic. This is a faithful port of window.foFantasyPoints, and a test
// holds the two to the same answer on real innings - because these points now
// do two jobs. They pick the player of the match on a phone, and they are what
// moves a player's FORM in the living layer. A manager reading the ratings page
// is reading the reason his batsman is out of nick, not a second opinion.
//
// UNIT RATINGS: the same card read as a coach reads it - the top order, the
// middle, the tail, the seam, the spin and the hands, each out of ten. All
// derived; nothing stored.

// ---------------------------------------------------------------------------
// THE POINTS. Ported from the client, line for line.
// ---------------------------------------------------------------------------
export function fantasyPoints(innings) {
  const P = {};
  const get = (n, team) => P[n] || (P[n] = { n, team, bat: 0, bowl: 0, field: 0 });
  (innings || []).filter(Boolean).forEach(inn => {
    (inn.bat || []).forEach(b => {
      if (!b || (!b.b && !b.out)) return;
      const e = get(b.p.name, inn.batTeam);
      e.bat += (b.r || 0) + (b.f4 || 0) + 2 * (b.f6 || 0);
      if (b.r >= 100) e.bat += 12; else if (b.r >= 50) e.bat += 4;
      if (b.out && !b.r) e.bat -= 3;
      if (b.b >= 20) {
        const sr = 100 * b.r / b.b;
        e.bat += sr >= 120 ? 6 : sr >= 100 ? 4 : sr >= 80 ? 2 : sr < 40 ? -6 : sr < 50 ? -4 : sr < 60 ? -2 : 0;
      }
      const o = String(b.out || ''), mB = o.match(/^(?:lbw )?b ([^,]+)$/);
      if (mB) get(mB[1].trim(), inn.bowlTeam).bowl += 8;
    });
    for (const k in (inn.bowlers || {})) {
      const r = inn.bowlers[k], e2 = get(k, inn.bowlTeam);
      e2.bowl += 25 * (r.w || 0);
      if (r.w >= 5) e2.bowl += 12; else if (r.w >= 4) e2.bowl += 6;
      if (r.b >= 30) {
        const ec = r.r / (r.b / 6);
        e2.bowl += ec <= 3 ? 6 : ec <= 4 ? 4 : ec <= 5 ? 2 : ec > 8 ? -6 : ec > 7 ? -4 : ec > 6 ? -2 : 0;
      }
    }
    for (const f in (inn.fielding || {})) {
      const fd = inn.fielding[f], e3 = get(f, inn.bowlTeam);
      e3.field += 8 * (fd.ct || 0) + 12 * (fd.st || 0) + 8 * (fd.ro || 0);
      if ((fd.ct || 0) >= 3) e3.field += 4;
    }
  });
  const arr = [];
  for (const n in P) { const x = P[n]; x.pts = x.bat + x.bowl + x.field; arr.push(x); }
  arr.sort((a, b) => b.pts - a.pts);
  return arr;
}

// A DAY'S WORK, on the scale the living layer has always used: about 0 for
// nothing and about 4 for a match-winning one. The points are the input, so
// form and the ratings page can never tell two different stories. A man who
// played and never got a chance is not marked down for it.
export function ratePoints(pts, touched) {
  if (!touched) return 0.6;
  return Math.max(-0.5, Math.min(5, pts / 26));
}

// ---------------------------------------------------------------------------
// THE UNITS, out of ten, as a coach reads a card. Each is scored against what
// that job is worth in a fifty-over innings, then squashed to 0-10.
// ---------------------------------------------------------------------------
const clamp10 = v => Math.max(0, Math.min(10, +v.toFixed(1)));

export function unitRatings(inn) {
  if (!inn) return null;
  const bat = (inn.bat || []).filter(b => b && (b.b > 0 || b.out));
  const slice = (a, b) => bat.slice(a, b);
  const sum = (xs, f) => xs.reduce((s, x) => s + (f(x) || 0), 0);
  // a group of batters: runs against what that slot is expected to make, plus
  // a nudge for the rate they made them at
  const batUnit = (xs, par) => {
    if (!xs.length) return null;
    const runs = sum(xs, x => x.r), balls = sum(xs, x => x.b);
    const sr = balls ? 100 * runs / balls : 0;
    return clamp10(3 + 6 * Math.min(1.6, runs / par) + (sr >= 100 ? 1 : sr >= 85 ? 0.5 : sr < 60 ? -1 : 0));
  };
  // a group of bowlers: wickets are the job and economy is the craft, both
  // measured against the overs the unit actually sent down - so three wickets
  // in ten is a spell and three in thirty is a shift
  const bowlUnit = list => {
    if (!list.length) return null;
    const w = sum(list, x => x.w), balls = sum(list, x => x.b), conc = sum(list, x => x.r);
    if (balls < 12) return null;
    const ov = balls / 6, ec = conc / ov;
    const per10 = w / (ov / 10);
    return clamp10(3.2 + 1.9 * Math.min(3, per10) + (ec <= 4 ? 1.8 : ec <= 5 ? 1 : ec <= 6 ? 0 : ec <= 7 ? -1 : -2.2));
  };
  const bowlers = Object.keys(inn.bowlers || {}).map(k => Object.assign({ name: k }, inn.bowlers[k]));
  const isSpin = b => {
    const t = String((b.p && (b.p.bowlTypeFull || b.p.bowlType)) || '').toLowerCase();
    return /spin|orthodox|legbreak|offbreak|wrist|finger/.test(t);
  };
  const seam = bowlers.filter(b => !isSpin(b)), spin = bowlers.filter(isSpin);
  const fld = inn.fielding || {};
  const ct = Object.keys(fld).reduce((s, k) => s + (fld[k].ct || 0), 0);
  const st = Object.keys(fld).reduce((s, k) => s + (fld[k].st || 0), 0);
  const ro = Object.keys(fld).reduce((s, k) => s + (fld[k].ro || 0), 0);
  // the hands are marked on CHANCES, not on a count: five catches in an
  // innings is ordinary if ten men were dismissed and outstanding if six were
  const outs = inn.wkts || 0, held = ct + st + ro;
  const field = clamp10(3.6 + 5.6 * (outs ? Math.min(1, held / outs) : 0) + 0.6 * st + 0.7 * ro);

  const units = {
    top: batUnit(slice(0, 3), 110), middle: batUnit(slice(3, 6), 110), tail: batUnit(slice(6), 45),
    seam: bowlUnit(seam), spin: bowlUnit(spin), field
  };
  const got = Object.keys(units).filter(k => units[k] != null);
  units.overall = got.length ? clamp10(got.reduce((s, k) => s + units[k], 0) / got.length) : null;
  return units;
}

// both sides of one match, batting units for the side that batted and bowling
// units for the side that bowled, folded together per club
export function matchRatings(result) {
  const innings = (result && result.innings || []).filter(Boolean);
  const by = {};
  const at = nm => by[nm] || (by[nm] = { club: nm });
  innings.forEach(inn => {
    const u = unitRatings(inn);
    if (!u) return;
    Object.assign(at(inn.batTeam), { top: u.top, middle: u.middle, tail: u.tail });
    Object.assign(at(inn.bowlTeam), { seam: u.seam, spin: u.spin, field: u.field });
  });
  Object.keys(by).forEach(nm => {
    const x = by[nm];
    const got = ['top', 'middle', 'tail', 'seam', 'spin', 'field'].filter(k => x[k] != null);
    x.overall = got.length ? clamp10(got.reduce((s, k) => s + x[k], 0) / got.length) : null;
  });
  return { sides: by, points: fantasyPoints(innings) };
}
