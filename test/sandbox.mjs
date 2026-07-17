/* Test sandbox: loads the campaign modules (client/src, manifest order,
 * boot excluded) into a VM with an in-memory localStorage and a minimal
 * engine stub — the same globals the adapter reads in the browser. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function makeStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _map: m
  };
}

export function makeRoster() {
  const mk = (name, o) => Object.assign({
    name, country: 'England', age: 26, hand: 'R', bat: 55, threat: 40, control: 40,
    field: 50, keep: 10, capt: 40, skills: { vsPace: 50, vsSpin: 50 }, bowlType: null, keeper: false, pt: false
  }, o);
  return [
    mk('Alf Onion', { bat: 78, capt: 72, age: 31 }),
    mk('Bert Poole', { bat: 74, age: 24 }),
    mk('Cyril Dane', { bat: 70, age: 36, capt: 60 }),
    mk('Don Ferris', { bat: 66 }),
    mk('Ed Gorse', { bat: 62, keeper: true, keep: 70 }),
    mk('Fred Hale', { bat: 58, bowlType: 'RM', pt: true }),
    mk('Gus Irwin', { bat: 40, bowlType: 'RF', threat: 72, control: 60 }),
    mk('Hal Judd', { bat: 35, bowlType: 'RFM', threat: 68, control: 64 }),
    mk('Ike Kemp', { bat: 30, bowlType: 'OB spin', threat: 60, control: 66, skills: { vsPace: 30, vsSpin: 40 } }),
    mk('Jim Lott', { bat: 28, bowlType: 'SLA spin', threat: 58, control: 62 }),
    mk('Kit Moor', { bat: 25, bowlType: 'LF', threat: 64, control: 55 }),
    mk('Len Nash', { bat: 60, age: 19 }),                       // prospect
    mk('Moe Onks', { bat: 68, age: 27, skills: { vsPace: 55, vsSpin: 78 } }),  // fringe, spin-strong
    mk('Ned Pryce', { bat: 45, keeper: true, keep: 60, age: 22 }),
    mk('Oz Quill', { bat: 33, bowlType: 'LM', threat: 50, control: 50 })
  ];
}

export function makeSandbox(opts = {}) {
  const store = makeStore();
  const roster = opts.roster || makeRoster();
  const team = { name: 'Test CC', players: roster, ground: 'Test Oval' };
  const App = {
    teamIx: 0, pending: null, tossState: null, results: [],
    orders: { batOrder: [], captain: null, keeper: null, tossCall: '', tossDecision: 'bat',
      spells: { north: [], south: [] }, compiled: [], showPT: false, saved: false },
    defaults: null
  };
  const GD = { teams: [team] };
  const calls = { pushPacket: 0, challenge: [], saveGame: 0 };
  const sandbox = {
    console, JSON, Math, Object, Array, String, Number, Boolean, Date, RegExp, Error,
    setInterval: () => 0, clearInterval: () => {}, setTimeout: (f) => 0, clearTimeout: () => {},
    App, GD, LG: { id: 'testlg' },
    userTeam: () => team,
    pickXI: t => t.players.slice(0, 11),
    jsDerive: () => {},
    isPT: p => !!p.pt,
    saveGame: () => { calls.saveGame++; },
    M: undefined,
    SYNC: { started: false, practice: true },
  };
  sandbox.window = sandbox;
  sandbox.localStorage = store;
  sandbox.location = { hash: '#/club', pathname: '/' };
  sandbox.__foGame = {
    art: 'client/art/',
    squad: (seed, cty, arch) => ({
      players: Array.from({ length: 13 }, (_, i) => ({
        name: 'Opp ' + arch + ' ' + i, country: cty, age: 25,
        skills: { vsPace: 50, vsSpin: 50, temperament: 50 },
        bowlType: i > 7 ? 'RM' : null, keeper: i === 7
      }))
    }),
    challenge: (ix, pitch, wx) => {
      calls.challenge.push([ix, pitch, wx]);
      App.tossState = null;
      App.pending = { oppIx: ix, home: team.name, away: GD.teams[ix].name, ground: team.ground,
        pitch, weather: wx, comp: 'friendly', __friendly: true };
      App.orders.saved = false;
    },
    pushPacket: () => { calls.pushPacket++; },
    story: { state: () => ({ queue: [], log: [] }), save: () => {}, log: () => {}, varAdj: () => {} }
  };
  vm.createContext(sandbox);

  const manifest = readFileSync(path.join(root, 'client/src/manifest.txt'), 'utf8')
    .split('\n').filter(Boolean).filter(f => f !== 'boot.js');
  let js = '"use strict";\n';
  for (const f of manifest) js += readFileSync(path.join(root, 'client/src', f), 'utf8') + '\n';
  js += ';FOC';
  const FOC = vm.runInContext(js, sandbox, { filename: 'campaign-bundle.js' });
  return { FOC, store, roster, team, App, GD, calls, sandbox };
}
