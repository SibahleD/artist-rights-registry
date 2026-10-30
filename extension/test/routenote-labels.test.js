const fs = require('fs'), path = require('path'), assert = require('assert')
const profile = new Function(fs.readFileSync(path.join(__dirname, '..', 'routenote.js'), 'utf8') + '; return ROUTENOTE_PROFILE')()
const hits = (spec, label) => new RegExp(spec.re, 'i').test(label) && !(spec.not && new RegExp(spec.not, 'i').test(label))
const opt = (re, label) => new RegExp(re, 'i').test(label)
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok -', name) }

test('release labels as RouteNote words them', () => {
  assert.ok(hits(profile.albumVersion, 'Album Version'))
  assert.ok(hits(profile.originallyReleased, 'Originally Released'))
  assert.ok(hits(profile.salesStartDate, 'Sales Start Date'))
  assert.ok(hits(profile.genre, 'Primary Genre'))
})
test('pre-order matches "Pre Order", "Pre-order" and "Preorder"', () => {
  for (const l of ['Pre Order Date', 'Pre-order Date', 'Preorder Date']) assert.ok(hits(profile.preorderDate, l), l)
  assert.ok(!hits(profile.releaseDate, 'Pre Order Date'))
})
test('explicit options cover explicit, non-explicit and cleaned', () => {
  const o = profile.choices.explicit.options
  assert.ok(opt(o.explicit, 'Explicit')); assert.ok(opt(o.cleaned, 'Cleaned'))
  for (const l of ['Non-explicit', 'Non explicit', 'Not explicit', 'No']) assert.ok(opt(o.not_explicit, l), l)
  assert.ok(!opt(o.not_explicit, 'Explicit'))
})
test('"Add Artist" button is recognised', () => {
  assert.ok(opt(profile.lists.artists.add, 'Add Artist'))
})
test('cover versions radio matches the question and both answers', () => {
  const c = profile.choices.hasCoverVersions;
  assert.ok(c, 'hasCoverVersions is missing from the profile');
  assert.match('Does this release contain cover versions?', c.group.re);
  assert.match('yes', c.options.yes);
  assert.match('No', c.options.no);
  assert.doesNotMatch('yes', c.options.no);
});
console.log(`\n${n} tests passed`)
