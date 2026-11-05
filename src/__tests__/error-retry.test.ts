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

describe('error/connection events (integration, jsdom)', () => {
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
    navigatorLike = makeNavigator(fakeStream('stream'));
  });

  it('logs an error message to #logs when a transport reports a join error', async () => {
    // Arrange
    fakeJoinRoom.mockImplementation((_config, _roomId, callbacks) => {
      callbacks?.onJoinError?.({ error: 'relay unreachable', appId: 'call-ma', roomId: 'room', peerId: 'self' });
      return fakeRoom;
    });
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    getEl<HTMLButtonElement>(document, '#createBtn').click();
    await setTimeout(0);

    // Assert
    expect(getEl(document, '#logs').textContent).toMatch(/connection error/i);
  });

  it('logs "Peer left" when a peer leaves', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    getEl<HTMLButtonElement>(document, '#createBtn').click();
    await setTimeout(0);

    // Act
    fakeRoom.simulatePeerLeave('peer-1');

    // Assert
    expect(getEl(document, '#logs').textContent).toMatch(/peer left/i);
  });

  it('logs support warning to #logs on init when not secure context', () => {
    // Arrange
    (window as { isSecureContext: boolean }).isSecureContext = false;

    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });

    expect(getEl(document, '#logs').textContent).toMatch(/https/i);
  });

  it('logs a media error when getUserMedia rejects', async () => {
    // Arrange
    const permissionError = new DOMException('denied', 'NotAllowedError');
    navigatorLike.mediaDevices.getUserMedia.mockRejectedValue(permissionError);
    const { onCreate } = initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });

    // Act — call onCreate directly so we can catch the rethrown error
    await expect(onCreate()).rejects.toThrow('denied');

    // Assert
    expect(getEl(document, '#logs').textContent).toMatch(/permission denied/i);
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
    getEl<HTMLButtonElement>(document, '#copyBtn').disabled = false;

    // Act — click copy before onCreate has set state.link
    getEl<HTMLButtonElement>(document, '#copyBtn').click();
    await setTimeout(0);

    // Assert — clipboard was not touched (state.link guard skipped the copy)
    expect(navigatorLike.clipboard.writeText).not.toHaveBeenCalled();
  });
});
