import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.js';
import { CODEC_VERSION, encodeSignal } from '../shared/codec.js';
import { buildSignalUrl } from '../shared/link.js';

class FakePeer {
  constructor(opts) {
    this.opts = opts;
    this._handlers = {};
    this.signalCalls = [];
  }
  on(evt, cb) {
    this._handlers[evt] = this._handlers[evt] || [];
    this._handlers[evt].push(cb);
    return this;
  }
  emit(evt, ...args) {
    (this._handlers[evt] || []).forEach((cb) => cb(...args));
  }
  signal(data) {
    this.signalCalls.push(data);
  }
}

function setupDom() {
  const html = `<!doctype html><html><body>
  <button id="createBtn">Create Conference</button>
  <button id="copyBtn" disabled>Copy Link</button>
  <textarea id="inviteInput"></textarea>
  <video id="localVideo"></video>
  <video id="remoteVideo"></video>
  </body></html>`;
  const dom = new JSDOM(html, { url: 'https://example.com/' });
  return dom;
}

describe('offerer flow (integration, jsdom)', () => {
  let dom;
  let window;
  let document;
  let navigatorLike;
  let media;
  let PeerCtor;

  beforeEach(() => {
    dom = setupDom();
    window = dom.window;
    document = dom.window.document;

    media = { getUserMedia: vi.fn().mockResolvedValue({ id: 'stream' }) };
    navigatorLike = { mediaDevices: media, clipboard: { writeText: vi.fn() } };
    PeerCtor = vi.fn().mockImplementation((opts) => new FakePeer(opts));
  });

  it('clicking Create gets media, sets up initiator, and updates URL hash on first signal', async () => {
    // Arrange
    const controller = initApp({ document, window, navigator: navigatorLike, PeerCtor });
    const createBtn = document.getElementById('createBtn');
    const copyBtn = document.getElementById('copyBtn');

    // Act
    createBtn.click();

    // flush all pending microtasks (async chain through getMedia needs >1 tick)
    await new Promise((resolve) => setTimeout(resolve, 0));

    // After peer created, emit a single signal blob
    const peer = PeerCtor.mock.results[0].value; // instance returned
    const sp = { type: 'offer', sdp: 'v=0' };
    peer.emit('signal', sp);

    // Assert
    expect(media.getUserMedia).toHaveBeenCalled();
    expect(window.location.hash.startsWith('#' + CODEC_VERSION + '.')).toBe(true);
    expect(copyBtn.disabled).toBe(false);
    expect(controller.state.role).toBe('offer');
  });

  it('pasting an answer URL into inviteInput feeds the answer SDP to the peer', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, PeerCtor });
    const createBtn = document.getElementById('createBtn');
    const inviteInput = document.getElementById('inviteInput');

    createBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const peer = PeerCtor.mock.results[0].value;
    peer.emit('signal', { type: 'offer', sdp: 'v=0' });

    // Act — simulate offerer pasting the answer URL back
    const answerSp = { type: 'answer', sdp: 'v=answer' };
    const encoded = encodeSignal({ v: CODEC_VERSION, role: 'answer', sp: answerSp });
    const answerUrl = buildSignalUrl(window.location, encoded);

    inviteInput.value = answerUrl;
    inviteInput.dispatchEvent(new window.Event('input'));

    // Assert
    expect(peer.signalCalls).toHaveLength(1);
    expect(peer.signalCalls[0]).toEqual(answerSp);
  });
});
