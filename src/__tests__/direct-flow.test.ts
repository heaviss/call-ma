import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import type { Mock } from 'vitest';
import { initApp } from '../app/controller.ts';
import { fakeStream, getEl, makeNavigator as makeFakeNavigator, type FakeNavigator } from './fakes/dom.ts';

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

class FakePeerConnection {
  #tracks: { track: MediaStreamTrack; stream: MediaStream }[] = [];
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: { type: RTCSdpType; sdp: string | undefined } | null = null;
  iceGatheringState: RTCIceGatheringState = 'new';
  connectionState: RTCPeerConnectionState = 'new';
  onicegatheringstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: { streams: readonly MediaStream[] }) => void) | null = null;
  addTrack(track: MediaStreamTrack, stream: MediaStream): void { this.#tracks.push({ track, stream }); }
  async createOffer(): Promise<RTCSessionDescriptionInit> { return { type: 'offer', sdp: 'v=0\r\nfake-offer' }; }
  async createAnswer(): Promise<RTCSessionDescriptionInit> { return { type: 'answer', sdp: 'v=0\r\nfake-answer' }; }
  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc;
    this.iceGatheringState = 'complete';
    this.onicegatheringstatechange?.();
  }
  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> { this.remoteDescription = { type: desc.type, sdp: desc.sdp }; }
  simulateTrack(stream: MediaStream): void { this.ontrack?.({ streams: [stream] }); }
}

function makeDOM(url = 'https://example.com/'): JSDOM {
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

const DEFAULT_STREAM = fakeStream('local');
function makeNavigator(): FakeNavigator {
  const navigator = makeFakeNavigator(DEFAULT_STREAM);
  navigator.clipboard.writeText.mockResolvedValue(undefined);
  return navigator;
}

// The controller only calls `new window.RTCPeerConnection(cfg)`; a regular function works with `new`.
function stubPeerConnection(pc: FakePeerConnection): Mock {
  return vi.fn(function () { return pc; });
}

describe('direct mode — initiator flow', () => {
  let dom: JSDOM;
  let pc: FakePeerConnection;
  let navigator: FakeNavigator;

  beforeEach(() => {
    dom = makeDOM();
    pc = new FakePeerConnection();
    navigator = makeNavigator();
    dom.window['RTCPeerConnection'] = stubPeerConnection(pc); // ponytail: vi.fn().mockReturnValue fails with `new` in Vitest 4
  });

  it('clicking directBtn shows the directPanel', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    const directBtn = getEl<HTMLButtonElement>(dom.window.document, '#directBtn');
    const directPanel = getEl(dom.window.document, '#directPanel');

    directBtn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(directPanel.hidden).toBe(false);
  });

  it('directCopyBtn is enabled after offer is created', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    expect(getEl<HTMLButtonElement>(dom.window.document, '#directCopyBtn').disabled).toBe(false);
  });

  it('directConnectBtn is enabled after offer is created', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    expect(getEl<HTMLButtonElement>(dom.window.document, '#directConnectBtn').disabled).toBe(false);
  });

  it('directConnectBtn applies the answer and enables connect', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // Simulate pasting a valid answer URL (we use the offer URL as a stand-in for structure)
    const answerInput = getEl<HTMLInputElement>(dom.window.document, '#directAnswerInput');
    const connectBtn = getEl<HTMLButtonElement>(dom.window.document, '#directConnectBtn');

    // Build a fake answer-encoded URL (reuse encodeSdp output from the offer path)
    const { encodeSdp } = await import('../shared/sdp.ts');
    const answerEncoded = await encodeSdp({ type: 'answer', sdp: 'v=0\r\nfake-answer' });
    answerInput.value = `https://example.com/#answer=${answerEncoded}`;
    // Assert button was enabled by the controller (not manually)
    expect(connectBtn.disabled).toBe(false);
    connectBtn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(pc.remoteDescription?.type).toBe('answer');
  });

  it('directCopyBtn click copies the direct URL to clipboard', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    getEl<HTMLButtonElement>(dom.window.document, '#directCopyBtn').click();
    await new Promise((r) => setTimeout(r, 10));

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(getEl(dom.window.document, '#logs').textContent).toContain('Direct link copied');
  });

  it('directConnectBtn with invalid URL logs error message', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // Leave input empty — invalid answer URL
    const connectBtn = getEl<HTMLButtonElement>(dom.window.document, '#directConnectBtn');
    connectBtn.disabled = false;
    connectBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(getEl(dom.window.document, '#logs').textContent).toContain('Invalid answer link');
  });

  it('directConnectBtn logs error when applyAnswer throws', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // Make setRemoteDescription throw so applyAnswer fails
    pc.setRemoteDescription = async () => { throw new Error('SDP error'); };

    const { encodeSdp } = await import('../shared/sdp.ts');
    const answerEncoded = await encodeSdp({ type: 'answer', sdp: 'v=0\r\nfake-answer' });
    getEl<HTMLInputElement>(dom.window.document, '#directAnswerInput').value = `https://example.com/#answer=${answerEncoded}`;
    const connectBtn = getEl<HTMLButtonElement>(dom.window.document, '#directConnectBtn');
    connectBtn.disabled = false;
    connectBtn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(getEl(dom.window.document, '#logs').textContent).toContain('Direct connect error');
  });

  it('onStream callback sets remoteVideo srcObject', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    const remoteStream = fakeStream('remote');
    pc.simulateTrack(remoteStream);

    expect(getEl<HTMLVideoElement>(dom.window.document, '#remoteVideo').srcObject).toBe(remoteStream);
  });

  it('onConnect callback logs connection established', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    pc.connectionState = 'connected';
    pc.onconnectionstatechange?.();

    expect(getEl(dom.window.document, '#logs').textContent).toContain('Direct connection established');
  });

  it('onError callback logs connection error', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    pc.connectionState = 'failed';
    pc.onconnectionstatechange?.();

    expect(getEl(dom.window.document, '#logs').textContent).toContain('Direct connection error');
  });

  it('startDirectMode returns silently when getMedia throws', async () => {
    const failNav = makeNavigator();
    failNav.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error('denied'));

    initApp({ document: dom.window.document, window: dom.window, navigator: failNav, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // Panel shows (happens before getMedia), but offer never completes
    expect(getEl(dom.window.document, '#directPanel').hidden).toBe(false);
    expect(getEl<HTMLButtonElement>(dom.window.document, '#directCopyBtn').disabled).toBe(true);
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
    minDom.window['RTCPeerConnection'] = stubPeerConnection(minPc);

    initApp({ document: minDom.window.document, window: minDom.window, navigator: minNav, transports: [] });
    getEl<HTMLButtonElement>(minDom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    // directCopyBtn should be enabled even without optional elements
    expect(getEl<HTMLButtonElement>(minDom.window.document, '#directCopyBtn').disabled).toBe(false);
  });

  it('shows QR error log but still enables copy button when QRCode.toCanvas throws', async () => {
    const qrcodeModule = await import('qrcode');
    const QRCode = qrcodeModule.default;
    vi.mocked(QRCode.toCanvas).mockRejectedValueOnce(new Error('canvas error'));

    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    getEl<HTMLButtonElement>(dom.window.document, '#directBtn').click();
    await new Promise((r) => setTimeout(r, 50));

    expect(getEl<HTMLButtonElement>(dom.window.document, '#directCopyBtn').disabled).toBe(false);
    expect(getEl(dom.window.document, '#logs').textContent).toContain('QR rendering failed');
  });

  it('ignores repeated directBtn clicks after the first', async () => {
    initApp({ document: dom.window.document, window: dom.window, navigator, transports: [] });
    const directBtn = getEl<HTMLButtonElement>(dom.window.document, '#directBtn');

    directBtn.click();
    directBtn.click();
    directBtn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });
});

describe('CompressionStream unavailable', () => {
  it('hides directBtn when CompressionStream is not available', () => {
    vi.stubGlobal('CompressionStream', undefined);

    const dom2 = makeDOM();
    const nav2 = makeNavigator();
    initApp({ document: dom2.window.document, window: dom2.window, navigator: nav2, transports: [] });

    vi.unstubAllGlobals();

    // Note: jsdom does not apply CSS hidden, check the attribute
    expect(getEl<HTMLButtonElement>(dom2.window.document, '#directBtn').hidden).toBe(true);
  });
});

describe('direct mode — receiver flow (offer in URL hash)', () => {
  it('auto-starts answer flow when page loads with #offer= hash', async () => {
    const pc2 = new FakePeerConnection();

    // Build a real offer-encoded URL
    const { encodeSdp } = await import('../shared/sdp.ts');
    const offerEncoded = await encodeSdp({ type: 'offer', sdp: 'v=0\r\nfake-offer' });
    const url = `https://example.com/#offer=${offerEncoded}`;

    const dom2 = makeDOM(url);
    const nav2 = makeNavigator();
    dom2.window['RTCPeerConnection'] = stubPeerConnection(pc2); // ponytail: vi.fn().mockReturnValue fails with `new` in Vitest 4

    initApp({ document: dom2.window.document, window: dom2.window, navigator: nav2, transports: [] });
    await new Promise((r) => setTimeout(r, 50));

    expect(pc2.localDescription?.type).toBe('answer');
    expect(getEl(dom2.window.document, '#directPanel').hidden).toBe(false);
    expect(getEl<HTMLButtonElement>(dom2.window.document, '#directCopyBtn').disabled).toBe(false);
  });

  it('shows a hint when page loads with #answer= hash', async () => {
    const dom3 = makeDOM('https://example.com/#answer=someencoded');
    const nav3 = makeNavigator();

    initApp({ document: dom3.window.document, window: dom3.window, navigator: nav3, transports: [] });
    await new Promise((r) => setTimeout(r, 0));

    const status = getEl(dom3.window.document, '#directStatus');
    expect(status.textContent).toContain('Paste this link');
  });
});
