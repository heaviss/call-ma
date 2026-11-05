import { JSDOM } from 'jsdom';
import { setTimeout } from 'node:timers/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initApp } from '../app/controller.ts';
import { encodeSdp } from '../shared/sdp.ts';
import { clickAndSettle, makeDirectDom } from './fakes/callPage.ts';
import {
  type FakeNavigator,
  fakeStream,
  getEl,
  makeNavigator as makeFakeNavigator,
} from './fakes/dom.ts';
import {
  type FakePeerConnection,
  makePeerConnection,
  stubPeerConnection,
} from './fakes/peerConnection.ts';

// eslint-disable-next-line vitest/prefer-import-in-mock -- the typed import() form checks the factory against @types/qrcode, whose overloaded toCanvas cannot be expressed as a Mock
vi.mock('qrcode', () => ({ toCanvas: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) }));

// Offer and answer creation, ICE and QR rendering all resolve within this many ms.
const OFFER_READY_MS = 50;

const DEFAULT_STREAM = fakeStream('local');
function makeNavigator(): FakeNavigator {
  const navigator = makeFakeNavigator(DEFAULT_STREAM);
  navigator.clipboard.writeText.mockResolvedValue(undefined);
  return navigator;
}

async function answerLink(): Promise<string> {
  const answerEncoded = await encodeSdp({ type: 'answer', sdp: 'v=0\r\nfake-answer' });
  return `https://example.com/#answer=${answerEncoded}`;
}

describe('direct mode — initiator flow', () => {
  let dom: JSDOM;
  let document: Document;
  let pc: FakePeerConnection;
  let navigator: FakeNavigator;

  beforeEach(() => {
    dom = makeDirectDom();
    ({ document } = dom.window);
    pc = makePeerConnection();
    navigator = makeNavigator();
    dom.window['RTCPeerConnection'] = stubPeerConnection(pc);
  });

  async function startDirectMode(): Promise<void> {
    initApp({ document, window: dom.window, navigator, transports: [] });
    await clickAndSettle(document, '#directBtn', OFFER_READY_MS);
  }

  it('clicking directBtn shows the directPanel', async () => {
    initApp({ document, window: dom.window, navigator, transports: [] });

    await clickAndSettle(document, '#directBtn', OFFER_READY_MS);

    expect(getEl(document, '#directPanel').hidden).toBe(false);
  });

  it.each(['#directCopyBtn', '#directConnectBtn'])(
    '%s is enabled after offer is created',
    async (selector) => {
      await startDirectMode();

      expect(getEl<HTMLButtonElement>(document, selector).disabled).toBe(false);
    },
  );

  it('directConnectBtn applies the answer and enables connect', async () => {
    await startDirectMode();
    const connectBtn = getEl<HTMLButtonElement>(document, '#directConnectBtn');
    getEl<HTMLInputElement>(document, '#directAnswerInput').value = await answerLink();

    connectBtn.click();
    await setTimeout(OFFER_READY_MS);

    expect(connectBtn.disabled).toBe(false);
    expect(pc.remoteDescription?.type).toBe('answer');
  });

  it('directCopyBtn click copies the direct URL to clipboard', async () => {
    await startDirectMode();

    await clickAndSettle(document, '#directCopyBtn', 10);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.any(String));
    expect(getEl(document, '#logs').textContent).toContain('Direct link copied');
  });

  it('directConnectBtn with invalid URL logs error message', async () => {
    await startDirectMode();
    // Leave input empty — invalid answer URL
    getEl<HTMLButtonElement>(document, '#directConnectBtn').disabled = false;

    await clickAndSettle(document, '#directConnectBtn', 10);

    expect(getEl(document, '#logs').textContent).toContain('Invalid answer link');
  });

  it('directConnectBtn logs error when applyAnswer throws', async () => {
    await startDirectMode();
    pc.setRemoteDescription = () => Promise.reject(new Error('SDP error'));
    getEl<HTMLInputElement>(document, '#directAnswerInput').value = await answerLink();
    getEl<HTMLButtonElement>(document, '#directConnectBtn').disabled = false;

    await clickAndSettle(document, '#directConnectBtn', OFFER_READY_MS);

    expect(getEl(document, '#logs').textContent).toContain('Direct connect error');
  });

  it('onStream callback sets remoteVideo srcObject', async () => {
    await startDirectMode();
    const remoteStream = fakeStream('remote');

    pc.simulateTrack(remoteStream);

    expect(getEl<HTMLVideoElement>(document, '#remoteVideo').srcObject).toBe(remoteStream);
  });

  it.each([
    ['connected', 'Direct connection established'],
    ['failed', 'Direct connection error'],
  ] as const)('logs when the connection becomes %s', async (state, message) => {
    await startDirectMode();

    pc.simulateConnectionState(state);

    expect(getEl(document, '#logs').textContent).toContain(message);
  });

  it('startDirectMode returns silently when getMedia throws', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('denied'));

    await startDirectMode();

    // Panel shows (happens before getMedia), but offer never completes
    expect(getEl(document, '#directPanel').hidden).toBe(false);
    expect(getEl<HTMLButtonElement>(document, '#directCopyBtn').disabled).toBe(true);
  });

  it('logs a direct mode error when the browser has no RTCPeerConnection', async () => {
    const bareDom = makeDirectDom();
    initApp({
      document: bareDom.window.document,
      window: bareDom.window,
      navigator,
      transports: [],
    });

    await clickAndSettle(bareDom.window.document, '#directBtn', OFFER_READY_MS);

    expect(getEl(bareDom.window.document, '#logs').textContent).toContain(
      'Direct mode error: window.RTCPeerConnection is not a constructor',
    );
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
    minDom.window['RTCPeerConnection'] = stubPeerConnection(makePeerConnection());
    initApp({ document: minDom.window.document, window: minDom.window, navigator, transports: [] });

    await clickAndSettle(minDom.window.document, '#directBtn', OFFER_READY_MS);

    expect(getEl<HTMLButtonElement>(minDom.window.document, '#directCopyBtn').disabled).toBe(false);
  });

  it('shows QR error log but still enables copy button when QRCode.toCanvas throws', async () => {
    const { toCanvas } = await import('qrcode');
    vi.mocked(toCanvas).mockRejectedValueOnce(new Error('canvas error'));

    await startDirectMode();

    expect(getEl<HTMLButtonElement>(document, '#directCopyBtn').disabled).toBe(false);
    expect(getEl(document, '#logs').textContent).toContain('QR rendering failed');
  });

  it('ignores repeated directBtn clicks after the first', async () => {
    initApp({ document, window: dom.window, navigator, transports: [] });
    const directBtn = getEl<HTMLButtonElement>(document, '#directBtn');

    directBtn.click();
    directBtn.click();
    directBtn.click();
    await setTimeout(OFFER_READY_MS);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });
});

describe('CompressionStream unavailable', () => {
  it('hides directBtn when CompressionStream is not available', () => {
    vi.stubGlobal('CompressionStream', undefined);
    const dom = makeDirectDom();

    initApp({
      document: dom.window.document,
      window: dom.window,
      navigator: makeNavigator(),
      transports: [],
    });
    vi.unstubAllGlobals();

    // Note: jsdom does not apply CSS hidden, check the attribute
    expect(getEl<HTMLButtonElement>(dom.window.document, '#directBtn').hidden).toBe(true);
  });
});

describe('direct mode — receiver flow (offer in URL hash)', () => {
  it('auto-starts answer flow when page loads with #offer= hash', async () => {
    const pc = makePeerConnection();
    const offerEncoded = await encodeSdp({ type: 'offer', sdp: 'v=0\r\nfake-offer' });
    const dom = makeDirectDom(`https://example.com/#offer=${offerEncoded}`);
    dom.window['RTCPeerConnection'] = stubPeerConnection(pc);

    initApp({
      document: dom.window.document,
      window: dom.window,
      navigator: makeNavigator(),
      transports: [],
    });
    await setTimeout(OFFER_READY_MS);

    expect(pc.localDescription?.type).toBe('answer');
    expect(getEl(dom.window.document, '#directPanel').hidden).toBe(false);
    expect(getEl<HTMLButtonElement>(dom.window.document, '#directCopyBtn').disabled).toBe(false);
  });

  it('shows a hint when page loads with #answer= hash', async () => {
    const dom = makeDirectDom('https://example.com/#answer=someencoded');

    initApp({
      document: dom.window.document,
      window: dom.window,
      navigator: makeNavigator(),
      transports: [],
    });
    await setTimeout(0);

    expect(getEl(dom.window.document, '#directStatus').textContent).toContain('Paste this link');
  });
});
