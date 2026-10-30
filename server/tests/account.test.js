const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    splitLegalName, validatePreferences, withDefaults, validateNewPassword, normaliseEmail, tokenPredatesPasswordChange,
} = require('../src/lib/account');

test('preferences: accepts known keys with valid values', () => {
    assert.deepEqual(validatePreferences({ analytics_opt_in: true, notify_disputes: false }).value, { analytics_opt_in: true, notify_disputes: false });
});

test('preferences: rejects unknown keys, bad values, empty and non-object bodies', () => {
    assert.match(validatePreferences({ colour: 'red' }).error, /Unknown preference/);
    assert.match(validatePreferences({ theme: 'dark' }).error, /Unknown preference/);   // there is no theme setting
    assert.ok(validatePreferences({ analytics_opt_in: 'yes' }).error);
    assert.ok(validatePreferences({}).error);
    assert.ok(validatePreferences(null).error);
    assert.ok(validatePreferences([]).error);
});

test('preferences: defaults fill gaps and ignore corrupt stored values', () => {
    const p = withDefaults({ play_counts_opt_in: true, notify_approvals: 'nope', junk: 1 });
    assert.equal(p.play_counts_opt_in, true);      // a valid stored value is kept
    assert.equal(p.notify_approvals, true);       // corrupt value falls back to the default
    assert.equal(p.analytics_opt_in, false);
    assert.equal('junk' in p, false);
    assert.deepEqual(withDefaults(undefined), { analytics_opt_in: false, play_counts_opt_in: false, notify_emails: false, notify_disputes: true, notify_approvals: true });
});

test('preferences: notify_emails is off by default and must be a boolean', () => {
    assert.equal(withDefaults(undefined).notify_emails, false);
    assert.equal(withDefaults({}).notify_emails, false);
    assert.equal(withDefaults({ notify_emails: true }).notify_emails, true);
    assert.equal(withDefaults({ notify_emails: 'yes' }).notify_emails, false);   // corrupt value falls back to off
    assert.deepEqual(validatePreferences({ notify_emails: true }).value, { notify_emails: true });
    assert.ok(validatePreferences({ notify_emails: 'on' }).error);
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

test('optional email: nothing is sent for a new account until notify_emails is switched on', () => {
    const { wantsOptionalEmail } = require('../src/lib/account');
    assert.equal(wantsOptionalEmail(undefined, 'disputes'), false);
    assert.equal(wantsOptionalEmail({}, 'approvals'), false);
    assert.equal(wantsOptionalEmail({ notify_disputes: true, notify_approvals: true }, 'disputes'), false); // kind on, master off
    assert.equal(wantsOptionalEmail({ notify_emails: true }, 'disputes'), true);
    assert.equal(wantsOptionalEmail({ notify_emails: true, notify_disputes: false }, 'disputes'), false);
    assert.equal(wantsOptionalEmail({ notify_emails: true, notify_approvals: false }, 'approvals'), false);
    assert.equal(wantsOptionalEmail({ notify_emails: 'yes' }, 'disputes'), false);   // corrupt value
    assert.equal(wantsOptionalEmail({ notify_emails: true }, 'marketing'), false);   // unknown kind
});
