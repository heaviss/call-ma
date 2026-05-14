## Project Specification
This project is a web-based peer-to-peer video conferencing app with a minimalist UI. We will use a
JavaScript monorepo (via Yarn or npm workspaces) and the Vite bundler to streamline development .
Testing will be done with Vitest, a Vite-powered testing framework . The app should function as a
PWA: include a web manifest, icons, and a service worker for offline support (at minimum, a custom
offline page) .

1. Setup Environment: Initialize a monorepo structure using Yarn workspaces (or npm
workspaces) with Vite configured as the build tool . 
2. Code Quality: Integrate ESLint and Prettier for consistent code style and formatting. 
3. Testing Infrastructure: Configure Vitest for unit/integration tests and add an example test to
ensure it runs . 
4. PWA Configuration: Create a manifest.json , application icons, and a service worker that
provides a fallback offline page . 
5. UI Implementation: Develop a simple HTML/JS UI with: a “Create Conference” button, a “Copy
Link” button, and a textarea/input for pasting an invite link. Include two video elements (for local
and remote video) and a section for local logs/statistics. 
6. Signaling Link: Implement logic so that when the creator starts a conference, an SDP/ICE offer
(and any needed ICE candidates) is encoded into the URL. The creator clicks “Copy Link” to share
it. When a participant opens that link, the app parses the encoded data, sets it as the remote
description, generates an answer, and establishes a P2P WebRTC connection. 
7. Signaling Fallback: If direct connection fails, optionally use a temporary public signaling relay
(e.g. a public STUN/TURN or simple echo server) only for the initial handshake. Once the P2P
channel is established, the relay should be dropped. 
8. Logging & Stats: Collect basic connection statistics (e.g. latency, quality) locally in the app for
debugging, but do not send these to any server. 
9. Browser Support: Ensure the app works on Chrome and Firefox (mobile networks and home
Wi-Fi are the target, not strict corporate networks). 
10. Deployment: Configure the app to be hosted on GitHub Pages initially, with consideration for
future IPFS hosting.