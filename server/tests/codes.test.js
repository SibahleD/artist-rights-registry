const test = require('node:test');
const assert = require('node:assert/strict');
const { optionalIpi, optionalLanguage, optionalCountry } = require('../src/lib/codes');

test('language codes are lowercased and validated', () => {
  assert.equal(optionalLanguage()(' RW ').value, 'rw');
  assert.equal(optionalLanguage()('').value, null);
  assert.ok(optionalLanguage()('english').error);
});

test('country codes are uppercased and validated', () => {
  assert.equal(optionalCountry()('rw').value, 'RW');
  assert.ok(optionalCountry()('RWA').error);
});

test('IPI strips separators and needs 9 to 11 digits', () => {
  assert.equal(optionalIpi()('123.456.789').value, '123456789');
  assert.ok(optionalIpi()('12345678').error);
  assert.equal(optionalIpi()(null).value, null);
});
