import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.js';

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
  signal() {}
  destroy() {}
}

function setupDom() {
  const html = `<!doctype html><html><body>
  <button id="createBtn">Create Conference</button>
  <button id="copyBtn" disabled>Copy Link</button>
  <video id="localVideo"></video>
  <video id="remoteVideo"></video>
  <div id="logs"></div>
  </body></html>`;
  return new JSDOM(html, { url: 'https://example.com/' });
}

describe('error/close events (integration, jsdom)', () => {
  let dom, window, document, navigatorLike, PeerCtor;

  beforeEach(() => {
    dom = setupDom();
    window = dom.window;
    document = dom.window.document;
    navigatorLike = {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ id: 'stream' }) },
      clipboard: { writeText: vi.fn() },
    };
    PeerCtor = vi.fn().mockImplementation((opts) => new FakePeer(opts));
  });

  it('logs an error message to #logs when peer emits error', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, PeerCtor });
    document.getElementById('createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const peer = PeerCtor.mock.results[0].value;

    // Act
    peer.emit('error', new Error('ICE failed'));

    // Assert
    expect(document.getElementById('logs').textContent).toMatch(/connection error/i);
  });

  it('logs a close message to #logs when peer emits close', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, PeerCtor });
    document.getElementById('createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const peer = PeerCtor.mock.results[0].value;

    // Act
    peer.emit('close');

    // Assert
    expect(document.getElementById('logs').textContent).toMatch(/connection closed/i);
  });

  it('logs support warning to #logs on init when not secure context', () => {
    // Arrange
    window.isSecureContext = false;

    initApp({ document, window, navigator: navigatorLike, PeerCtor });

    expect(document.getElementById('logs').textContent).toMatch(/https/i);
  });
});
