// These tests use no database. The pool is created lazily, so a placeholder lets the route modules load without one.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const VARS = ['AUTH_RATE_LIMIT', 'ACCOUNT_RATE_LIMIT', 'NOTICE_RATE_LIMIT', 'API_RATE_LIMIT'];
const { limitFor, makeLimiter, apiLimiter } = require('../src/rateLimits');

// Run a test with chosen values for the four variables, then put the environment back as it was.
async function withEnv(values, fn) {
  const saved = Object.fromEntries(VARS.map((k) => [k, process.env[k]]));
  for (const k of VARS) delete process.env[k];
  Object.assign(process.env, values);
  try { return await fn(); }
  finally { for (const k of VARS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}

// Start an app on a free port, run the test against it, and always shut it down.
async function serve(app, fn) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((r) => server.close(r)); }
}

const statuses = async (url, init, times) => {
  const out = [];
  for (let i = 0; i < times; i++) out.push((await fetch(url, init)).status);
  return out;
};

test('production defaults apply when nothing is set', () => withEnv({}, () => {
  assert.equal(limitFor('auth'), 10);
  assert.equal(limitFor('account'), 10);
  assert.equal(limitFor('notice'), 30);
  assert.equal(limitFor('api'), 600);
}));

test('each variable changes only its own limit', () => withEnv({ ACCOUNT_RATE_LIMIT: '1000', API_RATE_LIMIT: '10000' }, () => {
  assert.equal(limitFor('account'), 1000);
  assert.equal(limitFor('api'), 10000);
  assert.equal(limitFor('auth'), 10);
  assert.equal(limitFor('notice'), 30);
}));

test('empty, zero, negative or non-numeric values fall back to the default', () => {
  for (const bad of ['', '0', '-5', 'abc', 'NaN']) {
    withEnv({ AUTH_RATE_LIMIT: bad }, () => assert.equal(limitFor('auth'), 10, `value "${bad}"`));
  }
});

test('a limiter answers 429 with a JSON error once the limit is used up', () => withEnv({ AUTH_RATE_LIMIT: '2' }, async () => {
  const app = express();
  app.get('/x', makeLimiter('auth'), (_req, res) => res.json({ ok: true }));
  await serve(app, async (base) => {
    assert.deepEqual(await statuses(`${base}/x`, {}, 3), [200, 200, 429]);
    const blocked = await fetch(`${base}/x`);
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /too many/i);
  });
}));

test('the API limiter counts normal routes but not /api/media', () => withEnv({ API_RATE_LIMIT: '2' }, async () => {
  const app = express();
  app.use('/api', apiLimiter());
  app.get('/api/releases', (_req, res) => res.json({ ok: true }));
  app.get('/api/media/cover/1', (_req, res) => res.json({ ok: true }));
  await serve(app, async (base) => {
    assert.deepEqual(await statuses(`${base}/api/media/cover/1`, {}, 6), [200, 200, 200, 200, 200, 200]);
    assert.deepEqual(await statuses(`${base}/api/releases`, {}, 3), [200, 200, 429]);
  });
}));

// The routes must use the limiter, not a private copy of the old fallback.
test('the login route stops at the AUTH_RATE_LIMIT', () => withEnv({ AUTH_RATE_LIMIT: '2' }, async () => {
  delete require.cache[require.resolve('../src/routes/auth')];   // the limiter reads the variable when the router loads
  const authRoutes = require('../src/routes/auth');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  await serve(app, async (base) => {
    const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };   // empty login: 400 before any database call
    assert.deepEqual(await statuses(`${base}/api/auth/login`, init, 3), [400, 400, 429]);
  });
}));

test('the public notice route stops at the NOTICE_RATE_LIMIT', () => withEnv({ NOTICE_RATE_LIMIT: '1' }, async () => {
  delete require.cache[require.resolve('../src/routes/publicNotices')];
  const noticeRoutes = require('../src/routes/publicNotices');
  const app = express();
  app.use('/api/notices', noticeRoutes);
  app.use((req, res, next) => next());   // anything past the limiter ends in a 404 or error, never a 429
  await serve(app, async (base) => {
    const [first, second] = await statuses(`${base}/api/notices/not-a-real-token`, {}, 2);
    assert.notEqual(first, 429);
    assert.equal(second, 429);
  });
}));
