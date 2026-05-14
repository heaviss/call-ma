# call-ma

A minimalist, URL-signaled WebRTC video call app — no server required for signaling. The offer/answer SDP is encoded into the URL hash and shared out-of-band (copy/paste).

## Quickstart

Requires Node.js >= 18 and npm >= 10.

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # run all tests
npm run build    # production build (output: dist/)
```

## How it works

1. **Creator** clicks "Create Conference" → camera/mic are captured → a WebRTC offer is encoded into the URL hash → click "Copy Link" to share it.
2. **Joiner** opens the link → the app detects the offer → generates an answer encoded into a new URL → shares that URL back to the creator.
3. Once both peers exchange URLs, the P2P connection is established and video/audio streams directly between browsers.

No server is involved after the initial link exchange. Stats (RTT, bitrate, FPS) are shown locally in the Logs panel and never leave the device.

## STUN servers

Default servers (used for ICE candidate gathering):
- `stun:stun.l.google.com:19302` (Google)
- `stun:global.stun.twilio.com:3478?transport=udp` (Twilio)

Override at build time via the `STUN_SERVERS` environment variable (comma-separated):
```bash
STUN_SERVERS=stun:mystun.example.com:3478 npm run build
```

**Note:** No TURN server is configured. Connections behind symmetric NAT (some corporate networks) may fail. The app targets home Wi-Fi and mobile networks.

## Privacy

- No analytics, no telemetry, no data leaves the browser except the WebRTC media stream to the remote peer.
- HTTPS is required (enforced by the app on load).
- The STUN servers listed above will see your IP address during ICE gathering — this is inherent to WebRTC.

## Deployment (GitHub Pages)

Push to `main` — the deploy workflow builds and publishes to GitHub Pages automatically. The Pages source must be set to **GitHub Actions** in the repo settings.

To build for a subpath manually:
```bash
VITE_BASE=/call-ma/ npm run build
```

## Development

```bash
npm run lint          # ESLint
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier write
npm run format:check  # Prettier check
```

Run a single test file:
```bash
npx vitest run src/__tests__/codec.test.js
```
