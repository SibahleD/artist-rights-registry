const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    splitLegalName, validatePreferences, withDefaults, validateNewPassword, normaliseEmail, tokenPredatesPasswordChange,
} = require('../src/lib/account');

test('preferences: accepts known keys with valid values', () => {
    assert.deepEqual(validatePreferences({ theme: 'dark', notify_disputes: false }).value, { theme: 'dark', notify_disputes: false });
});

test('preferences: rejects unknown keys, bad values, empty and non-object bodies', () => {
    assert.match(validatePreferences({ colour: 'red' }).error, /Unknown preference/);
    assert.ok(validatePreferences({ theme: 'neon' }).error);
    assert.ok(validatePreferences({ analytics_opt_in: 'yes' }).error);
    assert.ok(validatePreferences({}).error);
    assert.ok(validatePreferences(null).error);
    assert.ok(validatePreferences([]).error);
});

test('preferences: defaults fill gaps and ignore corrupt stored values', () => {
    const p = withDefaults({ theme: 'light', notify_approvals: 'nope', junk: 1 });
    assert.equal(p.theme, 'light');
    assert.equal(p.notify_approvals, true);       // corrupt value falls back to the default
    assert.equal(p.analytics_opt_in, false);
    assert.equal('junk' in p, false);
    assert.equal(withDefaults(undefined).theme, 'system');
});

test('password: length and byte limits match registration', () => {
    assert.ok(validateNewPassword('short'));
    assert.ok(validateNewPassword(undefined));
    assert.equal(validateNewPassword('longenough'), null);
    assert.ok(validateNewPassword('é'.repeat(37)));      // 74 bytes
    assert.equal(validateNewPassword('é'.repeat(36)), null); // 72 bytes
});

test('email: trimmed, lowercased, and shape-checked', () => {
    assert.equal(normaliseEmail('  Me@Example.COM '), 'me@example.com');
    assert.equal(normaliseEmail('not-an-email'), null);
    assert.equal(normaliseEmail('a b@c.de'), null);
    assert.equal(normaliseEmail(''), null);
    assert.equal(normaliseEmail(42), null);
});

test('sessions: tokens older than the last password change are rejected', () => {
    const changed = new Date('2026-10-21T12:00:00Z');
    const sec = Math.floor(changed.getTime() / 1000);
    assert.equal(tokenPredatesPasswordChange(sec - 1, changed), true);
    assert.equal(tokenPredatesPasswordChange(sec, changed), false);       // the fresh token is accepted
    assert.equal(tokenPredatesPasswordChange(sec + 60, changed), false);
    assert.equal(tokenPredatesPasswordChange(sec - 1000, null), false);   // never changed
});

test('legal name: split on the last space, blanks and single words handled', () => {
    assert.deepEqual(splitLegalName('Jane Doe'), { first: 'Jane', last: 'Doe' });
    assert.deepEqual(splitLegalName('  Jean   Claude Van Damme '), { first: 'Jean Claude Van', last: 'Damme' });
    assert.deepEqual(splitLegalName('Madonna'), { first: 'Madonna', last: null });
    assert.deepEqual(splitLegalName(''), { first: null, last: null });
    assert.deepEqual(splitLegalName(undefined), { first: null, last: null });
    assert.deepEqual(splitLegalName(42), { first: null, last: null });
});
