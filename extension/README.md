# Track Record helper (Chrome extension)

Copies a **ready** release from Track Record into a distributor's release form. It fills text boxes and drop-downs, picks yes/no answers, and presses "Add artist" style buttons to make room for names.
It never submits, ticks terms, uploads files, or touches login, payment or bank fields. You check everything and submit yourself.

## Load it
1. Chrome, `chrome://extensions`, switch on Developer mode, Load unpacked, pick this `extension` folder.
2. Click the extension, enter the Track Record API address (default `http://localhost:4000/api`) and sign in.
3. Pick a ready release. The popup previews the values (from `GET /releases/:id/export`, which carries no internal ids or co-writer emails).

## Try it on the mock page
`cd extension && python3 -m http.server 8000`, open `http://localhost:8000/mock-distributor.html`, open the popup, press
"Fill release details", then choose a song and press "Fill this song" (one song at a time).

## What it can fill (RouteNote layout)
Release: title, artist, label, genre and second genre, release / originally released / pre-order / sales start dates, album version
(albums and EPs), ℗ and © lines, language, compilation / lyrics / explicit answers, and the primary-artist list.
Song: title, version, ISRC, preview start (as 0:45; set `previewFormat: 'seconds'` in `routenote.js` if the form wants 45), lyrics and
explicit answers, composer rows, and credit rows with their title (Producer, Mixing Engineer, ...). On a single, if the song has no
credits the release-level credits are used.

## Capturing the UPC
RouteNote generates the UPC after you send the release. Open the popup on the page that shows it and press "Capture UPC from this page".
The popup shows the number it found; nothing is saved until you press "Save to this release". If nothing is found, or you prefer, use
"Enter it myself". The number is sent to `PUT /releases/:id/upc`, which works on ready releases (the normal edit route does not).
A number that fails the barcode check digit asks for a second confirmation.

## RouteNote selectors are not verified
`routenote.js` holds every RouteNote pattern in one file. They were written from the field names RouteNote asks for and tested only on
`mock-distributor.html`. Before relying on them, open RouteNote's real form, compare each label, and edit `routenote.js`.
Anything that does not match is skipped and listed as "not found".

## Tests
`server/tests/upc.test.js` runs with the server tests. The extension tests need jsdom, which is not a project dependency:
`cd /tmp && npm i jsdom && cd - && NODE_PATH=/tmp/node_modules node extension/test/filler.test.js` (and `popup-values.test.js`, which needs nothing).

## How it stays narrow
- Manual only: nothing runs until you press a Fill or Capture button. No background script, no always-on content script.
- Permissions are `activeTab`, `scripting`, `storage`. No host permissions, no browsing telemetry.
- Radios are picked only in a group whose label matches a field being sent, never in a terms/consent group. Add-row buttons are pressed only when their text starts with "Add" and never if it mentions submit, save, next, pay and similar.
- Fill runs only when the page's host matches a distributor switched on in the popup. Real distributors start **off**; read
  a distributor's terms on automation before switching it on.
- The sign-in token lives in session storage and is dropped when the browser closes.
- If a field is not recognised it is skipped and listed as "not found"; every value also has a Copy button.

## Adding a distributor's real form
Fields are matched by label, placeholder, name and id (`filler.js`, `PATTERNS`). After inspecting a real form, add a
`extra: { pLine: { re: 'master\\s*copyright' } }` entry for that distributor in `distributors.js`. Selectors for real sites
have not been verified here; only the mock page is tested.
