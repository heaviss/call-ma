# TODO — call-ma Implementation Plan (TDD-first)

## Phase 0 — Repo bootstrap
- [x] Convert repo to a workspace-ready monorepo structure:
  - [x] package.json at root with workspaces: ["packages/*"]
  - [x] packages/app (frontend app)
  - [x] packages/shared (shared utils, e.g., URL codec)
- [x] Add .editorconfig and .gitignore
- [x] Add README.md with quickstart
- [ ] Library decisions and adapters:
  - [ ] Primary: simple-peer for WebRTC (pin version)
  - [ ] Fallback: js-libp2p with WebRTC transport (pin versions)
  - [ ] Optional assist: WebConnect.js (evaluate; use only if it simplifies URL/relay exchange)
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
- [ ] Minimal layout:
  - [ ] Buttons: "Create Conference", "Copy Link"
  - [ ] Textarea/input: "Paste invite link"
  - [ ] Video elements: #localVideo, #remoteVideo
  - [ ] Logs/stats area
- [ ] Accessibility: labels, focus order, keyboard use
- [ ] TDD:
  - [ ] Tests: DOM renders required controls; disabled/enabled states as expected

## Phase 6 — URL-based Signaling (simple-peer)
- [ ] Shared utils (packages/shared):
  - [ ] encodeSignal(data) → compact URL-safe string (works with simple-peer signal objects)
  - [ ] decodeSignal(str) → data with validation and helpful errors
  - [ ] TDD for codec: valid payloads, corrupted/empty strings, versioning
- [ ] Connectivity abstraction (packages/shared or packages/app):
  - [ ] Define ConnectionAdapter interface: createInitiator(stream), createResponder(stream), onSignal(cb), signal(data), onStream(cb), destroy()
  - [ ] Implement SimplePeerAdapter using simple-peer with { trickle:false } for single-blob URL exchange
  - [ ] TDD: adapter unit tests using fake emitters to avoid testing the library
- [ ] Offerer flow (creator):
  - [ ] getUserMedia for local stream; attach to #localVideo
  - [ ] Use SimplePeerAdapter(initiator:true); wait for 'signal' event (single blob because trickle:false)
  - [ ] Compose signal payload: { v, role:"offer", sp } where sp is the simple-peer signal object
  - [ ] Update app URL/hash with encoded payload
  - [ ] "Copy Link" copies full URL to clipboard
  - [ ] TDD:
    - [ ] Unit: link building, clipboard copy abstraction
    - [ ] Integration (jsdom): state transitions when "Create" clicked
- [ ] Answerer flow (joiner):
  - [ ] On load: detect encoded signal in URL; parse and validate offer
  - [ ] getUserMedia; attach to #localVideo
  - [ ] Use SimplePeerAdapter(initiator:false); call adapter.signal(offer.sp)
  - [ ] On adapter 'signal', compose answer payload: { v, role:"answer", sp }
  - [ ] Show answer link for creator to open (URL-based return channel)
  - [ ] Attach remote stream to #remoteVideo via adapter onStream
  - [ ] TDD:
    - [ ] Unit: parsing/validation paths, helpful errors for bad/expired links
    - [ ] Integration: when URL contains offer, UI guides to copy/send answer
- [ ] ICE handling notes:
  - [ ] With trickle:false, SDP includes initial ICE; success likely on STUN-friendly networks
  - [ ] If connection not established, escalate to fallback adapter (Phase 7)
  - [ ] TDD: unit tests for payload shapes; simulate missing/invalid signal blobs

## Phase 7 — Optional Fallback (js-libp2p and/or WebConnect.js)
- [ ] Feature flag and adapter selection (env/UI): simple-peer (default) vs libp2p vs WebConnect
- [ ] js-libp2p path:
  - [ ] Build Libp2pAdapter using js-libp2p with WebRTC transport
  - [ ] Minimal bootstrap/peer discovery; document or provide small signaling aid if required by chosen transport
  - [ ] Use only for handshake or as connectivity fallback; tear down once media flows over primary path
- [ ] WebConnect.js path (optional):
  - [ ] Evaluate feasibility to simplify URL-based exchange or provide shortlink/redirect return channel
  - [ ] If adopted, wrap as WebConnectAdapter implementing ConnectionAdapter
- [ ] TDD:
  - [ ] Adapter contract tests ensuring fallback used only when primary fails
  - [ ] No tests of external libs; simulate adapter events to drive app logic

## Phase 8 — Logging & Stats (local only)
- [ ] Periodically call RTCPeerConnection.getStats()
- [ ] Derive simple metrics: RTT/latency estimate, bitrate, frame rate
- [ ] Render to logs/stats area; never send to server
- [ ] TDD:
  - [ ] Pure functions for deriving metrics from getStats reports
  - [ ] Edge cases: empty reports, missing fields

## Phase 9 — Browser Support (Chrome & Firefox)
- [ ] Cross-browser constraints and getUserMedia quirks
- [ ] Feature detection and graceful errors (no camera/mic, HTTPS requirement)
- [ ] QA checklist with manual steps for both browsers and mobile networks/home Wi‑Fi
- [ ] TDD:
  - [ ] Unit tests for feature-detection utilities and error mapping

## Phase 10 — Deployment (GitHub Pages)
- [ ] Vite base configured for repo path
- [ ] GitHub Actions workflow: build and deploy to gh-pages
- [ ] Cache controls for SW updates; version bump strategy
- [ ] Smoke test: page loads offline after first visit

## Phase 11 — CI & Project Hygiene
- [ ] Add CI for lint, type-check (if TS), tests, and build
- [ ] Pre-commit hooks: lint-staged + prettier (optional)
- [ ] Badges in README (build, coverage)

## Phase 12 — Security & Privacy
- [ ] Permissions prompts: clear UI messaging
- [ ] No analytics or external tracking
- [ ] Document STUN/TURN servers used and privacy considerations

## Testing conventions
- Tests live alongside code or under packages/*/tests with clear naming.
- For browser APIs (clipboard, getUserMedia, RTCPeerConnection), isolate side effects behind small adapters to keep most tests pure.
- Do not test external libraries. Test our code paths and data transformations.

## Definition of Done
- All phases through Deployment pass tests and lint.
- PWA manifest valid; service worker installs and serves offline.html when offline.
- Offerer can create a link; joiner can connect via link; remote/local video display.
- Optional relay used only if direct connection fails; dropped after connection.
- Stats visible locally; no data leaves the device.
- Works on Chrome and Firefox (desktop and mobile networks / home Wi‑Fi).
