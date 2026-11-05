import type { DOMWindow } from 'jsdom';
import type { Mock } from 'vitest';

import { JSDOM } from 'jsdom';
import { setTimeout } from 'node:timers/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JoinRoomLike } from '../connection/trysteroAdapter.ts';

import { initApp } from '../app/controller.ts';
import { type FakeNavigator, fakeStream, getEl, makeNavigator } from './fakes/dom.ts';
import { FakeRoom } from './fakes/fakeRoom.ts';

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
  let dom: JSDOM;
  let window: DOMWindow;
  let document: Document;
  let navigatorLike: FakeNavigator;
  let fakeRoom: FakeRoom;
  let fakeJoinRoom: Mock<JoinRoomLike>;

  beforeEach(() => {
    dom = setupDom();
    window = dom.window;
    document = dom.window.document;
    fakeRoom = new FakeRoom();
    fakeJoinRoom = vi.fn<JoinRoomLike>().mockReturnValue(fakeRoom);
    navigatorLike = makeNavigator();
  });

  it('clicking Create gets media, joins a room, and enables the copy button', async () => {
    // Arrange
    const controller = initApp({
      document,
      window,
      navigator: navigatorLike,
      joinRoom: fakeJoinRoom,
    });
    const createBtn = getEl<HTMLButtonElement>(document, '#createBtn');
    const copyBtn = getEl<HTMLButtonElement>(document, '#copyBtn');

    // Act
    createBtn.click();
    await setTimeout(0);

    // Assert
    expect(navigatorLike.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: true,
    });
    expect(fakeJoinRoom).toHaveBeenCalledWith(
      { appId: 'call-ma' },
      expect.stringMatching(/^[a-z0-9]{8}$/),
      expect.any(Object),
    );
    expect(copyBtn.disabled).toBe(false);
    expect(controller.state.link).toMatch(/#[a-z0-9]{8}$/);
  });

  it('sets localVideo.srcObject to the media stream', async () => {
    // Arrange
    const localStream = fakeStream('local-stream');
    navigatorLike.mediaDevices.getUserMedia.mockResolvedValue(localStream);
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });

    // Act
    getEl<HTMLButtonElement>(document, '#createBtn').click();
    await setTimeout(0);

    // Assert
    expect(getEl<HTMLVideoElement>(document, '#localVideo').srcObject).toBe(localStream);
  });

  it('attaches remote stream to remoteVideo when a peer sends their stream', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    getEl<HTMLButtonElement>(document, '#createBtn').click();
    await setTimeout(0);

    // Act
    const remoteStream = fakeStream('remote-stream');
    fakeRoom.simulatePeerStream(remoteStream, 'peer-1');

    // Assert
    expect(getEl<HTMLVideoElement>(document, '#remoteVideo').srcObject).toBe(remoteStream);
  });

  it('logs "Peer joined" when a peer connects', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    getEl<HTMLButtonElement>(document, '#createBtn').click();
    await setTimeout(0);

    // Act
    fakeRoom.simulatePeerJoin('peer-1');

    // Assert
    expect(getEl(document, '#logs').textContent).toMatch(/peer joined/i);
  });

  it('room URL is shared with the same appId across calls', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    getEl<HTMLButtonElement>(document, '#createBtn').click();
    await setTimeout(0);

    // Assert — appId is consistent
    expect(fakeJoinRoom.mock.calls[0]?.[0]).toStrictEqual({ appId: 'call-ma' });
  });

  it('copies the link and logs confirmation when copy button is clicked after creating a room', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    getEl<HTMLButtonElement>(document, '#createBtn').click();
    await setTimeout(0);

    // Act
    navigatorLike.clipboard.writeText.mockResolvedValue(undefined);
    getEl<HTMLButtonElement>(document, '#copyBtn').click();
    await setTimeout(0);

    // Assert
    expect(navigatorLike.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('#'));
    expect(getEl(document, '#logs').textContent).toMatch(/copied/i);
  });

  it('logs "Could not copy" when clipboard is unavailable after creating a room', async () => {
    // Arrange — navigator without clipboard
    const noClipboardNavigator = { mediaDevices: makeNavigator(fakeStream('stream')).mediaDevices };
    initApp({ document, window, navigator: noClipboardNavigator, joinRoom: fakeJoinRoom });
    getEl<HTMLButtonElement>(document, '#createBtn').click();
    await setTimeout(0);

    // Act
    getEl<HTMLButtonElement>(document, '#copyBtn').click();
    await setTimeout(0);

    // Assert
    expect(getEl(document, '#logs').textContent).toMatch(/could not copy/i);
  });

  it('shows the logs section when ?debug=true is in the URL', () => {
    // Arrange — DOM with #logsSection and debug URL
    const html = `<!doctype html><html><body>
    <button id="createBtn"></button>
    <div id="logsSection" hidden><div id="logs"></div></div>
    </body></html>`;
    const debugDom = new JSDOM(html, { url: 'https://example.com/?debug=true' });

    // Act
    initApp({
      document: debugDom.window.document,
      window: debugDom.window,
      navigator: navigatorLike,
      joinRoom: fakeJoinRoom,
    });

    // Assert
    expect(getEl(debugDom.window.document, '#logsSection').hidden).toBe(false);
  });
});
