# call-ma

A minimalist, URL-signaled WebRTC video call app. This repository is a monorepo prepared for incremental, test-driven development.

Quickstart (Phase 0)
- Requires Node.js >= 18 and npm >= 10.
- Run: npm run bootstrap
- Workspaces: packages/app (frontend app), packages/shared (shared utilities)

What’s here in Phase 0
- Monorepo layout with npm workspaces.
- Baseline project hygiene: .editorconfig, .gitignore.
- Shared placeholders:
  - ConnectionAdapter contract (to keep app independent of connectivity provider).
  - STUN servers config with environment override.

Library choices (to be integrated in later phases)
- Primary connectivity: simple-peer (pinned when added to packages/app).
- Fallback option: js-libp2p with WebRTC transport (pinned when introduced).
- Optional assist: WebConnect.js (evaluate only if it simplifies URL/relay exchange).

STUN servers
- Default public STUN list kept in @call-ma/shared. You can override via env variable STUN_SERVERS (comma-separated):
  - Example: STUN_SERVERS=stun:stun.l.google.com:19302,stun:global.stun.twilio.com:3478

Development notes
- TDD-first workflow begins as tooling lands (Vite + Vitest in Phase 1/3).
- Keep code minimal and readable. Avoid testing external libraries directly; test our logic.

Roadmap
- See todo.md for the phased plan.
