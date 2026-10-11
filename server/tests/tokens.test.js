const test = require('node:test');
const assert = require('node:assert/strict');
const { newToken, hashToken } = require('../src/services/tokens');

test('hash matches raw token and tokens are unique', () => {
  const a = newToken(), b = newToken();
  assert.equal(a.hash, hashToken(a.raw));
  assert.notEqual(a.raw, b.raw);
  assert.notEqual(a.raw, a.hash);
});