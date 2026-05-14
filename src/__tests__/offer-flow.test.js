import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.js';
import { CODEC_VERSION } from '../shared/codec.js';

class FakePeer {
  constructor(opts) {
    this.opts = opts;
    this._handlers = {};
  }
  on(evt, cb) {
    this._handlers[evt] = this._handlers[evt] || [];
    this._handlers[evt].push(cb);
    return this;
  }
  emit(evt, ...args) {
    (this._handlers[evt] || []).forEach((cb) => cb(...args));
  }
}

function setupDom() {
  const html = `<!doctype html><html><body>
  <button id="createBtn">Create Conference</button>
  <button id="copyBtn" disabled>Copy Link</button>
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
});
