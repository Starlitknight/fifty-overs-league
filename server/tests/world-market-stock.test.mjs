// the close-season shelf: free agents must walk on with no season running
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockMarket } from '../market.mjs';

test('stockMarket needs no live season and asks every league', async () => {
  const asked = [];
  const pool = {
    query: async (sql, args) => {
      if (/FROM seasons/.test(sql)) return { rows: [{ country_id: 'eng', season_no: 1 }, { country_id: 'aus', season_no: 1 }] };
      if (/count\(\*\)::int AS all_open/.test(sql)) return { rows: [{ all_open: 0, fa_open: 0 }] };
      if (/FROM clubs, jsonb_array_elements/.test(sql)) return { rowCount: 0, rows: [] };
      if (/INSERT INTO listings/.test(sql)) { asked.push(args[0]); return { rowCount: 1, rows: [{ id: asked.length }] }; }
      return { rows: [], rowCount: 0 };
    }
  };
  const host = {
    worldConfig: () => ([{ id: 'eng', sides: [] }, { id: 'aus', sides: [] }]),
    genSquad: () => ([{ name: 'A Man', rating: 40000, role: 'topOrderBat', wage: 900 },
                                   { name: 'B Man', rating: 39000, role: 'fastBowler', wage: 900 },
                                   { name: 'C Man', rating: 38000, role: 'fastBowler', wage: 900 },
                                   { name: 'D Man', rating: 37000, role: 'topOrderBat', wage: 900 },
                                   { name: 'E Man', rating: 36000, role: 'fastBowler', wage: 900 }]) };
  const out = await stockMarket(pool, host, { now: Date.now() });
  assert.ok(out.length >= 1, 'some league was stocked');
  assert.ok(asked.includes('eng'), 'England had men walked on');
  assert.ok(asked.includes('aus'), 'Australia had men walked on');
});

test('stockMarket is a no-op without an engine host', async () => {
  const out = await stockMarket({ query: async () => ({ rows: [] }) }, null, { now: Date.now() });
  assert.deepEqual(out, []);
});
