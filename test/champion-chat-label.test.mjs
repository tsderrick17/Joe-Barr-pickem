import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/20260921010000_fix_bowl_pool_champion_chat_label.sql', import.meta.url),
  'utf8',
);

test('championship chat announcements use the correct label for each pool', () => {
  assert.match(migration, /when 'pickem' then 'Pick''em'/);
  assert.match(migration, /when 'survivor' then 'Survivor'/);
  assert.match(migration, /when 'bowl' then 'Bowl Pool'/);
  assert.match(migration, /on conflict \(championship_id\) do nothing/);
});
