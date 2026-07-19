/* core/util — tiny shared helpers, no engine dependencies. */
FOC.util = (function () {
  function hash32(s) {
    s = String(s == null ? "" : s);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function deep(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function last(arr) { return arr && arr.length ? arr[arr.length - 1] : null; }
  // most frequent element of a list of strings; ties break on first seen
  function mode(list) {
    var n = {}, best = null, bc = -1;
    (list || []).forEach(function (x) {
      n[x] = (n[x] || 0) + 1;
      if (n[x] > bc) { bc = n[x]; best = x; }
    });
    return best;
  }
  return { hash32: hash32, esc: esc, clamp: clamp, deep: deep, last: last, mode: mode };
})();
