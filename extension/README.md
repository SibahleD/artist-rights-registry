# Track Record helper (Chrome extension)

Copies a **ready** release from Track Record into a distributor's release form. It fills text boxes and drop-downs only.
It never submits, ticks terms, uploads files, or touches login, payment or bank fields. You check everything and submit yourself.

## Load it
1. Chrome, `chrome://extensions`, switch on Developer mode, Load unpacked, pick this `extension` folder.
2. Click the extension, enter the Track Record API address (default `http://localhost:4000/api`) and sign in.
3. Pick a ready release. The popup previews the values (from `GET /releases/:id/export`, which carries no internal ids or co-writer emails).

## Try it on the mock page
`cd extension && python3 -m http.server 8000`, open `http://localhost:8000/mock-distributor.html`, open the popup, press
"Fill release details", then choose a song and press "Fill this song" (one song at a time).

## How it stays narrow
- Manual only: nothing runs until you press a Fill button. No background script, no always-on content script.
- Permissions are `activeTab`, `scripting`, `storage`. No host permissions, no browsing telemetry.
- Fill runs only when the page's host matches a distributor switched on in the popup. Real distributors start **off**; read
  a distributor's terms on automation before switching it on.
- The sign-in token lives in session storage and is dropped when the browser closes.
- If a field is not recognised it is skipped and listed as "not found"; every value also has a Copy button.

## Adding a distributor's real form
Fields are matched by label, placeholder, name and id (`filler.js`, `PATTERNS`). After inspecting a real form, add a
`extra: { pLine: { re: 'master\\s*copyright' } }` entry for that distributor in `distributors.js`. Selectors for real sites
have not been verified here; only the mock page is tested.
