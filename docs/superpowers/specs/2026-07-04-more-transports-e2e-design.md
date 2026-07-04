# More Trystero Transports + Direct-Mode E2E Test

**Date:** 2026-07-04
**Status:** Approved

## Problem

The app currently races two Trystero transports (MQTT + BitTorrent) in parallel, discarding whichever arrives second. More zero-config transports exist in the Trystero family and widen the odds of finding a working signaling path under network restrictions. Separately, the `DirectAdapter` QR/link fallback (see `2026-06-26-direct-sdp-fallback-design.md`) has unit and JSDOM integration coverage but no test that drives two real browsers through the actual UI end to end. The README is also stale — it still describes the app as NOSTR-only, from before MQTT+BitTorrent were added.

## Goal

1. Add Nostr and IPFS (Waku-backed) as two more parallel Trystero transports, alongside MQTT + BitTorrent.
2. Add a Playwright e2e test that opens two real browser contexts, drives the `DirectAdapter` QR/link flow exactly as a user would (via the copy-link button and clipboard, not by decoding QR pixels), and asserts the WebRTC connection is established on both sides.
3. Wire the e2e test into CI.
4. Update the README to reflect the actual transport list and document the direct-mode fallback and `test:e2e`.

## Non-goals

- Iroh: it's a Rust/native library (raw UDP/QUIC), no browser or WASM target — can't run in a JS browser tab. Excluded.
- Supabase / Firebase transports: both require the user's own project URL/credentials as `appId` (not zero-config, unlike the other four). Not in scope; can be added later the same way `TURN_URL` is optional, if ever needed.
- `NOSTR_RELAYS` env-var override (mirroring `MQTT_RELAYS`/`TORRENT_TRACKERS`): skipped. Nostr ships a large built-in public relay list; the IPFS/Waku strategy has no override knob at all, so a nostr-only override would be asymmetric with no current requirement driving it.
- E2E coverage of the live Trystero transports (MQTT/BitTorrent/Nostr/IPFS): these depend on reaching real external infra and would make CI flaky/slow. Only the DirectAdapter path (fully local, deterministic) is covered by e2e.
- QR pixel decoding in the e2e test: the test reads the link via clipboard (same string the QR encodes), not by rendering/decoding the canvas image.

## Part 1 — Additional transports

### New dependencies

`@trystero-p2p/nostr`, `@trystero-p2p/ipfs` (the latter wraps `@waku/sdk`/libp2p under the hood despite the "ipfs" name — pulled in transitively, no direct usage needed).

### Changes to `src/main.js`

Import both `joinRoom` functions and append to the existing `transports` array, same shape as MQTT/BitTorrent entries but with no `relayUrls` (neither needs one — see Non-goals):

```js
import { joinRoom as nostrJoinRoom } from '@trystero-p2p/nostr';
import { joinRoom as ipfsJoinRoom }  from '@trystero-p2p/ipfs';

const transports = [
  { joinRoom: mqttJoinRoom,    relayUrls: getMqttRelayUrls(undefined, searchParams) },
  { joinRoom: torrentJoinRoom, relayUrls: getTorrentRelayUrls(undefined, searchParams) },
  { joinRoom: nostrJoinRoom },
  { joinRoom: ipfsJoinRoom },
];
```

No changes to `TrysteroAdapter` — it already loops over `this._transports` generically and dedupes peers across them (existing behavior, existing tests). No changes to `src/shared/config/relays.js`.

### Tests

None needed beyond what exists: `trysteroAdapter.test.js` already exercises the adapter transport-agnostically via `FakeRoom`; `main.js` is excluded from coverage (`vitest.config.js`) and has no direct unit test today, consistent with it being pure wiring.

## Part 2 — Playwright e2e test

### New dependency

`@playwright/test` (devDependency). Browser binaries installed via `npx playwright install --with-deps chromium` (CI step; local devs run it once manually).

### New files

**`playwright.config.js`** (repo root, alongside `vite.config.js`/`vitest.config.js`)

- `webServer`: runs `npm run dev`, waits on the dev server URL, reuses an existing server locally.
- `use`: `baseURL` pointing at the dev server; permissions `['camera', 'microphone', 'clipboard-read', 'clipboard-write']`.
- Chromium launch args: `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream` (fake camera/mic, auto-grants the getUserMedia prompt).
- `testDir: 'e2e'` — kept out of `src/` so vitest's `include: ['src/**/*.{test,spec}.js']` never picks it up.

**`e2e/direct-connect.spec.js`**

Two browser contexts (`browser.newContext()` twice), each with the permissions/fake-media setup above.

```
1. page1.goto('/')
2. page1: click #directBtn → wait for #directCopyBtn to be enabled → click it
3. page1: read offer link via page1.evaluate(() => navigator.clipboard.readText())
4. page2.goto(offerLink)                          // real user opens the shared link
5. page2: wait for #directCopyBtn enabled → click it
6. page2: read answer link via clipboard
7. page1: fill #directAnswerInput with answer link → click #directConnectBtn
8. Assert on both pages: #logs contains "Direct connection established!"
   (or: page.evaluate(() => document.querySelector('#remoteVideo').srcObject !== null))
```

This drives the same DOM affordances (`#directBtn`, `#directCopyBtn`, `#directAnswerInput`, `#directConnectBtn`) already covered by `direct-flow.test.js`'s JSDOM version, but here it's two real Chromium instances doing real `RTCPeerConnection` negotiation and a real clipboard handoff — no mocking.

### npm script

```json
"test:e2e": "playwright test"
```

## Part 3 — CI

`.github/workflows/ci.yml`, after the existing `npm run test:coverage` step:

```yaml
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
```

`deploy.yml` is untouched — it only builds and re-runs `test:coverage`, not the full test suite.

## Part 4 — README

- Correct the intro line: it currently claims signaling is "over the NOSTR relay network" only; update to describe the four parallel transports (MQTT, BitTorrent, Nostr, IPFS/Waku) racing in parallel, first-to-connect wins.
- Add a short "Direct connection (no transport reachable)" section describing the QR/link fallback (button, QR code, copy-link, paste-answer flow) — this exists in the app today but isn't documented anywhere in the README.
- Add `npm run test:e2e` to the Development commands list, with a one-line note that it needs Playwright's Chromium (`npx playwright install --with-deps chromium`) installed once locally.

## Post-implementation

Run `/ponytail:ponytail-review` on the diff before merging — check for reinvented wheels, unneeded config knobs, or speculative flexibility in the transport wiring and e2e setup.

## Test summary

| File | What it covers |
|---|---|
| `e2e/direct-connect.spec.js` (new) | Two real browsers complete the DirectAdapter QR/link flow end to end; connection established on both sides |
| `src/__tests__/trysteroAdapter.test.js` (existing, unchanged) | Adapter remains transport-agnostic; no new cases needed for the 2 added transports |

No new unit tests needed for Part 1 (pure wiring in `main.js`, which is untested/excluded by existing convention).
