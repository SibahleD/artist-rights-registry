const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The app and the extension each keep a language list. They are written by hand, so this fails if they drift apart.
test('extension language names match the app list exactly', () => {
  const optionsFile = path.join(__dirname, '..', '..', 'client', 'src', 'data', 'options.ts');
  if (!fs.existsSync(optionsFile)) return; // extension tested on its own
  const ts = fs.readFileSync(optionsFile, 'utf8');
  const block = /export const LANGUAGES: \[string, string\]\[\] = \[\r?\n([\s\S]*?)\r?\n\]/.exec(ts)[1];
  const app = Object.fromEntries([...block.matchAll(/\['([a-z]{2,3})', '((?:[^'\\]|\\.)*)'\]/g)].map((m) => [m[1], m[2].replace(/\\'/g, "'")]));
  const ext = new Function(`${fs.readFileSync(path.join(__dirname, '..', 'languages.js'), 'utf8')}; return LANGUAGE_NAMES;`)();
  assert.ok(Object.keys(app).length > 50);
  assert.deepEqual(ext, app);
});

test('every language in the list is African or an official language used across Africa', () => {
  const ext = new Function(`${fs.readFileSync(path.join(__dirname, '..', 'languages.js'), 'utf8')}; return LANGUAGE_NAMES;`)();
  for (const notAfrican of ['de', 'ja', 'zh', 'hi', 'ru', 'it']) assert.equal(ext[notAfrican], undefined, `${notAfrican} should not be listed`);
  for (const african of ['rw', 'sw', 'yo', 'zu', 'am', 'ha', 'ig', 'ln', 'en', 'fr']) assert.ok(ext[african], `${african} should be listed`);
});
