# call-ma

A minimalist peer-to-peer WebRTC video call app. Signaling uses [Trystero](https://github.com/dmotz/trystero) over the NOSTR relay network — no server or account required.

![Coverage](https://heaviss.github.io/call-ma/coverage-badge.svg)

## Quickstart

Requires Node.js >= 18 and npm >= 10.

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # run all tests
npm run build    # production build (output: dist/)
```

## How it works

1. **Creator** clicks "Create Conference" → camera/mic captured → a random 8-char room ID is generated → share the URL (room ID in the hash).
2. **Joiner** opens the link → room ID is parsed from the hash → auto-joins.
3. Both peers meet via Trystero over the NOSTR relay network; once matched, a direct WebRTC media stream is established between browsers.

No server stores anything. Stats (RTT, bitrate, FPS) are shown in the Logs panel and never leave the device.

## STUN servers

Default servers used for ICE candidate gathering:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

Override at build time via the `STUN_SERVERS` environment variable (comma-separated):
```bash
STUN_SERVERS=stun:mystun.example.com:3478 npm run build
```

**Note:** No TURN server is configured. Connections behind symmetric NAT may fail.

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
npm run lint          # ESLint (JS + HTML) + Stylelint (CSS)
npm run lint:fix      # Auto-fix
npm run lint:css      # CSS only
npm run format        # Prettier write
npm run format:check  # Prettier check
npm run test:coverage # Tests with branch/line coverage report
```

Run a single test file:
```bash
npx vitest run src/__tests__/trysteroAdapter.test.js
```
