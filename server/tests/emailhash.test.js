process.env.EMAIL_HASH_KEY = 'test-key';
const test = require('node:test');
const assert = require('node:assert/strict');
const { emailHash } = require('../src/services/notices');

test('emailHash ignores case and whitespace', () => {
  assert.equal(emailHash('Ada@Example.com '), emailHash('ada@example.com'));
  assert.notEqual(emailHash('a@example.com'), emailHash('b@example.com'));
});