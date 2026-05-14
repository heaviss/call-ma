import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.js';

class FakeRoom {
  constructor() {
    this._addStreamCalls = [];
    this._onPeerJoinCb = null;
    this._onPeerLeaveCb = null;
    this._onPeerStreamCb = null;
  }
  addStream(stream, peerId)  { this._addStreamCalls.push({ stream, peerId }); }
  onPeerJoin(cb)             { this._onPeerJoinCb = cb; }
  onPeerLeave(cb)            { this._onPeerLeaveCb = cb; }
  onPeerStream(cb)           { this._onPeerStreamCb = cb; }
  leave()                    {}

  simulatePeerJoin(peerId)           { this._onPeerJoinCb?.(peerId); }
  simulatePeerStream(stream, peerId) { this._onPeerStreamCb?.(stream, peerId); }
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

describe('create conference flow (integration, jsdom)', () => {
  let dom, window, document, navigatorLike, fakeRoom, fakeJoinRoom;

  beforeEach(() => {
    dom = setupDom();
    window = dom.window;
    document = dom.window.document;
    fakeRoom = new FakeRoom();
    fakeJoinRoom = vi.fn().mockReturnValue(fakeRoom);
    navigatorLike = {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ id: 'local-stream' }) },
      clipboard: { writeText: vi.fn() },
    };
  });

  it('clicking Create gets media, joins a room, and enables the copy button', async () => {
    // Arrange
    const controller = initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    const createBtn = document.querySelector('#createBtn');
    const copyBtn = document.querySelector('#copyBtn');

    // Act
    createBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(navigatorLike.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(fakeJoinRoom).toHaveBeenCalledWith({ appId: 'call-ma' }, expect.stringMatching(/^[a-z0-9]{8}$/));
    expect(copyBtn.disabled).toBe(false);
    expect(controller.state.link).toMatch(/#[a-z0-9]{8}$/);
  });

  it('sets localVideo.srcObject to the media stream', async () => {
    // Arrange
    const localStream = { id: 'local-stream' };
    navigatorLike.mediaDevices.getUserMedia.mockResolvedValue(localStream);
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });

    // Act
    document.querySelector('#createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(document.querySelector('#localVideo').srcObject).toBe(localStream);
  });

  it('attaches remote stream to remoteVideo when a peer sends their stream', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    document.querySelector('#createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Act
    const remoteStream = { id: 'remote-stream' };
    fakeRoom.simulatePeerStream(remoteStream, 'peer-1');

    // Assert
    expect(document.querySelector('#remoteVideo').srcObject).toBe(remoteStream);
  });

  it('logs "Peer joined" when a peer connects', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    document.querySelector('#createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Act
    fakeRoom.simulatePeerJoin('peer-1');

    // Assert
    expect(document.querySelector('#logs').textContent).toMatch(/peer joined/i);
  });

  it('room URL is shared with the same appId across calls', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    document.querySelector('#createBtn').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert — appId is consistent
    expect(fakeJoinRoom.mock.calls[0][0]).toEqual({ appId: 'call-ma' });
  });
});
