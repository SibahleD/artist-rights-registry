const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSocietyInput } = require('../src/lib/societies');

const NOW = new Date('2026-10-22T12:00:00Z');
const ok = (body, existing) => parseSocietyInput(body, existing, NOW).society;
const bad = (body, existing) => parseSocietyInput(body, existing, NOW).error;

test('a new entry needs a name and a country, and starts as planned', () => {
    assert.deepEqual(ok({ body_name: ' COSOTA ', country: 'tz' }),
        { body_name: 'COSOTA', country: 'TZ', status: 'planned', registered_on: null, member_ref: null });
    assert.match(bad({ country: 'TZ' }), /name/);
    assert.match(bad({ body_name: 'x'.repeat(121), country: 'TZ' }), /name/);
    assert.match(bad({ body_name: 'COSOTA' }), /country/);
    assert.match(bad({ body_name: 'COSOTA', country: 'TZA' }), /country/);
    assert.equal(ok({ body_name: 'Songtrust', country: 'INT' }).country, 'INT');
    assert.match(bad(null), /name/);
});

test('status must be one of the three', () => {
    for (const status of ['applied', 'registered', 'planned']) assert.equal(ok({ body_name: 'A', country: 'KE', status }).status, status);
    assert.match(bad({ body_name: 'A', country: 'KE', status: 'member' }), /Status/);
    assert.match(bad({ body_name: 'A', country: 'KE', status: null }), /Status/);
});

test('the date is only kept once registered, and must be real and not in the future', () => {
    const base = { body_name: 'A', country: 'KE' };
    assert.equal(ok({ ...base, status: 'registered', registered_on: '2026-05-01' }).registered_on, '2026-05-01');
    assert.equal(ok({ ...base, status: 'registered', registered_on: '2026-10-22' }).registered_on, '2026-10-22');
    assert.equal(ok({ ...base, status: 'applied', registered_on: '2026-05-01' }).registered_on, null);
    assert.equal(ok({ ...base, status: 'registered', registered_on: '' }).registered_on, null);
    assert.match(bad({ ...base, status: 'registered', registered_on: '2026-10-23' }), /future/);
    assert.match(bad({ ...base, status: 'registered', registered_on: '2026-02-30' }), /real date/);
    assert.match(bad({ ...base, status: 'registered', registered_on: '01/05/2026' }), /real date/);
    assert.match(bad({ ...base, status: 'registered', registered_on: 20260501 }), /real date/);
});

test('the member number is trimmed, optional and bounded', () => {
    const base = { body_name: 'A', country: 'KE' };
    assert.equal(ok({ ...base, member_ref: '  KE-1234 ' }).member_ref, 'KE-1234');
    assert.equal(ok({ ...base, member_ref: '   ' }).member_ref, null);
    assert.equal(ok({ ...base, member_ref: '' }).member_ref, null);
    assert.match(bad({ ...base, member_ref: 'x'.repeat(101) }), /member number/);
    assert.match(bad({ ...base, member_ref: 'a\nb' }), /member number/);
    assert.match(bad({ ...base, member_ref: 42 }), /member number/);
});

test('updating changes only status, date and member number, and keeps what is not sent', () => {
    const existing = { body_name: 'UPRS', country: 'UG', status: 'applied', registered_on: null, member_ref: 'APP-9' };
    assert.deepEqual(ok({ body_name: 'Other', country: 'KE', status: 'registered', registered_on: '2026-09-01' }, existing),
        { body_name: 'UPRS', country: 'UG', status: 'registered', registered_on: '2026-09-01', member_ref: 'APP-9' });
    assert.deepEqual(ok({}, existing), existing);
    assert.equal(ok({ member_ref: null }, existing).member_ref, null);
});

test('moving back from registered clears the date', () => {
    const existing = { body_name: 'UPRS', country: 'UG', status: 'registered', registered_on: '2026-09-01', member_ref: null };
    assert.equal(ok({ status: 'applied' }, existing).registered_on, null);
    assert.equal(ok({ member_ref: 'M1' }, existing).registered_on, '2026-09-01');
});
