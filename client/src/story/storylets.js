/* story/storylets — conditional narrative units + the director that decides
 * what deserves attention this week. Storylets fire when their trigger and
 * eligibility conditions are true, weighted and seeded — the same situation
 * does not always produce the same scene, and a quiet week is always a
 * legitimate outcome. The director controls ATTENTION, never outcomes: it
 * cannot change a result, injure anyone, or rescue a season.
 *
 * Scenes may only quote facts that exist in the save; every template
 * validates its required data before rendering and withdraws if missing.
 */
FOC.storylets = (function () {
  var RNG = FOC.rng;
  var DEFS = [];   // registered by content packs

  function register(def) { DEFS.push(def); }

  function eligible(v2, trigger, api) {
    return DEFS.filter(function (d) {
      if (d.on !== trigger) return false;
      var seen = v2.story.seen[d.id] || 0;
      if (d.maxUses && seen >= d.maxUses) return false;
      var cd = v2.story.cooldowns[d.id];
      if (cd && (v2.seasonNumber * 100 + v2.week) < cd) return false;
      try { if (d.when && !d.when(v2, api)) return false; } catch (e) { return false; }
      // required facts must exist — a scene never invents statistics
      try { if (d.needs && !d.needs(v2, api)) return false; } catch (e2) { return false; }
      return true;
    });
  }

  // pick at most `cap` storylets for this trigger; quiet is always on the table
  function select(v2, trigger, api, cap) {
    var pool = eligible(v2, trigger, api);
    if (!pool.length) return [];
    var picked = [];
    var guard = 0;
    while (picked.length < (cap || 1) && pool.length && guard++ < 10) {
      var quietW = 2 + (v2.story.directorState.quietStreak < 1 ? 2 : 0);
      var items = pool.map(function (d) {
        var w = d.weight || 3;
        // rotation: characters who just spoke yield the floor
        if (d.cast && v2.story.directorState.lastCast.indexOf(d.cast) >= 0) w = Math.max(1, w - 2);
        if (d.priority === "urgent") w += 8;
        return { w: w, d: d };
      }).concat([{ w: quietW, d: null }]);
      var choice = RNG.weighted(v2.rng, "storylets", items, trigger);
      if (!choice.d) break;   // a quiet week
      picked.push(choice.d);
      pool = pool.filter(function (d) { return d !== choice.d; });
    }
    if (!picked.length) v2.story.directorState.quietStreak++;
    else v2.story.directorState.quietStreak = 0;
    picked.forEach(function (d) {
      v2.story.seen[d.id] = (v2.story.seen[d.id] || 0) + 1;
      if (d.cooldown) v2.story.cooldowns[d.id] = v2.seasonNumber * 100 + v2.week + d.cooldown;
      if (d.cast) {
        v2.story.directorState.lastCast.push(d.cast);
        v2.story.directorState.lastCast = v2.story.directorState.lastCast.slice(-3);
      }
      v2.story.pending.push({ id: d.id, week: v2.week, season: v2.seasonNumber });
    });
    return picked;
  }

  function byId(id) {
    for (var i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) return DEFS[i];
    return null;
  }

  // build the scene for the first pending storylet; null if queue empty
  function nextScene(v2, api) {
    while (v2.story.pending.length) {
      var ref = v2.story.pending[0];
      var d = byId(ref.id);
      if (!d) { v2.story.pending.shift(); continue; }
      try {
        var sc = d.scene(v2, api, ref);
        if (sc) return { def: d, scene: sc, ref: ref };
      } catch (e) {}
      v2.story.pending.shift();   // template refused (missing facts) — drop it
    }
    return null;
  }
  function popScene(v2) { v2.story.pending.shift(); }

  return { register: register, eligible: eligible, select: select,
    nextScene: nextScene, popScene: popScene, byId: byId, _defs: DEFS };
})();
