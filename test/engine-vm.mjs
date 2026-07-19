/* test/engine-vm.mjs — run the SHIPPED game headless in a Node VM.
 *
 * Loads every <script> block from the built index.html — engine, league
 * overlay and campaign bundle, i.e. exactly what the browser executes —
 * into a vm context whose DOM is an absorb-everything dummy: element
 * lookups return a proxy that swallows reads, writes and calls, so all the
 * UI wiring runs harmlessly while the simulation globals (newMatch,
 * stepBall, the overlay's pickXI/ballDist wrappers, the tuning layer) end
 * up in exactly their shipped composition.
 *
 * setInterval callbacks are collected and fired once after load — that is
 * how the campaign bundle's boot installs the tuning + smooth-render
 * layers, mirroring the browser. fetch returns a forever-pending promise
 * so the overlay's network paths neither run nor reject.
 *
 * Powers the golden-master replay tests; a full 50-over match runs in
 * ~100ms, so replays are ordinary `node --test` citizens.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILT = path.join(root, 'index.html');

function dummyEl() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get(_, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'length') return 0;
      if (k === 'value' || k === 'textContent' || k === 'innerHTML' || k === 'id' || k === 'className') return '';
      if (k === 'children' || k === 'childNodes' || k === 'attributes') return [];
      return proxy;
    },
    set() { return true; },
    apply() { return proxy; },
    has() { return true; }
  });
  return proxy;
}

export function makeEngine() {
  const html = readFileSync(BUILT, 'utf8');
  const scripts = [];
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) if (m[1].trim()) scripts.push(m[1]);
  if (scripts.length < 3) throw new Error('engine-vm: run ./build.sh first (index.html has no scripts)');

  const el = dummyEl();
  const store = new Map();
  const timerQ = [];   // setTimeout AND setInterval callbacks, registration order
  const ctx = {
    console: { log() {}, info() {}, warn() {}, error() {} },
    JSON, Math, Object, Array, String, Number, Boolean, Date, RegExp, Error, Map, Set,
    Promise, parseInt, parseFloat, isNaN, isFinite, NaN, Infinity, undefined, Symbol, Proxy, Reflect,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    setInterval: fn => { timerQ.push(fn); return timerQ.length; },
    clearInterval() {},
    setTimeout: fn => { if (typeof fn === 'function') timerQ.push(fn); return timerQ.length; },
    clearTimeout() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    alert() {}, confirm: () => false, prompt: () => null,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      clear: () => store.clear(),
      key: i => [...store.keys()][i] ?? null,
      get length() { return store.size; }
    },
    location: { hash: '', pathname: '/', search: '', origin: 'file://', href: 'file:///index.html', reload() {} },
    history: { replaceState() {}, pushState() {} },
    navigator: { userAgent: 'node-vm', clipboard: { writeText: () => Promise.resolve() } },
    document: {
      querySelector: () => el, querySelectorAll: () => [], getElementById: () => el,
      createElement: () => el, createTextNode: () => el,
      body: el, head: el, documentElement: el,
      addEventListener() {}, removeEventListener() {},
      title: '', hidden: false, readyState: 'complete'
    },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    Image: function () { return el; }, Audio: function () { return el; },
    FileReader: function () { this.readAsText = () => {}; },
    Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
    fetch: () => new Promise(() => {}),   // forever pending: no network, no rejections
    performance: { now: () => 0 },
    getComputedStyle: () => new Proxy({}, { get: () => '' })
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  // solo flags so the overlay boots straight past the gate, like the probes
  ctx.localStorage.setItem('fo_welcomed', '1');
  ctx.localStorage.setItem('fo_club', '0');

  for (let i = 0; i < scripts.length; i++) {
    vm.runInContext(scripts[i], ctx, { filename: 'built-block-' + i + '.js' });
  }
  // Drain the timer queue deterministically (a "run all fake timers" pass,
  // bounded against self-rescheduling): this is how the campaign boot
  // installs the tuning layer AND how the overlay's deferred state passes
  // (fatigue carry, player derivation) settle, mirroring an idle page.
  let drained = 0;
  while (timerQ.length && drained < 4000) {
    const fn = timerQ.shift(); drained++;
    try { fn(); } catch (e) {}
  }

  if (vm.runInContext('typeof foTuneDist', ctx) !== 'function') {
    throw new Error('engine-vm: engine tuning (foTuneDist) missing — build incomplete');
  }

  /* headless full match through the SHIPPED globals (wrapped pickXI,
   * wrapped ballDist chain, tuning) — mirrors __foGame.simWorld but keeps
   * the ball log for golden masters. */
  const runner = `
  function __vmRunMatch(aIx, bIx, pitch, weather, seed) {
    onMatchEnd = function () {};
    M = newMatch(GD.teams[aIx], GD.teams[bIx], pitch, (seed >>> 0) || 1);
    M.meta = { home: GD.teams[aIx].name, away: GD.teams[bIx].name, pitch: pitch, weather: weather || 'Sunny', comp: 'vm', isUser: false };
    M.isUserMatch = false;
    M.ordersMap = {};
    App.tossState = { stage: 'x' };
    applyToss(aiTossDecision());
    var g = 0;
    while (M && !M.done && g++ < 3000) { autoPick(); stepBall(); }
    if (!M || !M.done) return null;
    var balls = [];
    for (var i = M.log.length - 1; i >= 0; i--) {
      var L = M.log[i];
      if (L && L.no) balls.push([L.inn, L.no, L.out]);
    }
    var inns = M.innings.map(function (x) {
      return x ? { runs: x.runs, wkts: x.wkts, legal: x.legal } : null;
    });
    return { balls: balls, innings: inns, batFirst: M.batFirstTeam || null };
  }
  __vmRunMatch`;
  const runMatchIn = vm.runInContext(runner, ctx, { filename: 'vm-runner.js' });

  return {
    ctx,
    // JSON round-trip: hand out host-realm plain objects (VM-realm
    // prototypes break strict deepEqual against JSON-loaded masters)
    runMatch: (aIx, bIx, pitch, weather, seed) => {
      const r = runMatchIn(aIx, bIx, pitch, weather, seed);
      return r ? JSON.parse(JSON.stringify(r)) : r;
    },
    setTuning: on => { ctx.__foTuneOff = on ? 0 : 1; }
  };
}
