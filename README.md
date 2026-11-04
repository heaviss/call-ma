# call-ma

A minimalist peer-to-peer WebRTC video call app. Signaling uses [Trystero](https://github.com/dmotz/trystero) over four transports racing in parallel — MQTT, BitTorrent, Nostr, and IPFS (via Waku) — whichever connects first wins; duplicate streams from the same peer are discarded. No server or account required.

![Coverage](https://heaviss.github.io/call-ma/coverage-badge.svg)

## Quickstart

Requires Node.js >= 22.22 (CI uses 24) and npm >= 10.

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # run all tests
npm run build    # production build (output: dist/)
```

## How it works

1. **Creator** clicks "Create Conference" → camera/mic captured → a random 8-char room ID is generated → share the URL (room ID in the hash).
2. **Joiner** opens the link → room ID is parsed from the hash → auto-joins.
3. Both peers meet via whichever of the four transports connects first; once matched, a direct WebRTC media stream is established between browsers.

No server stores anything. Stats (RTT, bitrate, FPS) are shown in the Logs panel and never leave the device.

## ICE servers and relays

All connection settings live in `src/shared/config/connection.js`. One ICE server list is used by every transport and by direct mode; it replaces Trystero's built-in defaults.

Default STUN servers: `stun.l.google.com:19302`, plus `stun.nextcloud.com:3478`, `stun.sonetel.com`, `stun.telnyx.com` (reachable from Russia, where Google STUN is blocked).

Build-time overrides (Vite env, comma-separated):

| Variable | Meaning |
|---|---|
| `VITE_STUN_SERVERS` | Replace the default STUN list |
| `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_PASS` | Add TURN server(s) with shared credentials |
| `VITE_MQTT_RELAYS` | `wss://` MQTT brokers |
| `VITE_TORRENT_TRACKERS` | `wss://` BitTorrent trackers |

```bash
VITE_STUN_SERVERS=stun:mystun.example.com:3478 npm run build
```

URL params override env and travel inside shared links: `?stun=`, `?mqttRelay=`, `?torrentTracker=`. TURN credentials are never read from the URL.

**Note:** No TURN server is configured by default. Connections behind symmetric NAT may fail.

## Direct connection (no transport reachable)

If all four transports are blocked (e.g. on a restrictive network), click **"Can't connect? Try directly"**:

1. The initiator gets a QR code and a copyable link encoding a WebRTC offer.
2. Share it any way you like (chat app, AirDrop, reading it aloud). The other person opens the link, which auto-generates their answer as another QR code/link.
3. They send that back to the initiator, who pastes it into the "Paste their response link" field and clicks **Connect**.

No server is involved — the SDP offer/answer is compressed and encoded directly into the URL.

## Privacy

- No analytics, no telemetry. The only data leaving the browser is the WebRTC media stream to the remote peer.
- HTTPS is required (enforced on load).
- STUN servers listed above will see your IP address during ICE gathering — this is inherent to WebRTC.

## Deployment (GitHub Pages)

Push to `main` — the deploy workflow builds, runs coverage, generates a badge, and publishes to GitHub Pages automatically. The Pages source must be set to **GitHub Actions** in repo settings.

To build for a subpath manually:
```bash
VITE_BASE=/call-ma/ npm run build
```

## Development

```bash
npm run lint          # ESLint (JS + HTML) + Stylelint (CSS) + html-validate
npm run lint:fix      # Auto-fix
npm run lint:css      # CSS only (stylelint, baseline in stylelint-suppressions.json)
npm run lint:html     # HTML only (html-validate)
npm run format        # Prettier write
npm run format:check  # Prettier check
npm run test:coverage # Tests with branch/line coverage report
npm run test:e2e      # Playwright e2e tests (run `npx playwright install --with-deps chromium` once first)
```

Run a single test file:
```bash
npx vitest run src/__tests__/trysteroAdapter.test.js
```
