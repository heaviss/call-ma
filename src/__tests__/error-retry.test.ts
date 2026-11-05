import type { DOMWindow } from 'jsdom';
import type { Mock } from 'vitest';

import { beforeEach, describe, expect, it } from 'vitest';

import type { JoinRoomLike } from '../connection/trysteroAdapter.ts';
import type { FakeNavigator } from './fakes/dom.ts';
import type { FakeRoom } from './fakes/fakeRoom.ts';

import { initApp } from '../app/controller.ts';
import { clickAndSettle, setupCallPage } from './fakes/callPage.ts';
import { getEl } from './fakes/dom.ts';

describe('error/connection events (integration, jsdom)', () => {
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

  it('logs an error message to #logs when a transport reports a join error', async () => {
    // Arrange
    fakeJoinRoom.mockImplementation((_config, _roomId, callbacks) => {
      callbacks?.onJoinError?.({
        error: 'relay unreachable',
        appId: 'call-ma',
        roomId: 'room',
        peerId: 'self',
      });
      return fakeRoom;
    });
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });

    // Act
    await clickAndSettle(document, '#createBtn');

    // Assert
    expect(getEl(document, '#logs').textContent).toMatch(/connection error/i);
  });

  it('logs "Peer left" when a peer leaves', async () => {
    // Arrange
    initApp({ document, window, navigator: navigatorLike, joinRoom: fakeJoinRoom });
    await clickAndSettle(document, '#createBtn');

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
    const { onCreate } = initApp({
      document,
      window,
      navigator: navigatorLike,
      joinRoom: fakeJoinRoom,
    });

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
    await clickAndSettle(document, '#copyBtn');

    // Assert — clipboard was not touched (state.link guard skipped the copy)
    expect(navigatorLike.clipboard.writeText).not.toHaveBeenCalled();
  });
});
