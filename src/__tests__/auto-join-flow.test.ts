import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initApp } from '../app/controller.ts';
import type { Mock } from 'vitest';
import type { JoinRoomLike } from '../connection/trysteroAdapter.ts';
import { FakeRoom } from './fakes/fakeRoom.ts';
import { fakeStream, getEl, makeNavigator, type FakeNavigator } from './fakes/dom.ts';


function setupDomWithRoomId() {
  const html = `<!doctype html><html><body>
  <button id="createBtn">Create Conference</button>
  <button id="copyBtn" disabled>Copy Link</button>
  <video id="localVideo"></video>
  <video id="remoteVideo"></video>
  <div id="logs"></div>
  </body></html>`;
  return new JSDOM(html, { url: 'https://example.com/#abc12345' });
}

describe('auto-join flow (Person B opens shared link)', () => {
  let fakeRoom: FakeRoom;
  let fakeJoinRoom: Mock<JoinRoomLike>;
  let navigatorLike: FakeNavigator;

  beforeEach(() => {
    fakeRoom = new FakeRoom();
    fakeJoinRoom = vi.fn<JoinRoomLike>().mockReturnValue(fakeRoom);
    navigatorLike = makeNavigator();
  });

  it('auto-joins the room from URL hash without clicking Create', async () => {
    // Arrange
    const dom = setupDomWithRoomId();

    // Act
    const controller = initApp({
      document: dom.window.document,
      window: dom.window,
      navigator: navigatorLike,
      joinRoom: fakeJoinRoom,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(fakeJoinRoom).toHaveBeenCalledWith({ appId: 'call-ma' }, 'abc12345', expect.any(Object));
    expect(navigatorLike.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(getEl<HTMLButtonElement>(dom.window.document, '#copyBtn').disabled).toBe(false);
    expect(controller.state.link).toContain('#abc12345');
  });

  it('sets localVideo.srcObject on auto-join', async () => {
    // Arrange
    const localStream = fakeStream('local-stream');
    navigatorLike.mediaDevices.getUserMedia.mockResolvedValue(localStream);
    const dom = setupDomWithRoomId();

    // Act
    initApp({ document: dom.window.document, window: dom.window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(getEl<HTMLVideoElement>(dom.window.document, '#localVideo').srcObject).toBe(localStream);
  });

  it('attaches remote stream to remoteVideo on auto-join', async () => {
    // Arrange
    const dom = setupDomWithRoomId();
    initApp({ document: dom.window.document, window: dom.window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Act
    const remoteStream = fakeStream('remote-stream');
    fakeRoom.simulatePeerStream(remoteStream, 'peer-1');

    // Assert
    expect(getEl<HTMLVideoElement>(dom.window.document, '#remoteVideo').srcObject).toBe(remoteStream);
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
