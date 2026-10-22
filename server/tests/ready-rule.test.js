// The rule, without a database: a shared song needs every non-owner credit with a share to be confirmed.
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.EMAIL_HASH_KEY ||= 'test-key';
process.env.DATABASE_URL ||= 'postgres://x:x@127.0.0.1:1/x';
const poolPath = require.resolve('../src/db/pool');
const { emailHash } = require('../src/services/notices');

const owner = { id: 'o1', email: 'me@example.com', first_name: 'Ada', last_name: 'Obi', artist_name: 'Kenny TL' };
const release = { id: 'r1', owner_id: 'o1' };
const person = (o) => ({ track_id: 't1', track_number: 1, title: 'Song', user_id: null, invited_email: null, role: 'songwriter', removed_by_writer: false, ...o });

// Stub the pool so noticeReadiness reads our rows.
function run(people, notices = []) {
  require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: {
    query: async (sql) => (/FROM collaborators/.test(sql) ? { rows: people } : /collaborator_notices/.test(sql) ? { rows: notices } : { rows: [owner] }),
  } };
  delete require.cache[require.resolve('../src/services/notices')];
  return require('../src/services/notices').noticeReadiness(release);
}
const notice = (email, status, pct, extra = {}) => ({ track_id: 't1', email_hash: emailHash(email), role: 'songwriter', share_percent: pct, status, ...extra });

test('a solo song needs nothing', async () => {
  const r = await run([person({ id: 'c1', legal_name: 'Ada Obi', ownership_percent: '100' })]);
  assert.deepEqual(r.errors, []);
});

test('a second credit with a share blocks until confirmed, and says who and what to do', async () => {
  const people = [person({ id: 'c1', legal_name: 'Ada Obi', ownership_percent: '70' }),
    person({ id: 'c2', legal_name: 'Sam K', invited_email: 'sam@example.com', ownership_percent: '30' })];
  let r = await run(people);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].level, 'error');
  assert.match(r.items[0].message, /Waiting for Sam K to confirm their 30%\. Send them the invitation/);
  r = await run(people, [notice('sam@example.com', 'pending', 30)]);
  assert.match(r.items[0].message, /reminder/);
  r = await run(people, [notice('sam@example.com', 'confirmed', 30)]);
  assert.deepEqual(r.errors, []);
});

test('no email, expired invitation and a changed share all block with their own advice', async () => {
  const sam = (extra) => [person({ id: 'c1', legal_name: 'Ada Obi', ownership_percent: '70' }), person({ id: 'c2', legal_name: 'Sam K', ownership_percent: '30', ...extra })];
  assert.match((await run(sam({}))).errors[0], /Add their email/);
  assert.match((await run(sam({ invited_email: 'sam@example.com' }), [notice('sam@example.com', 'expired', 30)])).errors[0], /expired/);
  assert.match((await run(sam({ invited_email: 'sam@example.com' }), [notice('sam@example.com', 'confirmed', 25)])).errors[0], /changed after the notice/);
});

test('a dispute and a removed co-writer block; a 0% featured credit does not', async () => {
  const base = [person({ id: 'c1', legal_name: 'Ada Obi', ownership_percent: '100' })];
  const feat = person({ id: 'c2', legal_name: 'Lia M', role: 'performer', ownership_percent: '0' });
  assert.deepEqual((await run([...base, feat])).errors, []);
  const sam = person({ id: 'c3', legal_name: 'Sam K', invited_email: 'sam@example.com', ownership_percent: '0' });
  assert.match((await run([...base, sam], [notice('sam@example.com', 'disputed', 0)])).errors[0], /disputed/);
  const gone = person({ id: 'c4', legal_name: 'Gone', ownership_percent: '30', removed_by_writer: true });
  assert.match((await run([...base, gone])).errors[0], /removed themselves/);
});
