// youth.mjs — THE ACADEMY
//
// Every club runs one. It holds a few colts, it costs money to keep and more
// to improve, and once a season it produces a cricketer. The rules are the
// umpire's, not the manager's, so a club nobody logs into still brings boys
// through:
//
//   - the academy holds up to 2 + level colts (four at the default level two)
//   - a new boy arrives whenever there is room, one per intake window
//   - at the rollover every colt ages a year, and a colt who reaches 21 is
//     handed a senior shirt whether anyone was watching or not
//   - what a boy IS comes from the shipped generator seeded on
//     'youth|country|slot|season|index' - so re-running any tick produces the
//     same young cricketers, and nothing here can drift
//
// A better academy makes better boys: the level scales how much of a grown
// cricketer's skill a seventeen-year-old already has, and how close to ready
// he arrives.
import { countryConfigs } from './init-world.mjs';

export const CAP = lv => 2 + Math.max(1, Math.min(5, lv || 2));
export const UPKEEP_PER_ROUND = 900;        // what an academy level costs a round
const PROMOTE_AT = 21;

// the same 32-bit hash the client and the world generator use
function h32(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// A COLT IS A GROWN CRICKETER, NOT YET GROWN. The generator makes the man he
// will be; the academy decides how much of that man has arrived. Everything is
// a pure function of the seed, so the same boy appears on every re-run.
export function makeColt(host, country, arch, seed, level) {
  const src = host.genSquad(seed, country, arch || 'balanced', 'general') || [];
  if (!src.length) return null;
  const h = h32(seed);
  const p = JSON.parse(JSON.stringify(src[h % src.length]));
  const age = 17 + (h32(seed + '|age') % 4);            // 17-20
  // raw: a colt has between half and four-fifths of the man in him, and a
  // stronger academy turns them out closer to finished
  const share = 0.50 + 0.045 * Math.max(1, Math.min(5, level || 2)) + 0.035 * (age - 17);
  const scale = v => (typeof v === 'number' ? Math.max(1, Math.round(v * share)) : v);
  p.age = age;
  p.colt = true;
  p.promise = Math.round(share * 100);                   // how far along he is
  if (p.skills) { const s = {}; for (const k in p.skills) s[k] = scale(p.skills[k]); p.skills = s; }
  if (typeof p.exp === 'number') p.exp = scale(p.exp);    // a boy has seen nothing yet
  // the fifteen skills are the man; everything else on the card - his batting,
  // his threat, his rating, his price - is the ENGINE'S function of them, so
  // let the engine work it out rather than scaling the answers by hand
  // - the wage included: a boy is cheap because a boy is small, not because
  // anyone discounted him, and the club pays the academy's upkeep for him
  // until the day he is handed a senior shirt
  const colt = host.derive([p])[0] || p;
  // the cricketer he was made IS the boy, not the man he was cut down from -
  // so when he graduates the nets build on the colt, and nothing he does in
  // the academy is ever mistaken for training he has not done
  colt.baseSkills = JSON.parse(JSON.stringify(colt.skills || {}));
  colt.baseExp = colt.exp;
  delete colt.career; delete colt.formIx; delete colt.formWord;
  delete colt.fatN; delete colt.fatWord; delete colt.trainProgress;
  return colt;
}

// the same nation config the world was founded from, so an England colt is an
// England cricketer and a Kandahar colt is an Afghan one
function archOf(host, country) {
  const r = countryConfigs(host).filter(x => x.id === country)[0];
  return r ? { nat: r.nat, arch: r.arch } : { nat: 'England', arch: 'balanced' };
}

// Fill every academy to its capacity, one boy per call per club: a season's
// intake arrives over the season, not all on day one. Idempotent by name.
export async function ensureYouth(pool, host, country, { seasonNo, round }) {
  const clubs = (await pool.query(
    'SELECT slot, academy, youth FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const cfg = archOf(host, country);
  let added = 0;
  for (const c of clubs) {
    const youth = Array.isArray(c.youth) ? c.youth : [];
    if (youth.length >= CAP(c.academy)) continue;
    const seed = 'youth|' + country + '|' + c.slot + '|s' + seasonNo + '|r' + round;
    const colt = makeColt(host, cfg.nat, cfg.arch, seed, c.academy);
    if (!colt) continue;
    // a name already on the books (a re-run) is never doubled
    if (youth.some(y => y && y.name === colt.name)) continue;
    youth.push(colt);
    await pool.query('UPDATE clubs SET youth=$3::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(youth)]);
    added++;
  }
  return added;
}

// A SENIOR SHIRT, and a note of the round he first wore it. A man only ever
// works the rounds in the nets he was actually at the club for, so a boy who
// comes up in season three is not handed three seasons of other men's training.
function graduate(colt, seasonNo, round) {
  const q = Object.assign({}, colt, { joined: { s: seasonNo, r: round } });
  delete q.colt; delete q.promise;
  return q;
}

// THE ROLLOVER: a year on every colt, and a senior shirt for anyone who has
// reached twenty-one. Keyed by season so a re-run never ages a boy twice.
export async function ageYouth(pool, country, seasonNo) {
  const key = country + ':youth:s' + seasonNo;
  const claim = await pool.query(
    `INSERT INTO ticks(key, status) VALUES ($1,'running')
     ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
  if (claim.rows[0].status === 'done') return { skipped: true, promoted: 0 };
  const clubs = (await pool.query(
    'SELECT slot, squad, youth FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  let promoted = 0;
  for (const c of clubs) {
    const youth = (Array.isArray(c.youth) ? c.youth : []).map(y => Object.assign({}, y, { age: (y.age || 18) + 1 }));
    const up = youth.filter(y => y.age >= PROMOTE_AT);
    const stay = youth.filter(y => y.age < PROMOTE_AT);
    const squad = (c.squad || []).concat(up.map(y => graduate(y, seasonNo + 1, 1)));
    promoted += up.length;
    await pool.query('UPDATE clubs SET youth=$3::jsonb, squad=$4::jsonb WHERE country_id=$1 AND slot=$2',
      [country, c.slot, JSON.stringify(stay), JSON.stringify(squad)]);
  }
  await pool.query(`UPDATE ticks SET status='done', finished_at=now() WHERE key=$1`, [key]);
  return { skipped: false, promoted };
}
