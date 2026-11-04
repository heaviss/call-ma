# CLAUDE.md

Peer-to-peer video calls between two browsers, with no server of our own. Signaling runs over [Trystero](https://github.com/dmotz/trystero) on four Transports in parallel (MQTT, BitTorrent, Nostr, IPFS: `@trystero-p2p/*`). The first Transport to connect a peer wins; duplicate streams from the same peer via another Transport are discarded. Direct mode skips Transports: the SDP offer and answer travel inside links or QR codes.

- Domain language: `GLOSSARY.md`. Use its terms in code, issues and commits.
- Scripts: `package.json`. Env vars and deployment: `README.md`.

## Done

A change is done when `npm run lint`, `npm run test:coverage` (coverage thresholds included) and `npm run test:e2e` pass. Work test-first: failing test → implementation → green → commit.

## Lint

Rules are the strictest available, at wemake-python-styleguide level. Fix the code to satisfy a rule. When a line genuinely must break one, write `eslint-disable-next-line <rule> -- <reason>`.

## Seams

- **Signaling flow.** The creator generates an 8-char room ID, builds the share link with `buildRoomUrl` and calls `TrysteroAdapter.join(roomId, stream)`. The joiner opens the link; `getRoomIdFromUrl` reads the room ID from the hash and the same join runs. Both sides `room.addStream(localStream)`; the remote stream arrives via `onPeerStream`.
- **`initApp`** receives `document`, `window`, `navigator` and `transports` (`{ joinRoom, relayUrls? }[]`) by injection, so tests pass JSDOM objects. A single legacy `joinRoom` is still accepted.
- **`TrysteroAdapter`** targets Trystero 0.26: room handlers are assigned properties (`room.onPeerJoin = cb`). Network and ICE failures arrive via `onJoinError` → `.onError()`; programmer errors from `joinRoom` throw.
- **Connection config.** URL params (`?stun=`, `?mqttRelay=`, `?torrentTracker=`) beat env vars and propagate through shared links. One ICE servers list (STUN + TURN) replaces Trystero's defaults in every Transport and in Direct mode.

## Tests

- Integration tests build a `JSDOM` and inject it into `initApp`. Tests of pure functions use no DOM.
- Adapter tests go through `src/__tests__/fakes/fakeRoom`. `roomContract` runs the same checks against `FakeRoom` and a real offline Trystero room (`createStrategy` from `@trystero-p2p/core`), so the fake stays true to the library.
- `vi.fn()` stands in for external dependencies only (`mediaDevices`, `clipboard`, `joinRoom`); everything else is a real object. `virtual:pwa-register` resolves to a stub in `src/__mocks__` via a Vitest alias.
- Arrange / Act / Assert blocks are separated by blank lines.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`heaviss/call-ma`, via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
