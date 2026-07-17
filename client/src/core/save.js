/* core/save — the versioned canonical solo campaign save.
 *
 * Storage: localStorage key fo_summer_<scope>, where scope isolates the save
 * per league/club so a multiplayer session never shadows a solo one. The
 * save is versioned (v) and loaded through an explicit migration chain; an
 * unreadable save is never silently erased — it is moved to a timestamped
 * backup key and a fresh save begins, with the backup listed for recovery.
 */
FOC.save = (function () {
  var U = FOC.util;
  var VERSION = 1;

  function key(scope) { return "fo_summer_" + (scope || "solo"); }

  function fresh(scope) {
    return {
      v: VERSION,
      id: "camp_" + U.hash32(String(scope)).toString(36),
      scope: scope || "solo",
      ch: 0,               // 0 = prologue … 10 = The Crown Ground, 11 = epilogue done
      beat: 0,             // index into the current chapter's beat list
      status: "active",    // active | complete
      philosophy: null,    // {k, label, chChosen}
      matchBall: null,     // prologue keepsake choice
      cast: {},            // role → player id (captain, senior, prospect, fringe)
      castNames: {},       // role → display name snapshot (survives transfers)
      choices: {},         // chapterKey → choice key(s) made
      rapport: { gaffer: 55, captain: 55, dressingRoom: 55 },  // story-only; never touches skills
      promises: [],        // {id, pid, txt, madeCh, dueMatches, status, replacedBy}
      notes: {},           // player id → private manager note
      idmap: {},           // natural key → stable id (see core/ids)
      events: [],          // canonical event log (see core/events)
      evSeq: 0,
      matches: [],         // {ch, n, sig, opp, win, my, op, facts, rematch}
      losses: {},          // chapterKey → loss count (fail-forward bookkeeping)
      epilogue: null,      // {variant, permanent:true} once written, never rewritten
      flags: {}
    };
  }

  // ---- migration chain -----------------------------------------------------
  // Each step upgrades exactly one version. v0 = any pre-versioned object.
  var MIGRATIONS = {
    0: function (raw) {
      // v0 → v1: graft whatever fields exist onto a fresh v1 shell
      var s = fresh(raw && raw.scope);
      if (raw && typeof raw === "object") {
        for (var k in s) if (raw[k] != null && k !== "v") s[k] = raw[k];
      }
      s.v = 1;
      return s;
    }
  };

  function migrate(raw) {
    var v = (raw && typeof raw.v === "number") ? raw.v : 0;
    var guard = 0;
    while (v < VERSION && guard++ < 20) {
      var step = MIGRATIONS[v];
      if (!step) break;
      raw = step(raw);
      v = raw.v;
    }
    return raw;
  }

  function store() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  function load(scope) {
    var ls = store(); if (!ls) return fresh(scope);
    var txt = null;
    try { txt = ls.getItem(key(scope)); } catch (e) {}
    if (!txt) return fresh(scope);
    var raw = null;
    try { raw = JSON.parse(txt); } catch (e) {}
    if (!raw || typeof raw !== "object") {
      // corrupt: back it up, never erase silently
      try { ls.setItem(key(scope) + "_backup_" + U.hash32(txt).toString(36), txt); } catch (e2) {}
      var s0 = fresh(scope); s0.flags.recoveredFromCorrupt = 1;
      return s0;
    }
    return migrate(raw);
  }

  function persist(save) {
    var ls = store(); if (!ls) return false;
    try { ls.setItem(key(save.scope), JSON.stringify(save)); return true; } catch (e) { return false; }
  }

  function reset(scope) {
    var ls = store(); if (!ls) return;
    // a reset archives the old save instead of destroying it
    try {
      var old = ls.getItem(key(scope));
      if (old) ls.setItem(key(scope) + "_archived_" + U.hash32(old).toString(36), old);
      ls.removeItem(key(scope));
    } catch (e) {}
  }

  function backups(scope) {
    var ls = store(), out = []; if (!ls) return out;
    try {
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(key(scope) + "_") === 0) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  return { VERSION: VERSION, key: key, fresh: fresh, migrate: migrate, load: load,
    persist: persist, reset: reset, backups: backups };
})();
