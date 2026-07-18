/* core/rng — serialisable seeded randomness with named independent streams.
 *
 * Every stream is its own mulberry32 state, seeded once from
 * hash(worldSeed | streamName) and persisted as a single uint32 in the save,
 * so: (a) the same seed + the same decisions reproduce the same world;
 * (b) drawing from one stream never shifts another (adding a storylet roll
 * cannot change a cup draw); (c) state survives reload exactly.
 * Career simulation must never touch Math.random().
 */
FOC.rng = (function () {
  var U = FOC.util;

  function create(seedStr) {
    return { seed: String(seedStr), streams: {}, recent: [] };
  }

  // one mulberry32 step from a uint32 state → {v in [0,1), s: next state}
  function step(state) {
    var s = (state + 0x6D2B79F5) | 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return { v: ((t ^ (t >>> 14)) >>> 0) / 4294967296, s: s };
  }

  function next(R, stream, tag) {
    if (R.streams[stream] == null) R.streams[stream] = U.hash32(R.seed + "|" + stream) | 0;
    var r = step(R.streams[stream] | 0);
    R.streams[stream] = r.s;
    if (tag) {
      // meaningful outcomes keep a short debuggable trail
      R.recent.push({ st: stream, tag: tag, v: Math.round(r.v * 1000) / 1000 });
      if (R.recent.length > 120) R.recent = R.recent.slice(-120);
    }
    return r.v;
  }

  function int(R, stream, n, tag) { return Math.floor(next(R, stream, tag) * n); }
  function pick(R, stream, arr, tag) { return arr[int(R, stream, arr.length, tag)]; }
  function chance(R, stream, p, tag) { return next(R, stream, tag) < p; }
  function range(R, stream, lo, hi, tag) { return lo + next(R, stream, tag) * (hi - lo); }
  function shuffle(R, stream, arr, tag) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = int(R, stream, i + 1, tag);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // weighted pick from [{w, ...}] — returns the item
  function weighted(R, stream, items, tag) {
    var tot = 0; items.forEach(function (it) { tot += (it.w || 1); });
    var roll = next(R, stream, tag) * tot;
    for (var i = 0; i < items.length; i++) {
      roll -= (items[i].w || 1);
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  return { create: create, next: next, int: int, pick: pick, chance: chance,
    range: range, shuffle: shuffle, weighted: weighted };
})();
