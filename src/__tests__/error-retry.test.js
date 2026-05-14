import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.js';

class FakeRoom {
  constructor() {
    this._onPeerJoinCb = null;
    this._onPeerLeaveCb = null;
    this._onPeerStreamCb = null;
  }
  addStream()      {}
  onPeerJoin(cb)   { this._onPeerJoinCb = cb; }
  onPeerLeave(cb)  { this._onPeerLeaveCb = cb; }
  onPeerStream(cb) { this._onPeerStreamCb = cb; }
  leave()          {}

  simulatePeerLeave(peerId) { this._onPeerLeaveCb?.(peerId); }
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

describe('error/connection events (integration, jsdom)', () => {
  let dom, window, document, navigatorLike, fakeRoom, fakeJoinRoom;

  beforeEach(() => {
    dom = setupDom();
    window = dom.window;
    document = dom.window.document;
    fakeRoom = new FakeRoom();
    fakeJoinRoom = vi.fn().mockReturnValue(fakeRoom);
    navigatorLike = {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ id: 'stream' }) },
      clipboard: { writeText: vi.fn() },
    };
  });

  it('logs an error message to #logs when joinRoom throws', async () => {
    // Arrange
    fakeJoinRoom.mockImplementation(() => { throw new Error('relay unreachable'); });
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    document.getElementById('createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(document.getElementById('logs').textContent).toMatch(/connection error/i);
  });

  it('logs "Peer left" when a peer leaves', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    document.getElementById('createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Act
    fakeRoom.simulatePeerLeave('peer-1');

    // Assert
    expect(document.getElementById('logs').textContent).toMatch(/peer left/i);
  });

  it('logs support warning to #logs on init when not secure context', () => {
    // Arrange
    window.isSecureContext = false;

    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });

    expect(document.getElementById('logs').textContent).toMatch(/https/i);
  });
});
