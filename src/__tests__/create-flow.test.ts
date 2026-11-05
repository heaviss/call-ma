import type { DOMWindow } from 'jsdom';
import type { Mock } from 'vitest';

import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it } from 'vitest';

import type { JoinRoomLike } from '../connection/trysteroAdapter.ts';
import type { FakeRoom } from './fakes/fakeRoom.ts';

import { initApp } from '../app/controller.ts';
import { clickAndSettle, setupCallPage } from './fakes/callPage.ts';
import { type FakeNavigator, fakeStream, getEl, makeNavigator } from './fakes/dom.ts';

describe('create conference flow (integration, jsdom)', () => {
  let window: DOMWindow;
  let document: Document;
  let navigatorLike: FakeNavigator;
  let fakeRoom: FakeRoom;
  let fakeJoinRoom: Mock<JoinRoomLike>;

  beforeEach(() => {
    ({
      window,
      document,
      navigator: navigatorLike,
      room: fakeRoom,
      joinRoom: fakeJoinRoom,
    } = setupCallPage());
  });

  it('clicking Create gets media, joins a room, and enables the copy button', async () => {
    // Arrange
    const controller = initApp({
      document,
      window,
      navigator: navigatorLike,
      joinRoom: fakeJoinRoom,
    });
    const copyBtn = getEl<HTMLButtonElement>(document, '#copyBtn');

    // Act
    await clickAndSettle(document, '#createBtn');

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
    await clickAndSettle(document, '#createBtn');

    // Assert
    expect(getEl<HTMLVideoElement>(document, '#localVideo').srcObject).toBe(localStream);
  });

  it('attaches remote stream to remoteVideo when a peer sends their stream', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await clickAndSettle(document, '#createBtn');

    // Act
    const remoteStream = fakeStream('remote-stream');
    fakeRoom.simulatePeerStream(remoteStream, 'peer-1');

    // Assert
    expect(getEl<HTMLVideoElement>(document, '#remoteVideo').srcObject).toBe(remoteStream);
  });

  it('logs "Peer joined" when a peer connects', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await clickAndSettle(document, '#createBtn');

    // Act
    fakeRoom.simulatePeerJoin('peer-1');

    // Assert
    expect(getEl(document, '#logs').textContent).toMatch(/peer joined/i);
  });

  it('room URL is shared with the same appId across calls', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });

    // Act
    await clickAndSettle(document, '#createBtn');

    // Assert — appId is consistent
    expect(fakeJoinRoom.mock.calls[0]?.[0]).toStrictEqual({ appId: 'call-ma' });
  });

  it('copies the link and logs confirmation when copy button is clicked after creating a room', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await clickAndSettle(document, '#createBtn');
    navigatorLike.clipboard.writeText.mockResolvedValue(undefined);

    // Act
    await clickAndSettle(document, '#copyBtn');

    // Assert
    expect(navigatorLike.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('#'));
    expect(getEl(document, '#logs').textContent).toMatch(/copied/i);
  });

  it('logs "Could not copy" when clipboard is unavailable after creating a room', async () => {
    // Arrange — navigator without clipboard
    const noClipboardNavigator = { mediaDevices: makeNavigator(fakeStream('stream')).mediaDevices };
    initApp({ document, window, navigator: noClipboardNavigator, joinRoom: fakeJoinRoom });
    await clickAndSettle(document, '#createBtn');

    // Act
    await clickAndSettle(document, '#copyBtn');

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
