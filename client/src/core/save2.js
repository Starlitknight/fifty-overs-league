/* core/save2 — the canonical versioned CAREER save (v2).
 *
 * One store for everything the career is: world, club, relationships,
 * rivalries, story state and history. Replaces the scattered
 * fo_summer_/fo_story_/fo_cx_ stores as the primary record; migration
 * consolidates what those contained and ARCHIVES the originals — nothing
 * is silently erased, even data that cannot be translated.
 *
 * History is never capped away: routine events live in the current
 * season's log, season archives keep full per-season records, and
 * milestones/trophies/departures are permanent.
 */
FOC.save2 = (function () {
  var U = FOC.util;
  var VERSION = 2;

  function key(scope) { return "fo_career_" + (scope || "solo"); }

  function fresh(scope, worldSeed) {
    return {
      version: VERSION,
      careerId: "career_" + U.hash32(scope + "|" + worldSeed).toString(36),
      scope: scope,
      worldSeed: String(worldSeed),
      rng: FOC.rng.create(String(worldSeed)),
      idSeq: 0,
      week: 1, seasonNumber: 1,
      user: { managerId: null, clubId: null, employment: "employed", reputation: 30,
        philosophy: null, matchBall: null, objectives: [] },
      world: { clubsById: {}, managersById: {}, playersById: {}, fixturesById: {},
        competitionsById: {}, transfers: [], news: [], peerManagerId: null, thorneManagerId: null },
      relationships: { managerToManager: {}, managerToPlayer: {}, clubToClub: {} },
      rivalries: { clubs: {}, duels: {}, threads: [] },
      story: { cast: {}, castNames: {}, pending: [], seen: {}, cooldowns: {},
        promises: [], notes: {}, rapport: { gaffer: 55, captain: 55, dressingRoom: 55 },
        gtClues: [], directorState: { lastCast: [], quietStreak: 0 } },
      history: { events: [], seasonArchives: [], milestones: [], trophies: [],
        departures: [], famousMatches: [] },
      flags: {}, legacy: null, settings: {}
    };
  }

  function store() { try { return window.localStorage; } catch (e) { return null; } }

  // ---- migration: v1 First Summer (+ fo_story_/fo_cx_) → v2 career ---------
  function migrateFromV1(scope, v1, worldSeed) {
    var v2 = fresh(scope, worldSeed);
    if (!v1) return v2;
    v2.legacy = { firstSummer: U.deep(v1) };   // archive the untranslated source
    v2.user.philosophy = v1.philosophy || null;
    v2.user.matchBall = v1.matchBall || null;
    v2.story.cast = U.deep(v1.cast || {});
    v2.story.castNames = U.deep(v1.castNames || {});
    v2.story.promises = U.deep(v1.promises || []);
    v2.story.notes = U.deep(v1.notes || {});
    v2.story.rapport = U.deep(v1.rapport || v2.story.rapport);
    v2.flags.v1idmap = U.deep(v1.idmap || {});  // player identity carries over
    (v1.events || []).forEach(function (e) { v2.history.events.push(e); });
    (v1.matches || []).forEach(function (m) {
      v2.history.famousMatches.push({ from: "first-summer", key: m.key, opp: m.opp,
        win: m.win, my: m.my, op: m.op, sig: m.sig, facts: m.facts });
    });
    if (v1.epilogue) v2.history.milestones.push({ kind: "first-summer-final", detail: U.deep(v1.epilogue) });
    return v2;
  }

  function consolidateSideStores(v2, ls) {
    // fold fo_story_* and fo_cx_* in where reliable; archive them verbatim
    try {
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (!k) continue;
        if (k.indexOf("fo_story_") === 0 || k.indexOf("fo_cx_") === 0) {
          var raw = ls.getItem(k);
          v2.legacy = v2.legacy || {};
          (v2.legacy.sideStores = v2.legacy.sideStores || {})[k] = raw;
          try {
            var st = JSON.parse(raw);
            if (k.indexOf("fo_cx_") === 0 && st && st.conq) {
              st.conq.forEach(function (rid) {
                v2.history.trophies.push({ kind: "circuit", region: rid, note: "Circuit region conquered (pre-career)" });
              });
              if (st.flags && st.flags.valeSigned) v2.flags.valeSigned = 1;
            }
            if (k.indexOf("fo_story_") === 0 && st && st.log) {
              st.log.slice(0, 40).forEach(function (l) {
                if (l && l.txt) v2.history.milestones.push({ kind: "club-story", note: l.txt });
              });
            }
          } catch (eP) {}
        }
      }
    } catch (e) {}
    return v2;
  }

  function load(scope) {
    var ls = store(); if (!ls) return null;
    var txt = null;
    try { txt = ls.getItem(key(scope)); } catch (e) {}
    if (!txt) return null;
    try {
      var raw = JSON.parse(txt);
      if (raw && raw.version === VERSION) return raw;
      if (raw && raw.version > VERSION) return raw;   // forward saves load untouched
      return raw;   // future: chain v2→v3 here
    } catch (e2) {
      try { ls.setItem(key(scope) + "_backup_" + U.hash32(txt).toString(36), txt); } catch (e3) {}
      return null;
    }
  }

  // create (or migrate into) a career for this scope; never erases v1 stores
  function begin(scope, worldSeed) {
    var ls = store();
    var existing = load(scope);
    if (existing) return existing;
    var v1 = null;
    try { v1 = FOC.save.load(scope); if (v1 && !v1.flags.founded && !(v1.events || []).length) v1 = null; } catch (e) {}
    var v2 = migrateFromV1(scope, v1, worldSeed);
    if (ls) consolidateSideStores(v2, ls);
    persist(v2);
    return v2;
  }

  function persist(v2) {
    var ls = store(); if (!ls) return false;
    try { ls.setItem(key(v2.scope), JSON.stringify(v2)); return true; } catch (e) { return false; }
  }

  function reset(scope) {
    var ls = store(); if (!ls) return;
    try {
      var old = ls.getItem(key(scope));
      if (old) ls.setItem(key(scope) + "_archived_" + U.hash32(old).toString(36), old);
      ls.removeItem(key(scope));
    } catch (e) {}
  }

  function exportCareer(v2) { return JSON.stringify(v2); }
  function importCareer(scope, txt) {
    var raw = JSON.parse(txt);   // throws on bad input — caller reports
    if (!raw || typeof raw.version !== "number" || !raw.worldSeed) throw new Error("Not a career file.");
    raw.scope = scope;
    persist(raw);
    return raw;
  }

  return { VERSION: VERSION, key: key, fresh: fresh, load: load, begin: begin,
    persist: persist, reset: reset, migrateFromV1: migrateFromV1,
    consolidateSideStores: consolidateSideStores,
    exportCareer: exportCareer, importCareer: importCareer };
})();
