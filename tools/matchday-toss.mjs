/* tools/matchday-toss.mjs — WHAT THE TOSS IS ACTUALLY WORTH, MEASURED.
 *
 * The match-day coach wants to advise "bat" or "bowl" when a manager wins the
 * coin. That advice is about to become a policy table, and a policy table
 * built on cricketing folklore ("bowl on a green top", "bat on a flat one")
 * would be a table about REAL cricket, not about THIS engine. Only a
 * measurement can say what the engine believes, so this tool measures it.
 *
 * WHAT IT MEASURES
 * ----------------
 * For each condition cell (pitch x weather) it plays PAIRED matches:
 *
 *     run 1:  side A bats first, side B chases
 *     run 2:  side B bats first, side A chases      <- same seed, same squads
 *
 * and counts how often the side that batted first won. One pair therefore
 * contributes two observations, and the pair is symmetric in the two clubs:
 * whatever A is better at, A supplies it to the bat-first column in run 1 and
 * to the chase column in run 2. Any strength difference between the squads
 * cancels EXACTLY in expectation, which is the whole reason for pairing. The
 * same holds for the home-ground edge (it attaches to the first argument in
 * both runs, so it adds to one term and subtracts from the other) — matches
 * are still played `neutral` by default so the number is about the conditions
 * and nothing else, but `--home` exists to confirm that claim rather than
 * assert it.
 *
 * Note what the pairing does NOT buy. Sharing a seed is not common random
 * numbers: the moment the batting order changes, the two runs consume the RNG
 * stream differently and the deliveries diverge completely. The pair is a
 * symmetry device, not a variance-reduction device, and the error bars below
 * are the honest ones for that.
 *
 * HOW THE BATTING SIDE IS FORCED
 * ------------------------------
 * Through the ordersMap channel, which is the same channel the World Service
 * uses to hand an NPC manager's sheet to the resolver. In 00-core.js:
 *
 *     aiTossDecision()  draws the coin FIRST (so the RNG stream never shifts),
 *                       then consults ordersFor(M.user.name).tossDecision and
 *                       returns that instead if it is 'bat' or 'bowl';
 *     simWorld()        calls applyToss(aiTossDecision()), and applyToss's
 *                       argument is "the first-named team bats first".
 *
 * So an ordersMap entry of {tossDecision:'bat'} on the FIRST team argument
 * makes that team bat first with probability 1 — there is no coin left in it.
 * This is a deterministic override, not a nudge, and the tool ASSERTS on
 * `batFirstTeam` after every single match: a forcing channel that silently
 * stopped working would produce a confident measurement of nothing, which is
 * the expensive failure this file exists to avoid.
 *
 * Both clubs are given an orders object of the identical shape (one carries
 * 'bat', the other 'bowl') so that nothing else in the engine can react to the
 * mere PRESENCE of a sheet for one side and not the other. That matters:
 * foFieldSetting() branches on `if(O)`, and foHasPlan() branches on
 * phaseIntent/manBat. Neither fires for a tossDecision-only sheet, and with
 * both sides carrying one, neither can fire asymmetrically.
 *
 * WHAT THE NUMBERS MEAN
 * ---------------------
 * bat-first win %   the share of the 2N matches in a cell won by whoever
 *                   batted first. 50% is "the toss is worth nothing here".
 * SE                the standard error of that share, computed over PAIRS,
 *                   not over matches. The two matches in a pair share a seed
 *                   and squads and are therefore not independent; treating
 *                   2N matches as 2N independent Bernoulli trials would
 *                   understate the error. The per-pair statistic is
 *                   X = (bat-first wins in run 1) + (bat-first wins in run 2),
 *                   X in {0, 0.5, 1, 1.5, 2}, and SE = sd(X/2)/sqrt(N).
 * mean 1st / 2nd    the mean first- and second-innings totals. The second is
 *                   ALWAYS the lower of the two on average and that is not a
 *                   finding: a successful chase stops the instant the target
 *                   is passed, so the second innings is truncated by
 *                   construction. Read it only against other cells.
 * verdict           BAT or BOWL only when the share is more than two standard
 *                   errors off 50%. Everything else reads "no measurable
 *                   edge", which is a real answer and the commonest one.
 *
 * CLAUDE.md's warning is the design brief here: a 260-match sample cannot
 * resolve a small effect. At the default 400 pairs the SE is about 1.7
 * points, so a 3-point edge is at the edge of visibility and a 1-point edge
 * is invisible. Do not read a verdict of "no measurable edge" as "the effect
 * is zero" — read it as "this run could not see it". Raise --seeds and the
 * error bars shrink as 1/sqrt(N); nothing else about the answer changes.
 *
 * USAGE
 *   node tools/matchday-toss.mjs                  # 400 pairs/cell (~15 min)
 *   node tools/matchday-toss.mjs --quick          # 40 pairs/cell, a smoke test
 *   node tools/matchday-toss.mjs --seeds 1200     # SE ~1.0 point
 *   node tools/matchday-toss.mjs --jobs 2         # cap the worker processes
 *   node tools/matchday-toss.mjs --home           # with the home edge on
 *   node tools/matchday-toss.mjs --cal chase_risk=0 --cal chase_dot=0
 *                                                 # ...and WHY it is worth it
 *
 * THE BISECT HANDLE. A bat-first edge could be emergent — fifty overs of
 * information the chasing captain does not have — or it could be one tuning
 * term. CLAUDE.md is explicit that the difference is settled by turning the
 * term off and re-measuring, never by reasoning about it, so --cal overrides
 * GD.cal inside every worker's VM before a ball is bowled. The chase model
 * lives in four constants (chase_risk, chase_four, chase_six, chase_dot,
 * applied in 00-core.js at the `ctx.chase` block): zero them and re-run, and
 * the difference between the two tables is what that model is worth in wins.
 * --cal changes NOTHING on disk and is a measurement instrument only; the
 * shipped tuning is whatever the build says it is.
 *
 * Deterministic: no Math.random, no Date.now, no wall clock in any number
 * that reaches the table. Seeds are a fixed hash of the pair index, chunks
 * are reduced in index order (float addition is not associative, and a table
 * that changed with worker scheduling would not be a measurement), and the
 * same command line always prints the same table. Requires a fresh
 * ./build.sh, because engine-vm.mjs loads the BUILT index.html.
 */
import { makeEngine } from '../test/engine-vm.mjs';
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(SELF), '..');

/* WHICH ENGINE THIS TABLE IS ABOUT. engine-vm.mjs loads the BUILT index.html,
 * and the built bundle is fingerprinted, so the asset name IS the build. This
 * is not decoration. A run of this tool takes half an hour, ./build.sh takes
 * seconds, and a rebuild landing in the middle of a session produced two
 * tables here that looked comparable and were not — one measured the engine
 * before the match-day coach picked XIs and one measured it after, and the
 * only evidence of that was a filename nobody had written down.
 *
 * Each worker loads index.html once when it is forked, so a rebuild DURING a
 * run cannot split a single table; the danger is entirely between runs. The
 * build id is therefore printed on every table, and the parent re-reads it at
 * the end and shouts if it moved. */
function buildId() {
  const m = /assets\/(fo-[^"']+\.js)/.exec(readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  return m ? m[1] : '(no fingerprinted asset — run ./build.sh)';
}

/* The condition cells. The seven pitches under Sunny are the spine — that is
 * the pitch effect with the weather held flat. The rest are the combinations
 * where cricket, and possibly this engine, expects the weather to do the
 * talking: seam-friendly cloud on a green top, the mist, and the dew that is
 * supposed to make a chase easier. dry/flat/cracked + Sunny are not repeated
 * here; they are already in the spine. */
const CELLS = [
  { pitch: 'balanced', weather: 'Sunny' },
  { pitch: 'flat', weather: 'Sunny' },
  { pitch: 'green', weather: 'Sunny' },
  { pitch: 'dry', weather: 'Sunny' },
  { pitch: 'slow', weather: 'Sunny' },
  { pitch: 'cracked', weather: 'Sunny' },
  { pitch: 'twoPaced', weather: 'Sunny' },
  { pitch: 'green', weather: 'Overcast' },
  { pitch: 'green', weather: 'Humid' },
  { pitch: 'green', weather: 'Misty' },
  { pitch: 'dry', weather: 'Dew later' },
  { pitch: 'balanced', weather: 'Drizzle' }
];

/* Four squad match-ups rather than one. The pairing already cancels a
 * strength difference, so this is not about fairness — it is about not
 * measuring one accidental collection of cricketers. Different countries and
 * different archetypes mean different balances of pace, spin and batting
 * depth, which is exactly what a pitch is supposed to reward. The archetype
 * ids are the real ones from FO_ARCHETYPES; an unknown id silently falls back
 * to the first archetype, which would quietly collapse this list into one. */
const SQUAD_PAIRS = [
  [{ seed: 10111, country: 'England', arch: 'engine' }, { seed: 20222, country: 'India', arch: 'wizard' }],
  [{ seed: 30333, country: 'Australia', arch: 'express' }, { seed: 40444, country: 'Pakistan', arch: 'blade' }],
  [{ seed: 50555, country: 'South Africa', arch: 'rock' }, { seed: 60666, country: 'Sri Lanka', arch: 'miser' }],
  [{ seed: 70777, country: 'New Zealand', arch: 'finisher' }, { seed: 80888, country: 'West Indies', arch: 'greybeard' }]
];

const TEAM_A = 'Alpha CC';
const TEAM_B = 'Beta CC';

/* Knuth's multiplicative hash on the pair index. Any deterministic spread
 * would do; what matters is that pair k uses the SAME seed in both cells and
 * in both runs of its own pair, so every number in the table is drawn from
 * one common set of matches and cells are comparable to each other. */
function seedFor(k) { return (((k + 1) * 2654435761) >>> 0) || 1; }

/* One pair of matches: A bats first, then B bats first, same seed, same
 * squads, same conditions. Returns the two bat-first outcomes (1 win, 0 loss,
 * 0.5 tie) and the four innings totals. */
function playPair(eng, tA, tB, cell, seed, neutral) {
  const out = { x: 0, ties: 0, first: [], second: [] };
  for (const firstIsA of [true, false]) {
    const batName = firstIsA ? TEAM_A : TEAM_B;
    // both sheets present, identical in shape — see the header on why the
    // mere presence of an orders object must not be one-sided
    const orders = {
      [TEAM_A]: { tossDecision: firstIsA ? 'bat' : 'bowl' },
      [TEAM_B]: { tossDecision: firstIsA ? 'bowl' : 'bat' }
    };
    const r = eng.sim(tA, tB, cell.pitch, cell.weather, seed, orders, neutral);
    if (!r) throw new Error('sim returned null: ' + cell.pitch + '/' + cell.weather + ' seed ' + seed);
    // THE ASSERT THAT MAKES THE REST OF THE FILE MEAN ANYTHING. If the
    // ordersMap override ever stops reaching aiTossDecision, every row below
    // becomes a measurement of the engine's own coin instead of the toss
    // decision, and it would look completely plausible.
    if (r.batFirstTeam !== batName) {
      throw new Error('toss force did not take: wanted ' + batName + ' batting first, got ' +
        r.batFirstTeam + ' (' + cell.pitch + '/' + cell.weather + ' seed ' + seed + ')');
    }
    const w = r.result && r.result.winner;
    if (!w) { out.x += 0.5; out.ties++; }            // a tie is half a win to each side
    else if (w === batName) out.x += 1;
    out.first.push(r.innings[0] ? r.innings[0].runs : 0);
    out.second.push(r.innings[1] ? r.innings[1].runs : 0);
  }
  return out;
}

/* ---- worker ------------------------------------------------------------- */
/* Each worker builds the VM once (a few seconds — the built bundle is 5 MB)
 * and caches every squad it generates, so the cost is paid once per process
 * rather than once per match. Chunks arrive as {id, cell, from, to}; the
 * partial sums go back keyed by id and the parent reduces them in id order. */
function runWorker() {
  const eng = makeEngine();
  // the --cal overrides ride in on argv so they land before the first match
  // and identically in every worker. applyCal throws if an override did not
  // take, which is the behaviour we want: a silently ignored override would
  // produce a confident measurement of the unchanged engine.
  const calArg = process.argv.indexOf('--calpatch');
  if (calArg > 0) eng.applyCal(JSON.parse(process.argv[calArg + 1]));
  const squadCache = new Map();
  const teamsFor = ix => {
    if (!squadCache.has(ix)) {
      const [a, b] = SQUAD_PAIRS[ix];
      squadCache.set(ix, [
        { name: TEAM_A, players: eng.genSquad(a.seed, a.country, a.arch).players },
        { name: TEAM_B, players: eng.genSquad(b.seed, b.country, b.arch).players }
      ]);
    }
    return squadCache.get(ix);
  };
  process.on('message', msg => {
    if (msg.done) { process.exit(0); return; }
    const t = msg.task;
    const cell = CELLS[t.cell];
    const acc = { pairs: 0, x: 0, xx: 0, ties: 0, first: 0, second: 0, matches: 0 };
    for (let k = t.from; k < t.to; k++) {
      const [tA, tB] = teamsFor(k % SQUAD_PAIRS.length);
      const p = playPair(eng, tA, tB, cell, seedFor(k), t.neutral);
      acc.pairs++;
      acc.x += p.x;
      acc.xx += p.x * p.x;
      acc.ties += p.ties;
      for (const v of p.first) acc.first += v;
      for (const v of p.second) acc.second += v;
      acc.matches += 2;
    }
    process.send({ id: t.id, acc });
  });
  process.send({ ready: true });
}

/* ---- parent ------------------------------------------------------------- */
function parseArgs(argv) {
  const o = { pairs: 400, jobs: Math.max(1, Math.min(4, cpus().length)), neutral: true, cal: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--quick') o.pairs = 40;
    else if (a === '--seeds') o.pairs = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === '--jobs') o.jobs = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === '--home') o.neutral = false;
    else if (a === '--cal') {
      const [k, v] = String(argv[++i] || '').split('=');
      if (!k || v === undefined || !isFinite(Number(v))) throw new Error('--cal wants name=number, got: ' + argv[i]);
      (o.cal = o.cal || {})[k] = Number(v);
    }
    else if (a === '--help' || a === '-h') { o.help = true; }
  }
  return o;
}

function pad(s, n, right) { s = String(s); return right ? s.padStart(n) : s.padEnd(n); }

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) {
    process.stdout.write('usage: node tools/matchday-toss.mjs [--seeds N | --quick] [--jobs N] [--home] [--cal name=value ...]\n');
    return;
  }

  /* Chunk the work small enough that four workers finish within a chunk of
   * each other at the end, and large enough that the message traffic is
   * nothing. Chunks are dispatched to whichever worker is free — the ORDER of
   * completion varies, the arithmetic does not, because every chunk is
   * reduced into its cell's accumulator by chunk id. */
  const CHUNK = 20;
  const tasks = [];
  for (let c = 0; c < CELLS.length; c++) {
    for (let from = 0; from < opt.pairs; from += CHUNK) {
      tasks.push({ id: tasks.length, cell: c, from, to: Math.min(opt.pairs, from + CHUNK), neutral: opt.neutral });
    }
  }
  const results = new Array(tasks.length).fill(null);

  const jobs = Math.min(opt.jobs, tasks.length);
  const buildAtStart = buildId();
  process.stderr.write('matchday-toss: ' + CELLS.length + ' cells x ' + opt.pairs + ' pairs = ' +
    (CELLS.length * opt.pairs * 2) + ' matches, ' + jobs + ' worker(s)' +
    (opt.neutral ? ', neutral ground' : ', home edge ON') +
    (opt.cal ? ', GD.cal overridden: ' + JSON.stringify(opt.cal) : '') + '\n');
  const workerArgv = ['--worker'].concat(opt.cal ? ['--calpatch', JSON.stringify(opt.cal)] : []);

  let next = 0, done = 0;
  await new Promise((resolve, reject) => {
    let live = jobs;
    for (let j = 0; j < jobs; j++) {
      const w = fork(SELF, workerArgv, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      const feed = () => {
        if (next >= tasks.length) { w.send({ done: true }); return; }
        w.send({ task: tasks[next++] });
      };
      w.on('message', m => {
        if (m.ready) { feed(); return; }
        results[m.id] = m.acc;
        done++;
        if (done % 5 === 0 || done === tasks.length) {
          process.stderr.write('  ' + done + '/' + tasks.length + ' chunks\r');
        }
        feed();
      });
      w.on('exit', code => {
        if (code) { reject(new Error('worker exited ' + code)); return; }
        if (--live === 0) resolve();
      });
      w.on('error', reject);
    }
  });
  process.stderr.write('\n');

  // reduce in chunk-id order: deterministic float arithmetic
  const cellAcc = CELLS.map(() => ({ pairs: 0, x: 0, xx: 0, ties: 0, first: 0, second: 0, matches: 0 }));
  for (let i = 0; i < tasks.length; i++) {
    const a = cellAcc[tasks[i].cell], r = results[i];
    if (!r) throw new Error('chunk ' + i + ' never came back');
    a.pairs += r.pairs; a.x += r.x; a.xx += r.xx; a.ties += r.ties;
    a.first += r.first; a.second += r.second; a.matches += r.matches;
  }

  const rows = CELLS.map((cell, i) => {
    const a = cellAcc[i];
    const n = a.pairs;
    const mean = a.x / n;                      // mean pair score, 0..2
    const rate = mean / 2;                     // bat-first win share
    // sample variance of X, then of X/2, then the SE of its mean. The /2 is
    // inside the variance, hence the /4.
    const varX = n > 1 ? Math.max(0, (a.xx - n * mean * mean) / (n - 1)) : 0;
    const se = Math.sqrt(varX / 4 / n);
    const z = se > 0 ? (rate - 0.5) / se : 0;
    return {
      cell, n, matches: a.matches, ties: a.ties, rate, se, z,
      first: a.first / a.matches, second: a.second / a.matches,
      verdict: Math.abs(z) < 2 ? 'no measurable edge' : (z > 0 ? 'BAT' : 'BOWL')
    };
  });

  const H = ['pitch', 'weather', 'pairs', 'matches', 'bat-1st %', 'SE', '1st inns', '2nd inns', 'z', 'verdict'];
  const W = [9, 10, 6, 8, 10, 6, 9, 9, 7, 19];
  process.stdout.write('\n' + H.map((h, i) => pad(h, W[i], i >= 2 && i <= 8)).join(' ') + '\n');
  process.stdout.write(W.map(w => '-'.repeat(w)).join(' ') + '\n');
  for (const r of rows) {
    process.stdout.write([
      pad(r.cell.pitch, W[0]), pad(r.cell.weather, W[1]),
      pad(r.n, W[2], true), pad(r.matches, W[3], true),
      pad((100 * r.rate).toFixed(2), W[4], true),
      pad((100 * r.se).toFixed(2), W[5], true),
      pad(r.first.toFixed(1), W[6], true), pad(r.second.toFixed(1), W[7], true),
      pad(r.z.toFixed(2), W[8], true), pad(r.verdict, W[9])
    ].join(' ') + '\n');
  }

  /* The pooled row is not a verdict, it is a sanity check: with every cell
   * pooled the toss ought to be worth roughly whatever the engine's global
   * bat/chase asymmetry is, and a pooled number miles off the individual
   * cells means the cells disagree with each other, which is the interesting
   * case. Ties are reported because a tie is scored as half a win to each
   * side and a cell full of them would flatten any real effect. */
  const tot = rows.reduce((a, r) => ({
    n: a.n + r.n, m: a.m + r.matches, x: a.x + r.rate * r.n * 2, ties: a.ties + r.ties,
    v: a.v + r.se * r.se * r.n * r.n
  }), { n: 0, m: 0, x: 0, ties: 0, v: 0 });
  const pooledRate = tot.x / (2 * tot.n);
  const pooledSE = Math.sqrt(tot.v) / tot.n;      // cells are independent samples
  process.stdout.write(W.map(w => '-'.repeat(w)).join(' ') + '\n');
  process.stdout.write(pad('POOLED', W[0]) + ' ' + pad('all', W[1]) + ' ' +
    pad(tot.n, W[2], true) + ' ' + pad(tot.m, W[3], true) + ' ' +
    pad((100 * pooledRate).toFixed(2), W[4], true) + ' ' + pad((100 * pooledSE).toFixed(2), W[5], true) + '\n');
  process.stdout.write('\nengine build: ' + buildAtStart + '\n');
  const buildAtEnd = buildId();
  if (buildAtEnd !== buildAtStart) {
    process.stdout.write('WARNING: index.html was rebuilt during this run (' + buildAtEnd + ' now).\n' +
      'This table is still internally consistent — every worker loaded the engine at fork —\n' +
      'but it is NOT comparable with a table measured on the new build. Re-run to compare.\n');
  }
  process.stdout.write('ties scored as half a win to each side: ' + tot.ties + ' of ' + tot.m + ' matches\n');
  // a table measured on an overridden engine must never be quoted as the
  // engine's behaviour, so it says so on the table itself and not only in the
  // command line that scrolled off the top
  if (opt.cal) process.stdout.write('NOT THE SHIPPED ENGINE — GD.cal overridden: ' + JSON.stringify(opt.cal) + '\n');
  if (!opt.neutral) process.stdout.write('home edge ON (first-named club is at home in both runs of every pair)\n');
  process.stdout.write('verdict = |bat-1st% - 50| > 2 SE. "no measurable edge" means THIS RUN could not\n' +
    'see one, not that none exists; the resolvable effect is about ' +
    (2 * 100 * pooledSE * Math.sqrt(CELLS.length)).toFixed(1) + ' points per cell at this N.\n');
}

if (process.argv.includes('--worker')) runWorker();
else main().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
