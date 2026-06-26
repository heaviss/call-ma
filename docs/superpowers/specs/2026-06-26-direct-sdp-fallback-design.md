# Direct SDP Fallback Design

**Date:** 2026-06-26
**Status:** Approved

## Problem

Trystero signaling (MQTT + BitTorrent) is blocked in Russia. Even with the room URL, peers cannot establish a WebRTC connection because the relay infrastructure is unreachable. We need a fully serverless fallback that works under any censorship conditions.

## Goal

Add a manual SDP exchange path: the user clicks "Can't connect? Try directly", gets a QR code + shareable link encoding their SDP offer, the recipient opens it and gets their own answer QR + link, the initiator pastes the answer link — WebRTC connects with no server involved.

Trystero remains the primary path. The direct mode is an explicit opt-in, not an automatic fallback.

## Non-goals

- URL shortener (server dependency, defeats the purpose)
- Automatic failure detection and switching
- Mobile-to-mobile UX improvements (deferred)

## Architecture

### New files

**`src/shared/sdp.js`**

Encode/decode an `RTCSessionDescriptionInit` to/from a URL-safe string.

```js
export async function encodeSdp(desc)  // → string (base64url, deflate-raw compressed)
export async function decodeSdp(str)   // → RTCSessionDescriptionInit
```

Uses the native `CompressionStream('deflate-raw')` / `DecompressionStream('deflate-raw')` API — no new npm packages. Throws if the API is unavailable or input is invalid.

**`src/connection/directAdapter.js`**

Wraps `RTCPeerConnection` for manual offer/answer exchange. Fluent builder mirroring `TrysteroAdapter`:

```js
const adapter = new DirectAdapter({ iceServers, turnConfig })
  .onStream(cb)
  .onConnect(cb)
  .onError(cb);

const offerEncoded = await adapter.createOffer(stream);
// later, after receiving answer:
await adapter.applyAnswer(answerEncoded);

// receiver side:
const answerEncoded = await adapter.createAnswer(offerEncoded, stream);
```

ICE gathering: waits for `iceGatheringState === 'complete'`, with a 5-second timeout. If timeout fires, uses whatever candidates were gathered (host-only if STUN is unreachable).

Throws `Error('no pending offer')` if `applyAnswer` is called before `createOffer`.

### Changes to existing files

**`src/shared/link.js`** — two new exports:

```js
export function buildDirectUrl(locationLike, type, encoded)
// → 'https://…/#offer=<encoded>' or '#answer=<encoded>'
// type: 'offer' | 'answer'

export function parseDirectUrl(url)
// → { type: 'offer'|'answer', encoded: string } | null
```

`parseDirectUrl` returns `null` for any hash that isn't `#offer=…` or `#answer=…`. The existing `getRoomIdFromUrl` is unchanged.

**`index.html`** — new hidden section appended before `</main>`:

```html
<section id="directPanel" hidden>
  <p id="directStatus"></p>
  <canvas id="directQr"></canvas>
  <button id="directCopyBtn" type="button" disabled>Copy link</button>
  <label>
    Paste their response link:
    <input id="directAnswerInput" type="url" placeholder="https://…#answer=…">
  </label>
  <button id="directConnectBtn" type="button" disabled>Connect</button>
</section>
```

A "Can't connect? Try directly" button is added to `.controls` alongside the existing buttons. It is enabled from the start — direct mode is an alternative entry point, not a sequential step after Trystero. Clicking it while a Trystero room is active does not tear down the Trystero connection (they coexist; the first `onStream` to fire wins, as with the existing dual-transport deduplication).

**`src/app/controller.js`** — three additions:

1. On load, `parseDirectUrl(window.location.href)` is checked:
   - `type === 'offer'` → start receiver flow (calls `getMedia()` then `directAdapter.createAnswer(...)`)
   - `type === 'answer'` → show message "Paste this link where the call was created"
   - `null` → existing Trystero logic unchanged

2. "Can't connect?" button click → start initiator flow (calls `getMedia()` then `directAdapter.createOffer(...)`)

3. "Connect" button click → reads `directAnswerInput.value`, calls `directAdapter.applyAnswer(...)`

QR rendering: `import QRCode from 'qrcode'`, render to `#directQr` canvas.

### New npm dependency

`qrcode` — renders QR to `<canvas>`. ~35 KB minified. No other new deps.

## URL scheme

| Hash pattern | Meaning |
|---|---|
| `#a1b2c3d8` (8 alphanum chars) | Trystero room (existing) |
| `#offer=<base64url>` | Direct mode — SDP offer |
| `#answer=<base64url>` | Direct mode — SDP answer |

`buildRoomUrl` and `getRoomIdFromUrl` are unchanged.

## Data flow

### Initiator (Alice)

```
1. Click "Can't connect? Try directly"
2. getMedia() → local stream
3. directAdapter.createOffer(stream)
   → new RTCPeerConnection({ iceServers })
   → pc.addTrack(stream)
   → pc.createOffer() → pc.setLocalDescription()
   → wait for iceGatheringState complete (max 5 s)
   → encodeSdp(pc.localDescription) → base64url
4. buildDirectUrl(location, 'offer', encoded) → URL
5. Render QR to canvas; enable "Copy link" button
6. Alice shares QR / link to Bob
7. Alice pastes Bob's answer URL into input → clicks "Connect"
8. directAdapter.applyAnswer(answerEncoded)
   → decodeSdp() → pc.setRemoteDescription()
   → onStream fires → remoteVideo.srcObject = stream
```

### Receiver (Bob)

```
1. Opens Alice's offer URL (#offer=…)
2. controller detects parseDirectUrl() → type 'offer'
3. getMedia() → local stream
4. directAdapter.createAnswer(offerEncoded, stream)
   → new RTCPeerConnection({ iceServers })
   → decodeSdp(offerEncoded) → pc.setRemoteDescription()
   → pc.addTrack(stream)
   → pc.createAnswer() → pc.setLocalDescription()
   → wait for iceGatheringState complete (max 5 s)
   → encodeSdp(pc.localDescription) → base64url
5. buildDirectUrl(location, 'answer', encoded) → URL
6. Render QR to canvas; enable "Copy link" button
7. Bob sends Alice his answer URL (same channel)
```

## Error handling

| Scenario | Behaviour |
|---|---|
| `CompressionStream` unavailable | `encodeSdp` throws; controller logs warning and hides the "Try directly" button |
| ICE gathering timeout (5 s) | Proceeds with host-only candidates; logs "STUN unreachable, LAN-only" |
| Invalid / missing SDP in URL | `parseDirectUrl` returns `null`; treated as no hash |
| `#answer=…` opened directly | Show "Paste this link where the call was created" |
| `applyAnswer` before `createOffer` | Throws `Error('no pending offer')` |
| `qrcode` render failure | Log error; "Copy link" button still works |

## Tests

| File | What it covers |
|---|---|
| `src/__tests__/sdp.test.js` | `encodeSdp`/`decodeSdp` roundtrip; invalid input; `CompressionStream` absent |
| `src/__tests__/directAdapter.test.js` | `FakePeerConnection` stub; `createOffer`, `createAnswer`, `applyAnswer`; ICE timeout; `onStream`/`onConnect`/`onError` callbacks |
| `src/__tests__/link.test.js` | `buildDirectUrl`, `parseDirectUrl` (extend existing file) |
| `src/__tests__/direct-flow.test.js` | Integration: initiator + receiver via JSDOM; both `onStream` callbacks fire |

Test patterns follow existing conventions: `FakeRoom`-style stubs, `vi.fn()` for external deps, Arrange/Act/Assert blocks.
