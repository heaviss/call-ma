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

  simulatePeerStream(stream, peerId) { this._onPeerStreamCb?.(stream, peerId); }
}

function setupDomWithRoomId(roomId) {
  const html = `<!doctype html><html><body>
  <button id="createBtn">Create Conference</button>
  <button id="copyBtn" disabled>Copy Link</button>
  <video id="localVideo"></video>
  <video id="remoteVideo"></video>
  <div id="logs"></div>
  </body></html>`;
  return new JSDOM(html, { url: `https://example.com/#${roomId}` });
}

describe('auto-join flow (Person B opens shared link)', () => {
  let fakeRoom, fakeJoinRoom, navigatorLike;

  beforeEach(() => {
    fakeRoom = new FakeRoom();
    fakeJoinRoom = vi.fn().mockReturnValue(fakeRoom);
    navigatorLike = {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ id: 'local-stream' }) },
      clipboard: { writeText: vi.fn() },
    };
  });

  it('auto-joins the room from URL hash without clicking Create', async () => {
    // Arrange
    const dom = setupDomWithRoomId('abc12345');

    // Act
    const controller = initApp({
      document: dom.window.document,
      window: dom.window,
      navigator: navigatorLike,
      joinRoom: fakeJoinRoom,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(fakeJoinRoom).toHaveBeenCalledWith({ appId: 'call-ma' }, 'abc12345');
    expect(navigatorLike.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(dom.window.document.getElementById('copyBtn').disabled).toBe(false);
    expect(controller.state.link).toContain('#abc12345');
  });

  it('sets localVideo.srcObject on auto-join', async () => {
    // Arrange
    const localStream = { id: 'local-stream' };
    navigatorLike.mediaDevices.getUserMedia.mockResolvedValue(localStream);
    const dom = setupDomWithRoomId('abc12345');

    // Act
    initApp({ document: dom.window.document, window: dom.window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(dom.window.document.getElementById('localVideo').srcObject).toBe(localStream);
  });

  it('attaches remote stream to remoteVideo on auto-join', async () => {
    // Arrange
    const dom = setupDomWithRoomId('abc12345');
    initApp({ document: dom.window.document, window: dom.window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Act
    const remoteStream = { id: 'remote-stream' };
    fakeRoom.simulatePeerStream(remoteStream, 'peer-1');

    // Assert
    expect(dom.window.document.getElementById('remoteVideo').srcObject).toBe(remoteStream);
  });

  it('does not auto-join when URL hash is not an 8-char room ID', async () => {
    // Arrange — old v1.xxx SDP hash should not trigger auto-join
    const dom = new JSDOM('<!doctype html><html><body><button id="createBtn"></button></body></html>', {
      url: 'https://example.com/#v1.someLongSdpBase64EncodedBlob',
    });

    initApp({ document: dom.window.document, window: dom.window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fakeJoinRoom).not.toHaveBeenCalled();
  });

  it('does not auto-join when there is no hash', async () => {
    // Arrange
    const dom = new JSDOM('<!doctype html><html><body><button id="createBtn"></button></body></html>', {
      url: 'https://example.com/',
    });

    initApp({ document: dom.window.document, window: dom.window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fakeJoinRoom).not.toHaveBeenCalled();
  });
});
