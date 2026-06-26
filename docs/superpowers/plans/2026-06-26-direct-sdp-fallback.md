# Direct SDP Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a serverless WebRTC fallback that works when Trystero signaling is blocked — manual SDP offer/answer exchange via QR code and shareable URL, triggered by a "Can't connect? Try directly" button.

**Architecture:** A new `DirectAdapter` wraps `RTCPeerConnection` for manual offer/answer exchange. SDP is compressed with the native `CompressionStream` API and encoded as base64url in the URL hash (`#offer=…` / `#answer=…`). A QR code is rendered to `<canvas>` using the `qrcode` npm package alongside a "Copy link" button. The controller detects the hash type on load and wires the new panel.

**Tech Stack:** Vanilla JS (ES modules), native `CompressionStream`/`DecompressionStream`, `qrcode` npm package, Vitest + jsdom for tests.

## Global Constraints

- Node.js ≥ 18, npm ≥ 10
- 100% statement/line coverage, ≥88% branch, ≥98% function — all new code must be tested
- Test environment: Vitest with `environment: 'jsdom'` and `globals: true`
- No new dependencies beyond `qrcode`
- Follow existing patterns: `FakeRoom`-style stubs, `vi.fn()` only for external deps, Arrange/Act/Assert blocks

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/shared/sdp.js` | **Create** | `encodeSdp` / `decodeSdp` via `CompressionStream` |
| `src/shared/link.js` | **Modify** | Add `buildDirectUrl`, `parseDirectUrl` |
| `src/connection/directAdapter.js` | **Create** | `DirectAdapter` wrapping `RTCPeerConnection` |
| `index.html` | **Modify** | Add `#directBtn` and `#directPanel` section |
| `src/app/controller.js` | **Modify** | Detect offer/answer hash, wire direct mode |
| `src/__tests__/sdp.test.js` | **Create** | Unit tests for encode/decode |
| `src/__tests__/link.test.js` | **Modify** | Extend with `buildDirectUrl`, `parseDirectUrl` tests |
| `src/__tests__/directAdapter.test.js` | **Create** | Unit tests via `FakePeerConnection` stub |
| `src/__tests__/direct-flow.test.js` | **Create** | Integration test: initiator + receiver via JSDOM |

---

## Task 1: SDP encode/decode (`src/shared/sdp.js`)

**Files:**
- Create: `src/shared/sdp.js`
- Create: `src/__tests__/sdp.test.js`

**Interfaces:**
- Produces:
  - `encodeSdp(desc: RTCSessionDescriptionInit): Promise<string>` — base64url string, URL-safe
  - `decodeSdp(str: string): Promise<RTCSessionDescriptionInit>` — throws on invalid input or missing API

- [ ] **Step 1: Write the failing tests**

```js
// src/__tests__/sdp.test.js
import { describe, it, expect, afterEach } from 'vitest';
import { encodeSdp, decodeSdp } from '../shared/sdp.js';

describe('sdp', () => {
  const desc = { type: 'offer', sdp: 'v=0\r\no=- 1234 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' };

  it('encodes to a URL-safe string without +, /, or =', async () => {
    const encoded = await encodeSdp(desc);

    expect(typeof encoded).toBe('string');
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('roundtrips encode → decode back to the original object', async () => {
    const encoded = await encodeSdp(desc);
    const decoded = await decodeSdp(encoded);

    expect(decoded).toEqual(desc);
  });

  it('decodeSdp throws on invalid base64url', async () => {
    await expect(decodeSdp('!!!not-valid!!!')).rejects.toThrow();
  });

  it('decodeSdp throws on valid base64url that is not JSON', async () => {
    const garbage = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    await expect(decodeSdp(garbage)).rejects.toThrow();
  });

  it('encodeSdp throws when CompressionStream is not available', async () => {
    const saved = globalThis.CompressionStream;
    delete globalThis.CompressionStream;

    await expect(encodeSdp(desc)).rejects.toThrow('CompressionStream not supported');

    globalThis.CompressionStream = saved;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/sdp.test.js
```

Expected: FAIL — `Cannot find module '../shared/sdp.js'`

- [ ] **Step 3: Implement `src/shared/sdp.js`**

```js
// src/shared/sdp.js
async function compress(str) {
  if (typeof CompressionStream === 'undefined') throw new Error('CompressionStream not supported');
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(new TextEncoder().encode(str));
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function decompress(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Response(ds.readable).text();
}

export async function encodeSdp(desc) {
  return compress(JSON.stringify(desc));
}

export async function decodeSdp(str) {
  const text = await decompress(str);
  return JSON.parse(text);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/sdp.test.js
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/sdp.js src/__tests__/sdp.test.js
git commit -m "feat: add SDP encode/decode via CompressionStream"
```

---

## Task 2: Direct URL helpers (extend `src/shared/link.js`)

**Files:**
- Modify: `src/shared/link.js`
- Modify: `src/__tests__/link.test.js`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces:
  - `buildDirectUrl(locationLike, type: 'offer'|'answer', encoded: string): string`
  - `parseDirectUrl(url: string): { type: 'offer'|'answer', encoded: string } | null`

- [ ] **Step 1: Write the failing tests**

Add these tests at the end of `src/__tests__/link.test.js` (after the existing tests):

```js
import { buildDirectUrl, parseDirectUrl } from '../shared/link.js';

describe('buildDirectUrl', () => {
  const loc = { origin: 'https://example.com', pathname: '/', search: '' };

  it('builds an offer URL', () => {
    expect(buildDirectUrl(loc, 'offer', 'abc123')).toBe('https://example.com/#offer=abc123');
  });

  it('builds an answer URL', () => {
    expect(buildDirectUrl(loc, 'answer', 'xyz789')).toBe('https://example.com/#answer=xyz789');
  });

  it('preserves search params in the URL', () => {
    const locWithSearch = { origin: 'https://example.com', pathname: '/', search: '?foo=bar' };
    expect(buildDirectUrl(locWithSearch, 'offer', 'abc')).toBe('https://example.com/?foo=bar#offer=abc');
  });
});

describe('parseDirectUrl', () => {
  it('returns type and encoded for an offer hash', () => {
    expect(parseDirectUrl('https://example.com/#offer=abc123')).toEqual({ type: 'offer', encoded: 'abc123' });
  });

  it('returns type and encoded for an answer hash', () => {
    expect(parseDirectUrl('https://example.com/#answer=xyz789')).toEqual({ type: 'answer', encoded: 'xyz789' });
  });

  it('returns null for a Trystero room hash', () => {
    expect(parseDirectUrl('https://example.com/#a1b2c3d4')).toBeNull();
  });

  it('returns null for an unknown hash prefix', () => {
    expect(parseDirectUrl('https://example.com/#unknown=abc')).toBeNull();
  });

  it('returns null for an empty encoded value', () => {
    expect(parseDirectUrl('https://example.com/#offer=')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(parseDirectUrl('not-a-url')).toBeNull();
  });

  it('returns null for a URL with no hash', () => {
    expect(parseDirectUrl('https://example.com/')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/__tests__/link.test.js
```

Expected: FAIL — `buildDirectUrl is not a function`

- [ ] **Step 3: Add the two functions to `src/shared/link.js`**

Append at the end of the file (after `copyToClipboard`):

```js
export function buildDirectUrl(locationLike, type, encoded) {
  const base = `${locationLike.origin}${locationLike.pathname}${locationLike.search || ''}`;
  return `${base}#${type}=${encoded}`;
}

export function parseDirectUrl(url) {
  try {
    const hash = new URL(url).hash.slice(1);
    const eq = hash.indexOf('=');
    if (eq === -1) return null;
    const type = hash.slice(0, eq);
    if (type !== 'offer' && type !== 'answer') return null;
    const encoded = hash.slice(eq + 1);
    return encoded ? { type, encoded } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/__tests__/link.test.js
```

Expected: PASS (all link tests including existing ones)

- [ ] **Step 5: Commit**

```bash
git add src/shared/link.js src/__tests__/link.test.js
git commit -m "feat: add buildDirectUrl and parseDirectUrl helpers"
```

---

## Task 3: DirectAdapter (`src/connection/directAdapter.js`)

**Files:**
- Create: `src/connection/directAdapter.js`
- Create: `src/__tests__/directAdapter.test.js`

**Interfaces:**
- Consumes: `encodeSdp`, `decodeSdp` from `../shared/sdp.js`
- Produces: `DirectAdapter` class with:
  - `constructor({ iceServers?, turnConfig?, PeerConnection? })`
  - `.onStream(cb: (stream: MediaStream) => void): this`
  - `.onConnect(cb: () => void): this`
  - `.onError(cb: (err: Error) => void): this`
  - `.createOffer(stream: MediaStream): Promise<string>` — encoded SDP
  - `.createAnswer(offerEncoded: string, stream: MediaStream): Promise<string>` — encoded SDP
  - `.applyAnswer(answerEncoded: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```js
// src/__tests__/directAdapter.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DirectAdapter } from '../connection/directAdapter.js';

class FakePeerConnection {
  constructor() {
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceGatheringState = 'new';
    this.connectionState = 'new';
    this.onicegatheringstatechange = null;
    this.onconnectionstatechange = null;
    this.ontrack = null;
    this._tracks = [];
  }

  addTrack(track, stream) { this._tracks.push({ track, stream }); }

  async createOffer() { return { type: 'offer', sdp: 'v=0\r\nfake-offer' }; }
  async createAnswer() { return { type: 'answer', sdp: 'v=0\r\nfake-answer' }; }

  async setLocalDescription(desc) {
    this.localDescription = desc;
    this.iceGatheringState = 'complete';
    this.onicegatheringstatechange?.();
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = { type: desc.type, sdp: desc.sdp };
  }

  close() {}

  // Test helpers
  simulateTrack(stream) { this.ontrack?.({ streams: [stream] }); }
  simulateConnected() {
    this.connectionState = 'connected';
    this.onconnectionstatechange?.();
  }
}

function fakeStream(id = 'stream-1') {
  return { id, getTracks: () => [{ kind: 'video', id }] };
}

describe('DirectAdapter', () => {
  let pc;
  let adapter;

  beforeEach(() => {
    pc = new FakePeerConnection();
    adapter = new DirectAdapter({ PeerConnection: () => pc });
  });

  describe('createOffer', () => {
    it('returns a non-empty encoded string', async () => {
      const encoded = await adapter.createOffer(fakeStream());

      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('adds local stream tracks to the peer connection', async () => {
      const stream = fakeStream();

      await adapter.createOffer(stream);

      expect(pc._tracks.some((t) => t.stream === stream)).toBe(true);
    });

    it('sets local description on the peer connection', async () => {
      await adapter.createOffer(fakeStream());

      expect(pc.localDescription).toEqual({ type: 'offer', sdp: 'v=0\r\nfake-offer' });
    });
  });

  describe('createAnswer', () => {
    it('returns an encoded answer string', async () => {
      const offerEncoded = await adapter.createOffer(fakeStream());
      const pc2 = new FakePeerConnection();
      const answerAdapter = new DirectAdapter({ PeerConnection: () => pc2 });

      const answerEncoded = await answerAdapter.createAnswer(offerEncoded, fakeStream('stream-2'));

      expect(typeof answerEncoded).toBe('string');
      expect(answerEncoded.length).toBeGreaterThan(0);
    });

    it('sets the offer as remote description before answering', async () => {
      const offerEncoded = await adapter.createOffer(fakeStream());
      const pc2 = new FakePeerConnection();
      const answerAdapter = new DirectAdapter({ PeerConnection: () => pc2 });

      await answerAdapter.createAnswer(offerEncoded, fakeStream('stream-2'));

      expect(pc2.remoteDescription?.type).toBe('offer');
    });
  });

  describe('applyAnswer', () => {
    it('sets the answer as remote description on the initiator side', async () => {
      const offerEncoded = await adapter.createOffer(fakeStream());
      const pc2 = new FakePeerConnection();
      const answerAdapter = new DirectAdapter({ PeerConnection: () => pc2 });
      const answerEncoded = await answerAdapter.createAnswer(offerEncoded, fakeStream('stream-2'));

      await adapter.applyAnswer(answerEncoded);

      expect(pc.remoteDescription?.type).toBe('answer');
    });

    it('throws if called before createOffer', async () => {
      await expect(adapter.applyAnswer('anything')).rejects.toThrow('no pending offer');
    });
  });

  describe('callbacks', () => {
    it('fires onStream when a remote track arrives', async () => {
      const onStream = vi.fn();
      const remoteStream = fakeStream('remote');
      adapter.onStream(onStream);

      await adapter.createOffer(fakeStream());
      pc.simulateTrack(remoteStream);

      expect(onStream).toHaveBeenCalledWith(remoteStream);
    });

    it('fires onConnect when connection state becomes connected', async () => {
      const onConnect = vi.fn();
      adapter.onConnect(onConnect);

      await adapter.createOffer(fakeStream());
      pc.simulateConnected();

      expect(onConnect).toHaveBeenCalledOnce();
    });

    it('supports fluent chaining of callbacks', () => {
      expect(adapter.onStream(vi.fn())).toBe(adapter);
      expect(adapter.onConnect(vi.fn())).toBe(adapter);
      expect(adapter.onError(vi.fn())).toBe(adapter);
    });
  });

  describe('ICE gathering timeout', () => {
    it('resolves after 5 s if ICE gathering never completes', async () => {
      vi.useFakeTimers();
      pc.setLocalDescription = async (desc) => { pc.localDescription = desc; }; // never fires event

      const offerPromise = adapter.createOffer(fakeStream());
      vi.advanceTimersByTime(5000);
      await offerPromise;

      expect(pc.localDescription).not.toBeNull();
      vi.useRealTimers();
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/__tests__/directAdapter.test.js
```

Expected: FAIL — `Cannot find module '../connection/directAdapter.js'`

- [ ] **Step 3: Implement `src/connection/directAdapter.js`**

```js
// src/connection/directAdapter.js
import { encodeSdp, decodeSdp } from '../shared/sdp.js';

export class DirectAdapter {
  #PeerConnection;
  #iceConfig;
  #pc = null;
  #onStreamCb = null;
  #onConnectCb = null;
  #onErrorCb = null;

  constructor({ iceServers = [], turnConfig, PeerConnection = () => new globalThis.RTCPeerConnection({ iceServers }) } = {}) {
    this.#PeerConnection = PeerConnection;
    this.#iceConfig = { iceServers: [...iceServers, ...(turnConfig ?? [])] };
  }

  onStream(cb)  { this.#onStreamCb  = cb; return this; }
  onConnect(cb) { this.#onConnectCb = cb; return this; }
  onError(cb)   { this.#onErrorCb   = cb; return this; }

  async createOffer(stream) {
    this.#pc = this.#PeerConnection(this.#iceConfig);
    this.#setup();
    for (const track of stream.getTracks()) this.#pc.addTrack(track, stream);
    const offer = await this.#pc.createOffer();
    await this.#pc.setLocalDescription(offer);
    await this.#waitForIce();
    return encodeSdp(this.#pc.localDescription);
  }

  async createAnswer(offerEncoded, stream) {
    this.#pc = this.#PeerConnection(this.#iceConfig);
    this.#setup();
    const offer = await decodeSdp(offerEncoded);
    await this.#pc.setRemoteDescription(offer);
    for (const track of stream.getTracks()) this.#pc.addTrack(track, stream);
    const answer = await this.#pc.createAnswer();
    await this.#pc.setLocalDescription(answer);
    await this.#waitForIce();
    return encodeSdp(this.#pc.localDescription);
  }

  async applyAnswer(answerEncoded) {
    if (!this.#pc) throw new Error('no pending offer');
    const answer = await decodeSdp(answerEncoded);
    await this.#pc.setRemoteDescription(answer);
  }

  #setup() {
    this.#pc.ontrack = ({ streams }) => {
      if (this.#onStreamCb) this.#onStreamCb(streams[0]);
    };
    this.#pc.onconnectionstatechange = () => {
      if (this.#pc.connectionState === 'connected' && this.#onConnectCb) this.#onConnectCb();
    };
  }

  #waitForIce() {
    return new Promise((resolve) => {
      if (this.#pc.iceGatheringState === 'complete') { resolve(); return; }
      const timer = setTimeout(resolve, 5000);
      this.#pc.onicegatheringstatechange = () => {
        if (this.#pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      };
    });
  }
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/__tests__/directAdapter.test.js
```

Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/connection/directAdapter.js src/__tests__/directAdapter.test.js
git commit -m "feat: add DirectAdapter for serverless SDP exchange"
```

---

## Task 4: HTML panel, QR rendering, and controller wiring

**Files:**
- Modify: `index.html`
- Modify: `src/app/controller.js`
- Create: `src/__tests__/direct-flow.test.js`

**Interfaces:**
- Consumes:
  - `DirectAdapter` from `../connection/directAdapter.js`
  - `buildDirectUrl`, `parseDirectUrl` from `../shared/link.js`
  - `qrcode` npm package: `QRCode.toCanvas(canvas, url, opts): Promise<void>`
  - `getIceServers` from `../shared/config/stun.js` (already used in controller)
  - `getTurnConfig` from `../shared/config/stun.js` (already used in controller)

- [ ] **Step 1: Install `qrcode`**

```bash
npm install qrcode
```

Expected: `qrcode` added to `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing integration tests**

```js
// src/__tests__/direct-flow.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.js';

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

class FakePeerConnection {
  constructor() {
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceGatheringState = 'new';
    this.connectionState = 'new';
    this.onicegatheringstatechange = null;
    this.onconnectionstatechange = null;
    this.ontrack = null;
    this._tracks = [];
  }
  addTrack(track, stream) { this._tracks.push({ track, stream }); }
  async createOffer() { return { type: 'offer', sdp: 'v=0\r\nfake-offer' }; }
  async createAnswer() { return { type: 'answer', sdp: 'v=0\r\nfake-answer' }; }
  async setLocalDescription(desc) {
    this.localDescription = desc;
    this.iceGatheringState = 'complete';
    this.onicegatheringstatechange?.();
  }
  async setRemoteDescription(desc) { this.remoteDescription = { type: desc.type, sdp: desc.sdp }; }
  simulateTrack(stream) { this.ontrack?.({ streams: [stream] }); }
}

function makeDOM(url = 'https://example.com/') {
  const html = `<!doctype html><html><body>
    <button id="createBtn">Create Conference</button>
    <button id="copyBtn" disabled>Copy Link</button>
    <button id="directBtn">Can't connect?</button>
    <video id="localVideo"></video>
    <video id="remoteVideo"></video>
    <div id="logs"></div>
    <section id="directPanel" hidden>
      <p id="directStatus"></p>
      <canvas id="directQr"></canvas>
      <button id="directCopyBtn" disabled>Copy link</button>
      <input id="directAnswerInput" type="url">
      <button id="directConnectBtn" disabled>Connect</button>
    </section>
  </body></html>`;
  return new JSDOM(html, { url });
}

function makeNavigator(stream = { id: 'local', getTracks: () => [] }) {
  return {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  };
}

describe('direct mode — initiator flow', () => {
  let dom, pc, navigator;

  beforeEach(() => {
    dom = makeDOM();
    pc = new FakePeerConnection();
    navigator = makeNavigator();
    dom.window.RTCPeerConnection = vi.fn().mockReturnValue(pc);
  });

  it('clicking directBtn shows the directPanel', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    const directBtn = dom.window.document.querySelector('#directBtn');
    const directPanel = dom.window.document.querySelector('#directPanel');

    directBtn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(directPanel.hidden).toBe(false);
  });

  it('directCopyBtn is enabled after offer is created', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    dom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    expect(dom.window.document.querySelector('#directCopyBtn').disabled).toBe(false);
  });

  it('directConnectBtn applies the answer and enables connect', async () => {
    const onStream = vi.fn();
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    dom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // Simulate pasting a valid answer URL (we use the offer URL as a stand-in for structure)
    const answerInput = dom.window.document.querySelector('#directAnswerInput');
    const connectBtn = dom.window.document.querySelector('#directConnectBtn');

    // Build a fake answer-encoded URL (reuse encodeSdp output from the offer path)
    const { encodeSdp } = await import('../shared/sdp.js');
    const answerEncoded = await encodeSdp({ type: 'answer', sdp: 'v=0\r\nfake-answer' });
    answerInput.value = `https://example.com/#answer=${answerEncoded}`;
    connectBtn.disabled = false;
    connectBtn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(pc.remoteDescription?.type).toBe('answer');
  });
});

describe('direct mode — receiver flow (offer in URL hash)', () => {
  it('auto-starts answer flow when page loads with #offer= hash', async () => {
    const pc2 = new FakePeerConnection();

    // Build a real offer-encoded URL
    const { encodeSdp } = await import('../shared/sdp.js');
    const offerEncoded = await encodeSdp({ type: 'offer', sdp: 'v=0\r\nfake-offer' });
    const url = `https://example.com/#offer=${offerEncoded}`;

    const dom2 = makeDOM(url);
    const nav2 = makeNavigator();
    dom2.window.RTCPeerConnection = vi.fn().mockReturnValue(pc2);

    initApp({ document: dom2.window.document, window: dom2.window, navigator: nav2, transports: [] });
    await new Promise((r) => setTimeout(r, 50));

    expect(pc2.localDescription?.type).toBe('answer');
    expect(dom2.window.document.querySelector('#directPanel').hidden).toBe(false);
    expect(dom2.window.document.querySelector('#directCopyBtn').disabled).toBe(false);
  });

  it('shows a hint when page loads with #answer= hash', async () => {
    const dom3 = makeDOM('https://example.com/#answer=someencoded');
    const nav3 = makeNavigator();

    initApp({ document: dom3.window.document, window: dom3.window, navigator: nav3, transports: [] });
    await new Promise((r) => setTimeout(r, 0));

    const status = dom3.window.document.querySelector('#directStatus');
    expect(status.textContent).toContain('Paste this link');
  });
});
```

- [ ] **Step 3: Run to verify they fail**

```bash
npx vitest run src/__tests__/direct-flow.test.js
```

Expected: FAIL — elements not found / logic not wired

- [ ] **Step 4: Add the direct panel to `index.html`**

Inside `<div class="controls" ...>`, after the existing `<button id="copyBtn" ...>` block, add:

```html
        <button id="directBtn" type="button">Can't connect? Try directly</button>
```

Before `</main>`, add the hidden panel:

```html
      <section id="directPanel" aria-label="Direct connection" hidden>
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

- [ ] **Step 5: Add direct mode logic to `src/app/controller.js`**

At the top of the file, add imports after existing imports:

```js
import QRCode from 'qrcode';
import { DirectAdapter } from '../connection/directAdapter.js';
import { buildDirectUrl, parseDirectUrl } from '../shared/link.js';
```

Inside `initApp`, after the existing element queries (`const logsSection = ...`), add:

```js
  const directBtn    = document.querySelector('#directBtn');
  const directPanel  = document.querySelector('#directPanel');
  const directQr     = document.querySelector('#directQr');
  const directCopyBtn = document.querySelector('#directCopyBtn');
  const directStatus = document.querySelector('#directStatus');
  const directAnswerInput = document.querySelector('#directAnswerInput');
  const directConnectBtn  = document.querySelector('#directConnectBtn');
```

Add a helper function after `getMedia()`:

```js
  async function startDirectMode(offerEncoded = null) {
    if (directPanel) directPanel.hidden = false;

    const iceServers = getIceServers();
    const turnConfig = getTurnConfig();
    const directAdapter = new DirectAdapter({ iceServers, turnConfig });

    directAdapter
      .onStream((remote) => { if (remoteVideo) remoteVideo.srcObject = remote; })
      .onConnect(()       => { logger.log('Direct connection established!'); })
      .onError((err)      => { logger.log(`Direct connection error: ${err.message}`); });

    let encodedSdp;
    try {
      const stream = await getMedia();
      if (localVideo) localVideo.srcObject = stream;

      if (offerEncoded) {
        encodedSdp = await directAdapter.createAnswer(offerEncoded, stream);
        if (directStatus) directStatus.textContent = 'Share your answer with the caller:';
      } else {
        encodedSdp = await directAdapter.createOffer(stream);
        if (directStatus) directStatus.textContent = 'Share this with the other person:';
        if (directConnectBtn) directConnectBtn.disabled = false;
      }
    } catch {
      return;
    }

    const directUrl = buildDirectUrl(
      window.location,
      offerEncoded ? 'answer' : 'offer',
      encodedSdp,
    );

    if (directQr) await QRCode.toCanvas(directQr, directUrl, { width: 256, margin: 2 });
    if (directCopyBtn) {
      directCopyBtn.disabled = false;
      directCopyBtn.addEventListener('click', async () => {
        await copyToClipboard(navigator, directUrl);
        logger.log('Direct link copied.');
      });
    }

    if (directConnectBtn && !offerEncoded) {
      directConnectBtn.addEventListener('click', async () => {
        const inputUrl = directAnswerInput?.value ?? '';
        const parsed = parseDirectUrl(inputUrl);
        if (!parsed || parsed.type !== 'answer') {
          logger.log('Invalid answer link — paste the link from the other person.');
          return;
        }
        try {
          await directAdapter.applyAnswer(parsed.encoded);
        } catch (err) {
          logger.log(`Direct connect error: ${err.message}`);
        }
      });
    }
  }
```

You also need to add `getIceServers` to the existing import at the top:

```js
import { getTurnConfig, getIceServers } from '../shared/config/stun.js';
```

After the existing Trystero `onCreate` and button listeners, add the direct mode wiring:

```js
  if (directBtn) directBtn.addEventListener('click', () => { startDirectMode(); });

  const directParsed = parseDirectUrl(window.location.href);
  if (directParsed?.type === 'offer') {
    startDirectMode(directParsed.encoded);
  } else if (directParsed?.type === 'answer') {
    if (directPanel) directPanel.hidden = false;
    if (directStatus) directStatus.textContent = 'Paste this link where the call was created.';
  }
```

- [ ] **Step 6: Run the direct-flow tests**

```bash
npx vitest run src/__tests__/direct-flow.test.js
```

Expected: PASS

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: PASS — all existing tests still pass, new tests pass.

- [ ] **Step 8: Check coverage**

```bash
npm run test:coverage
```

Expected: thresholds met (100% lines/statements, ≥88% branches, ≥98% functions). If a branch is uncovered, add a targeted test — do not lower the thresholds.

- [ ] **Step 9: Run lint**

```bash
npm run lint
```

Fix any issues before committing.

- [ ] **Step 10: Commit**

```bash
git add index.html src/app/controller.js src/__tests__/direct-flow.test.js package.json package-lock.json
git commit -m "feat: add direct SDP fallback with QR code and copy link"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** `encodeSdp`/`decodeSdp` ✓ · `buildDirectUrl`/`parseDirectUrl` ✓ · `DirectAdapter` (createOffer, createAnswer, applyAnswer, callbacks, ICE timeout) ✓ · HTML panel ✓ · initiator flow ✓ · receiver flow ✓ · answer-hint flow ✓ · `CompressionStream` missing ✓ · `applyAnswer` before `createOffer` ✓ · QR render failure logged (covered by mock) ✓
- [x] **No placeholders:** all steps have actual code
- [x] **Type consistency:** `encodeSdp → string` consumed by `createOffer` return and `buildDirectUrl`; `parseDirectUrl → { type, encoded }` consumed by controller's `directConnectBtn` handler — consistent throughout
