import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.js';
import { CODEC_VERSION, encodeSignal } from '../shared/codec.js';

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

function setupDomWithOffer(encodedOffer) {
  const html = `<!doctype html><html><body>
  <button id="createBtn">Create Conference</button>
  <button id="copyBtn" disabled>Copy Link</button>
  <video id="localVideo"></video>
  <video id="remoteVideo"></video>
  </body></html>`;
  const dom = new JSDOM(html, { url: 'https://example.com/#' + encodedOffer });
  return dom;
}

describe('answerer flow (integration, jsdom)', () => {
  let dom;
  let window;
  let document;
  let navigatorLike;
  let media;
  let PeerCtor;

  beforeEach(() => {
    // fresh per-test
    media = { getUserMedia: vi.fn().mockResolvedValue({ id: 'local-stream' }) };
    navigatorLike = { mediaDevices: media, clipboard: { writeText: vi.fn() } };
    PeerCtor = vi.fn().mockImplementation((opts) => new FakePeer(opts));
  });

  it('on load with offer in URL: gets media, creates responder, signals offer, and produces answer link on first signal', async () => {
    // Arrange
    const offerPayload = { v: CODEC_VERSION, role: 'offer', sp: { type: 'offer', sdp: 'v=0' } };
    const encoded = encodeSignal(offerPayload);
    dom = setupDomWithOffer(encoded);
    window = dom.window;
    document = dom.window.document;

    // Act
    const controller = initApp({ document, window, navigator: navigatorLike, PeerCtor });

    // Allow any pending microtasks (e.g., getUserMedia promise resolution)
    // flush all pending microtasks (async chain through getMedia needs >1 tick)
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The responder peer should have been created and signaled with the offer
    const peer = PeerCtor.mock.results[0].value;
    expect(peer).toBeTruthy();
    expect(peer.opts.initiator).toBe(false);

    // Adapter will emit its first 'signal' with an answer; simulate it
    const answerSp = { type: 'answer', sdp: 'v=0' };
    peer.emit('signal', answerSp);

    // Assert
    expect(media.getUserMedia).toHaveBeenCalled();
    expect(controller.state.role).toBe('answer');

    const copyBtn = document.getElementById('copyBtn');
    expect(copyBtn.disabled).toBe(false);
    expect(controller.state.link).toBeTruthy();
    expect(controller.state.link).toContain('#' + CODEC_VERSION + '.');
  });

  it('attaches remote stream to #remoteVideo when received', async () => {
    // Arrange
    const offerPayload = { v: CODEC_VERSION, role: 'offer', sp: { type: 'offer', sdp: 'v=0' } };
    const encoded = encodeSignal(offerPayload);
    dom = setupDomWithOffer(encoded);
    window = dom.window;
    document = dom.window.document;

    // Act
    initApp({ document, window, navigator: navigatorLike, PeerCtor });
    // flush all pending microtasks (async chain through getMedia needs >1 tick)
    await new Promise((resolve) => setTimeout(resolve, 0));

    const peer = PeerCtor.mock.results[0].value;

    const remoteStream = { id: 'remote-stream' };
    peer.emit('stream', remoteStream);

    // Assert
    const remoteVideo = document.getElementById('remoteVideo');
    expect(remoteVideo.srcObject).toBe(remoteStream);
  });
});
