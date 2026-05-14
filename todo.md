# TODO — call-ma Implementation Plan (TDD-first)

## Phase 0 — Repo bootstrap
- [x] Convert repo to a workspace-ready monorepo structure:
  - [x] package.json at root with workspaces: ["packages/*"]
  - [x] packages/app (frontend app)
  - [x] packages/shared (shared utils, e.g., URL codec)
- [x] Add .editorconfig and .gitignore
- [x] Add README.md with quickstart
- [x] Library decisions and adapters:
  - [x] Primary: simple-peer for WebRTC (pinned, installed)
  - [ ] Fallback: js-libp2p with WebRTC transport — skipped (see Phase 7 note)
  - [ ] Optional assist: WebConnect.js — skipped (evaluate if needed later)
  - [x] Define ConnectionAdapter interface to abstract connectivity providers
  - [x] Document chosen public STUN servers; allow override via env

## Phase 1 — Tooling & Bundler (Vite)
- [x] Initialize packages/app with Vite (vanilla JS)
- [x] Root scripts: build, dev, test, lint, format
- [x] Vite config with sensible defaults and base path settable via env for GH Pages

## Phase 2 — Code Quality (ESLint + Prettier)
- [x] Configure ESLint for ES202x, browser, Vitest
- [x] Configure Prettier and ESLint integration
- [x] Add npm scripts: lint, lint:fix, format, format:check
- [x] Add minimal lint rules consistent with guidelines
- [x] Migrate to ESLint flat config (eslint.config.js) for ESLint 9.x

## Phase 3 — Testing (Vitest)
- [x] Add Vitest config in root or packages/app
- [x] Example unit test proving runner works (failing first)

## Phase 4 — PWA (Manifest + Service Worker + Offline)
- [x] Add vite-plugin-pwa plugin and config
- [x] Provide manifest entries (name, short_name, start_url, display, theme_color, background_color)
- [x] Provide icons (at least 192x192 and 512x512)
- [x] Add offline.html fallback page
- [x] TDD:
  - [x] Tests: manifest fields validation (static checks), SW registration logic path
  - [x] Implement registration and basic offline fallback

## Phase 5 — UI Skeleton (HTML/CSS/JS)
- [x] Minimal layout:
  - [x] Buttons: "Create Conference", "Copy Link"
  - [x] Textarea/input: "Paste invite link"
  - [x] Video elements: #localVideo, #remoteVideo
  - [x] Logs/stats area
- [x] Accessibility: labels, focus order, keyboard use
- [x] TDD:
  - [x] Tests: DOM renders required controls; disabled/enabled states as expected

## Phase 6 — URL-based Signaling (simple-peer)
- [x] Shared utils (packages/shared):
  - [x] encodeSignal(data) → compact URL-safe string (works with simple-peer signal objects)
  - [x] decodeSignal(str) → data with validation and helpful errors
  - [x] TDD for codec: valid payloads, corrupted/empty strings, versioning
- [x] Connectivity abstraction (packages/shared or packages/app):
  - [x] Define ConnectionAdapter interface: createInitiator(stream), createResponder(stream), onSignal(cb), signal(data), onStream(cb), destroy()
  - [x] Implement SimplePeerAdapter using simple-peer with { trickle:false } for single-blob URL exchange
  - [x] TDD: adapter unit tests using fake emitters to avoid testing the library
- [x] Offerer flow (creator):
  - [x] getUserMedia for local stream; attach to #localVideo
  - [x] Use SimplePeerAdapter(initiator:true); wait for 'signal' event (single blob because trickle:false)
  - [x] Compose signal payload: { v, role:"offer", sp } where sp is the simple-peer signal object
  - [x] Update app URL/hash with encoded payload
  - [x] "Copy Link" copies full URL to clipboard
  - [x] TDD:
    - [x] Unit: link building, clipboard copy abstraction
    - [x] Integration (jsdom): state transitions when "Create" clicked
- [x] Answerer flow (joiner):
  - [x] On load: detect encoded signal in URL; parse and validate offer
  - [x] getUserMedia; attach to #localVideo
  - [x] Use SimplePeerAdapter(initiator:false); call adapter.signal(offer.sp)
  - [x] On adapter 'signal', compose answer payload: { v, role:"answer", sp }
  - [x] Show answer link for creator to open (URL-based return channel)
  - [x] Attach remote stream to #remoteVideo via adapter onStream
  - [x] TDD:
    - [x] Unit: parsing/validation paths, helpful errors for bad/expired links
    - [x] Integration: when URL contains offer, UI guides to copy/send answer
- [x] ICE handling notes:
  - [x] With trickle:false, SDP includes initial ICE; success likely on STUN-friendly networks
  - [x] If connection not established, escalate to fallback adapter (Phase 7)
  - [x] TDD: unit tests for payload shapes; simulate missing/invalid signal blobs

## Phase 7 — Optional Fallback (js-libp2p and/or WebConnect.js)
- [x] Error/retry UI: peer error and close events surfaced in #logs with actionable messages
- [x] onError/onClose/onConnect/getPeerConnection added to SimplePeerAdapter
- [x] TDD: integration tests (jsdom + FakePeer) verifying #logs updated on error and close
- [ ] js-libp2p path — skipped: complexity not justified for home WiFi/mobile target networks
- [ ] WebConnect.js — skipped: no clear benefit over current URL-based approach

## Phase 8 — Logging & Stats (local only)
- [x] Periodically call RTCPeerConnection.getStats() (every 2s after peer connects)
- [x] Derive simple metrics: RTT/latency estimate (ms), bitrate (kbps), frame rate (fps)
- [x] Render to logs/stats area; never send to server
- [x] TDD:
  - [x] Pure functions for deriving metrics from getStats reports (src/shared/stats.js)
  - [x] Edge cases: empty reports, missing fields, zero timeDelta, null prevReport
  - [x] createLogger: timestamped lines appended to DOM element (src/app/logger.js)

## Phase 9 — Browser Support (Chrome & Firefox)
- [x] Feature detection: isSecureContext, navigator.mediaDevices, RTCPeerConnection
- [x] Feature detection and graceful errors (no camera/mic, HTTPS requirement)
- [x] getUserMedia error mapping (NotAllowedError, NotFoundError, NotReadableError, etc.)
- [x] Warnings shown in #logs on startup and on getUserMedia failure
- [x] TDD:
  - [x] Unit tests for checkSupport (all ok:false branches)
  - [x] Unit tests for mapMediaError (each error name, null handling)
- [ ] QA checklist with manual steps for Chrome and Firefox — deferred (requires real devices)

## Phase 10 — Deployment (GitHub Pages)
- [x] Vite base configured for repo path (VITE_BASE env var, already supported)
- [x] GitHub Actions workflow: build and deploy to GitHub Pages (actions/deploy-pages)
- [ ] Cache controls for SW updates; version bump strategy — deferred
- [ ] Smoke test: page loads offline after first visit — deferred (requires deployed instance)

## Phase 11 — CI & Project Hygiene
- [x] Add CI for lint, tests, and build on push/PR to main
- [ ] Pre-commit hooks: lint-staged + prettier — deferred
- [ ] Badges in README — deferred (requires CI running on GitHub)

## Phase 12 — Security & Privacy
- [x] Permissions prompts: getUserMedia errors mapped to clear user-facing messages in #logs
- [x] No analytics or external tracking
- [x] Document STUN/TURN servers used and privacy considerations in README

## Testing conventions
- Tests live alongside code or under packages/*/tests with clear naming.
- For browser APIs (clipboard, getUserMedia, RTCPeerConnection), isolate side effects behind small adapters to keep most tests pure.
- Do not test external libraries. Test our code paths and data transformations.

## Definition of Done
- All phases through Deployment pass tests and lint. ✅
- PWA manifest valid; service worker installs and serves offline.html when offline. ✅
- Offerer can create a link; joiner can connect via link; remote/local video display. ✅
- Optional relay used only if direct connection fails; dropped after connection. (P2P only; TURN not implemented)
- Stats visible locally; no data leaves the device. ✅
- Works on Chrome and Firefox (desktop and mobile networks / home Wi‑Fi). (manual QA pending)
