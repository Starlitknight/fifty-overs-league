// Deal the draft for a league: lock the manager count, generate a real engine
// master pool (multiple of N), snake-deal into equal private buckets, persist one
// per manager. Run by the deal-draft GitHub Action (founder triggers it).
//
//   node deal.mjs <league_id> [perManager=15]
import { openEngine, genMasterPool, buildHash } from './resolve.mjs';
import { assertEnv, rpc, leaguePin } from './sbrest.mjs';
import { snakeDeal, dealReport } from '../supabase/functions/_shared/draft.js';

assertEnv();
const leagueId = process.argv[2];
const perManager = Number(process.argv[3] || 15);
if (!leagueId) { console.error('usage: node deal.mjs <league_id> [perManager]'); process.exit(1); }

const pin = await leaguePin(leagueId);
if (pin !== buildHash()) {
  console.error(`engine hash ${buildHash().slice(0,12)}… != league pin ${String(pin).slice(0,12)}…`);
  process.exit(1);
}

// 1) freeze manager count; get manager_ids in deal order
const managers = await rpc('lock_managers', { p_league_id: leagueId });
const N = managers.length;
if (N < 2) { console.error(`need >=2 managers, have ${N}`); process.exit(1); }

// 2) real engine master pool sized as a multiple of N
const eng = await openEngine();
const need = perManager * N;
const master = await genMasterPool(eng.page, 'pool-' + leagueId, need);
await eng.close();
if (master.length < need) { console.error(`only ${master.length} players, need ${need}`); process.exit(1); }

// 3) snake-deal + persist
const buckets = snakeDeal(master.slice(0, need), N);
console.log('deal report:', JSON.stringify(dealReport(buckets)));
for (let i = 0; i < N; i++) {
  await rpc('write_draft_pool', { p_league_id: leagueId, p_manager_id: managers[i], p_players: buckets[i] });
  console.log(`bucket ${i + 1}/${N} written (${buckets[i].length} players) to manager ${managers[i]}`);
}
console.log(`done: dealt ${need} players to ${N} managers.`);
