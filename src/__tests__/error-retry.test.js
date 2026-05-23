import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.js';

class FakeRoom {
  constructor() {}
  addStream()      {}
  onPeerJoin(cb)   { this._onPeerJoinCb = cb; }
  onPeerLeave(cb)  { this._onPeerLeaveCb = cb; }
  onPeerStream(cb) { this._onPeerStreamCb = cb; }
  leave()          {}

  simulatePeerLeave(peerId) { this._onPeerLeaveCb?.(peerId); }
  _onPeerJoinCb = null;
  _onPeerLeaveCb = null;
  _onPeerStreamCb = null;
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
    document.querySelector('#createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(document.querySelector('#logs').textContent).toMatch(/connection error/i);
  });

  it('logs "Peer left" when a peer leaves', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    document.querySelector('#createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Act
    fakeRoom.simulatePeerLeave('peer-1');

    // Assert
    expect(document.querySelector('#logs').textContent).toMatch(/peer left/i);
  });

  it('logs support warning to #logs on init when not secure context', () => {
    // Arrange
    window.isSecureContext = false;

    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });

    expect(document.querySelector('#logs').textContent).toMatch(/https/i);
  });

  it('logs a media error when getUserMedia rejects', async () => {
    // Arrange
    const permissionError = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    navigatorLike.mediaDevices.getUserMedia.mockRejectedValue(permissionError);
    const { onCreate } = initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });

    // Act — call onCreate directly so we can catch the rethrown error
    await expect(onCreate()).rejects.toThrow('denied');

    // Assert
    expect(document.querySelector('#logs').textContent).toMatch(/permission denied/i);
  });

  it('rejects onCreate when mediaDevices is not available', async () => {
    // Arrange — navigator without mediaDevices
    const { onCreate } = initApp({
      document,
      window,
      navigator: {},
      joinRoom: fakeJoinRoom,
    });

    // Act + Assert — getMedia returns a rejected promise (not caught internally)
    await expect(onCreate()).rejects.toThrow('mediaDevices not available');
  });

  it('does nothing when copy button is clicked before a room is created', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    // Enable the button so the click event fires (state.link is still null)
    document.querySelector('#copyBtn').disabled = false;

    // Act — click copy before onCreate has set state.link
    document.querySelector('#copyBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert — clipboard was not touched (state.link guard skipped the copy)
    expect(navigatorLike.clipboard.writeText).not.toHaveBeenCalled();
  });
});
