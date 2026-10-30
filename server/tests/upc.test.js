const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Load the controller with a fake database pool so no Postgres is needed.
const poolPath = require.resolve('../src/db/pool');
let calls = [];
let result = { rows: [{ id: 'r1', upc: '036000291452' }] };
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { query: async (sql, args) => { calls.push({ sql, args }); return result; } } };
const { setUpc } = require('../src/controllers/releaseController');

const run = async (body, user = { id: 'u1' }, params = { id: 'r1' }) => {
    let status = 200, json;
    const res = { status(c) { status = c; return this; }, json(j) { json = j; return this; } };
    await setUpc({ body, user, params }, res);
    return { status, json };
};

test('saves a valid UPC for the owner, whatever the release status', async () => {
    calls = [];
    const r = await run({ upc: ' 036000291452 ' });
    assert.equal(r.status, 200);
    assert.deepEqual(calls[0].args, ['036000291452', 'r1', 'u1']);
    assert.ok(!/status/.test(calls[0].sql), 'must not depend on draft/ready status');
    assert.ok(/owner_id = \$3/.test(calls[0].sql));
});
test('rejects a UPC that is not 12 or 13 digits, without touching the database', async () => {
    calls = [];
    for (const bad of ['12345', '03600029145X', '12345678901234', 123456789012, undefined]) {
        const r = await run({ upc: bad });
        assert.equal(r.status, 400, String(bad));
    }
    assert.equal(calls.length, 0);
});
test('404 when the release is not the caller\'s', async () => {
    result = { rows: [] };
    const r = await run({ upc: '036000291452' });
    assert.equal(r.status, 404);
});
