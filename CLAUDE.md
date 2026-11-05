# CLAUDE.md

Peer-to-peer video calls between two browsers, with no server of our own. Signaling runs over [Trystero](https://github.com/dmotz/trystero) on four Transports in parallel (MQTT, BitTorrent, Nostr, IPFS: `@trystero-p2p/*`). The first Transport to connect a peer wins; duplicate streams from the same peer via another Transport are discarded. Direct mode skips Transports: the SDP offer and answer travel inside links or QR codes.

- Domain language: `GLOSSARY.md`. Use its terms in code, issues and commits.
- Scripts: `package.json`. Env vars and deployment: `README.md`.

## Done

A change is done when `npm run lint`, `npm run typecheck`, `npm run test:coverage` (coverage thresholds included) and `npm run test:e2e` pass. Work test-first: failing test → implementation → green → commit.

## Lint

Rules are the strictest available, at wemake-python-styleguide level. Fix the code to satisfy a rule. When a line genuinely must break one, write `eslint-disable-next-line <rule> -- <reason>`.

- `eslint-suppressions.json` freezes old ESLint violations per file and rule, and may only shrink. `eslint .` fails on a stale entry: after fixing a frozen violation, run `npx eslint . --prune-suppressions` and commit the shrunk file. Never add entries for new code, never use `--pass-on-unpruned-suppressions`.
- Only `eslint-disable-next-line` with a `-- <reason>` is allowed; `npm run lint` fails on more than 10 `eslint-disable` comments. No `warn` level: every rule is `error` or `off`. Size and complexity thresholds apply to application code, tests and e2e alike; tests drop only `max-lines-per-function`, `no-magic-numbers` and `sonarjs/no-duplicate-string`. Tests also get `@vitest/eslint-plugin` `all` and e2e gets every `eslint-plugin-playwright` rule (exceptions in `eslint.config.js`).
- `stylelint-suppressions.json` freezes old CSS violations and may only shrink. Stylelint 17 ignores stale entries, so CI runs `npm run lint:css:baseline`, which fails when the file would change. After fixing a frozen violation, run it locally and commit the shrunk file. Never add entries for new code.
- Prettier owns formatting; linters must agree with it (hence the lowercase `<!doctype html>` in html-validate).
- CI runs `npm run format:check`; run `npm run format` before committing.
- knip runs without a config, on its Vite/Vitest/Playwright plugins. Export only what another module imports; drop unused deps instead of ignoring them.
- jscpd checks app code, tests and `e2e/` at the same 5 % threshold. Move a repeated arrange block into `src/__tests__/fakes/`.

## TypeScript

All code is TypeScript (`src/`, `e2e/`, `*.config.ts`); only `eslint.config.js` stays JS, because ESLint 10 needs `jiti` to load a `.ts` config. `tsconfig.json` is strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`: no `enum` or `namespace`). Relative imports carry the `.ts` extension. Fix type errors in code; `@ts-expect-error` and `any` only with a reason comment. Trystero types come from `@trystero-p2p/core`; Vite env vars are typed in `src/vite-env.d.ts`.

## Seams

- **Signaling flow.** The creator generates an 8-char room ID, builds the share link with `buildRoomUrl` and calls `TrysteroAdapter.join(roomId, stream)`. The joiner opens the link; `getRoomIdFromUrl` reads the room ID from the hash and the same join runs. Both sides `room.addStream(localStream)`; the remote stream arrives via `onPeerStream`.
- **`initApp`** receives `document`, `window`, `navigator` and `transports` (`{ joinRoom, relayUrls? }[]`) by injection, so tests pass JSDOM objects. A single legacy `joinRoom` is still accepted.
- **`TrysteroAdapter`** targets Trystero 0.26: room handlers are assigned properties (`room.onPeerJoin = cb`). Network and ICE failures arrive via `onJoinError` → `.onError()`; programmer errors from `joinRoom` throw.
- **Connection config.** URL params (`?stun=`, `?mqttRelay=`, `?torrentTracker=`) beat env vars and propagate through shared links. One ICE servers list (STUN + TURN) replaces Trystero's defaults in every Transport and in Direct mode.

## Tests

- Integration tests build a `JSDOM` and inject it into `initApp`. Tests of pure functions use no DOM.
- Adapter tests go through `src/__tests__/fakes/fakeRoom` (`FakeRoom`, `fakeTransport`); DOM and stream helpers (`getEl`, `fakeStream`, `makeNavigator`) live in `src/__tests__/fakes/dom`. `fakes/callPage` builds the pages for `initApp` (`setupCallPage`, `makeDirectDom`) and `clickAndSettle`; `fakes/peerConnection` holds the RTCPeerConnection fake for Direct mode. Helpers hide setup, never assertions. `roomContract` runs the same checks against `FakeRoom` and a real offline Trystero room (`createStrategy` from `@trystero-p2p/core`), so the fake stays true to the library.
- `vi.fn()` stands in for external dependencies only (`mediaDevices`, `clipboard`, `joinRoom`); everything else is a real object. `virtual:pwa-register` resolves to a stub in `src/__mocks__` via a Vitest alias.
- Arrange / Act / Assert blocks are separated by blank lines.
- Vitest globals are off: import `describe`, `it`, `expect`, `vi` and hooks from `'vitest'`. Wait for pending callbacks with `await setTimeout(ms)` from `node:timers/promises`, not `new Promise(r => setTimeout(r, ms))`. Give every `vi.fn` its function type: `vi.fn<Clipboard['writeText']>()`.
- E2E locates elements by role or label (`getByRole`, `getByLabel`), never by CSS selector, and wraps tests in `test.describe`. Extra browser contexts come from a `test.extend` fixture, since hooks are banned.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`heaviss/call-ma`, via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
