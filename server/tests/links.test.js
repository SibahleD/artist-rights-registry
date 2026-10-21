const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLinkInput, SERVICES, BY_ID } = require('../src/lib/services');

test('a known service takes its label and kind from the list, not the request', () => {
    const r = parseLinkInput({ service: 'spotify', label: 'ignored', kind: 'social', url: ' https://open.spotify.com/artist/x ' });
    assert.deepEqual(r.link, { service: 'spotify', label: 'Spotify', kind: 'streaming', url: 'https://open.spotify.com/artist/x' });
});

test('"other" needs a label and a valid kind', () => {
    assert.match(parseLinkInput({ service: 'other', url: 'https://a.example/x' }).error, /name/);
    assert.match(parseLinkInput({ service: 'other', label: 'x'.repeat(61), url: 'https://a.example/x' }).error, /name/);
    assert.match(parseLinkInput({ service: 'other', label: 'Mine', kind: 'nope', url: 'https://a.example/x' }).error, /Kind/);
    assert.deepEqual(parseLinkInput({ service: 'other', label: ' Mine ', url: 'https://a.example/x' }).link,
        { service: 'other', label: 'Mine', kind: 'other', url: 'https://a.example/x' });
    assert.equal(parseLinkInput({ service: 'other', label: 'Mine', kind: 'social', url: 'https://a.example/x' }).link.kind, 'social');
});

test('unknown or missing service is refused', () => {
    assert.match(parseLinkInput({ service: 'myspace', url: 'https://a.example' }).error, /service/);
    assert.match(parseLinkInput({ url: 'https://a.example' }).error, /service/);
    assert.match(parseLinkInput(null).error, /service/);
});

test('only https addresses are accepted', () => {
    for (const url of ['', 'http://a.example', 'ftp://a.example', 'javascript:alert(1)', 'a.example', 'https://', 'https://a.example/' + 'x'.repeat(500)]) {
        assert.ok(parseLinkInput({ service: 'x', url }).error, url);
    }
    assert.ok(parseLinkInput({ service: 'x', url: 'HTTPS://x.com/me' }).link);
});

test('updating keeps stored fields that are not sent', () => {
    const existing = { service: 'other', label: 'My site', kind: 'store', url: 'https://a.example/x' };
    assert.deepEqual(parseLinkInput({ url: 'https://b.example/y' }, existing).link,
        { service: 'other', label: 'My site', kind: 'store', url: 'https://b.example/y' });
    assert.equal(parseLinkInput({ service: 'tiktok' }, existing).link.kind, 'social');
});

test('service ids are unique and the old platforms are all still present', () => {
    assert.equal(new Set(SERVICES.map((s) => s[0])).size, SERVICES.length);
    for (const id of ['spotify', 'apple_music', 'soundcloud', 'youtube', 'instagram', 'tiktok', 'x']) assert.ok(BY_ID[id], id);
});
