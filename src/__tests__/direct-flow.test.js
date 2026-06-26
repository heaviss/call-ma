import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.js';

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

class FakePeerConnection {
  constructor() {
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
  localDescription = null;
  remoteDescription = null;
  iceGatheringState = 'new';
  connectionState = 'new';
  onicegatheringstatechange = null;
  onconnectionstatechange = null;
  ontrack = null;
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

const DEFAULT_STREAM = { id: 'local', getTracks: () => [] };
function makeNavigator(stream = DEFAULT_STREAM) {
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
    dom.window.RTCPeerConnection = vi.fn(function () { return pc; }); // ponytail: vi.fn().mockReturnValue fails with `new` in Vitest 4
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

  it('directCopyBtn click copies the direct URL to clipboard', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    dom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    dom.window.document.querySelector('#directCopyBtn').click();
    await new Promise((r) => setTimeout(r, 10));

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(dom.window.document.querySelector('#logs').textContent).toContain('Direct link copied');
  });

  it('directConnectBtn with invalid URL logs error message', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    dom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // Leave input empty — invalid answer URL
    const connectBtn = dom.window.document.querySelector('#directConnectBtn');
    connectBtn.disabled = false;
    connectBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(dom.window.document.querySelector('#logs').textContent).toContain('Invalid answer link');
  });

  it('directConnectBtn logs error when applyAnswer throws', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    dom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // Make setRemoteDescription throw so applyAnswer fails
    pc.setRemoteDescription = async () => { throw new Error('SDP error'); };

    const { encodeSdp } = await import('../shared/sdp.js');
    const answerEncoded = await encodeSdp({ type: 'answer', sdp: 'v=0\r\nfake-answer' });
    dom.window.document.querySelector('#directAnswerInput').value = `https://example.com/#answer=${answerEncoded}`;
    const connectBtn = dom.window.document.querySelector('#directConnectBtn');
    connectBtn.disabled = false;
    connectBtn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(dom.window.document.querySelector('#logs').textContent).toContain('Direct connect error');
  });

  it('onStream callback sets remoteVideo srcObject', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    dom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    const remoteStream = { id: 'remote' };
    pc.simulateTrack(remoteStream);

    expect(dom.window.document.querySelector('#remoteVideo').srcObject).toBe(remoteStream);
  });

  it('onConnect callback logs connection established', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    dom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    pc.connectionState = 'connected';
    pc.onconnectionstatechange?.();

    expect(dom.window.document.querySelector('#logs').textContent).toContain('Direct connection established');
  });

  it('onError callback logs connection error', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    dom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    pc.connectionState = 'failed';
    pc.onconnectionstatechange?.();

    expect(dom.window.document.querySelector('#logs').textContent).toContain('Direct connection error');
  });

  it('startDirectMode returns silently when getMedia throws', async () => {
    const failNav = makeNavigator();
    failNav.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error('denied'));

    initApp({ document: dom.window.document, window: dom.window, navigator: failNav, transports: [] });
    dom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // Panel shows (happens before getMedia), but offer never completes
    expect(dom.window.document.querySelector('#directPanel').hidden).toBe(false);
    expect(dom.window.document.querySelector('#directCopyBtn').disabled).toBe(true);
  });

  it('startDirectMode works when optional DOM elements are absent', async () => {
    // Stripped DOM — no localVideo, remoteVideo, directQr, directStatus, directPanel
    const html = `<!doctype html><html><body>
      <button id="createBtn"></button>
      <button id="directBtn"></button>
      <div id="logs"></div>
      <button id="directCopyBtn" disabled></button>
      <input id="directAnswerInput" type="url">
      <button id="directConnectBtn" disabled></button>
    </body></html>`;
    const minDom = new JSDOM(html, { url: 'https://example.com/' });
    const minPc = new FakePeerConnection();
    const minNav = makeNavigator();
    minDom.window.RTCPeerConnection = vi.fn(function () { return minPc; });

    initApp({ document: minDom.window.document, window: minDom.window, navigator: minNav, transports: [] });
    minDom.window.document.querySelector('#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // directCopyBtn should be enabled even without optional elements
    expect(minDom.window.document.querySelector('#directCopyBtn').disabled).toBe(false);
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
    dom2.window.RTCPeerConnection = vi.fn(function () { return pc2; }); // ponytail: vi.fn().mockReturnValue fails with `new` in Vitest 4

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
