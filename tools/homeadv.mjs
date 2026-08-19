import { makeEngine } from '../test/engine-vm.mjs';
const eng = makeEngine();
const N = 1000;
const play = (P, salt) => {
  let h = 0, a = 0;
  for (let i = 0; i < N; i++) {
    const r = eng.sim({ name: 'Home', players: P }, { name: 'Away', players: P.map(x => ({ ...x })) },
      'balanced', 'Sunny', (i * 2654435761 + salt) >>> 0 || 1);
    if (!r || !r.result) continue;
    if (r.result.winner === 'Home') h++; else if (r.result.winner === 'Away') a++;
  }
  return 100 * h / (h + a);
};
const out = [];
for (const seed of [4242, 7788, 1001, 2002, 3003, 5005]) {
  const P = eng.genSquad(seed, 'England', 'balanced').players;
  const pc = play(P, 11);
  out.push(pc);
  console.log('seed', seed, 'home', pc.toFixed(1) + '%');
}
console.log('mean', (out.reduce((a,b)=>a+b,0)/out.length).toFixed(2) + '%');
