import { setTimeout } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';

import { initApp } from '../app/controller.ts';
import { setupCallPage } from './fakes/callPage.ts';
import { fakeStream, getEl } from './fakes/dom.ts';

const SHARED_LINK = 'https://example.com/#abc12345';

describe('auto-join flow (Person B opens shared link)', () => {
  it('auto-joins the room from URL hash without clicking Create', async () => {
    // Arrange
    const { window, document, navigator, joinRoom } = setupCallPage(SHARED_LINK);

    // Act
    const controller = initApp({ document, window, navigator, joinRoom });
    await setTimeout(0);

    // Assert
    expect(joinRoom).toHaveBeenCalledWith({ appId: 'call-ma' }, 'abc12345', expect.any(Object));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
    expect(getEl<HTMLButtonElement>(document, '#copyBtn').disabled).toBe(false);
    expect(controller.state.link).toContain('#abc12345');
  });

  it('sets localVideo.srcObject on auto-join', async () => {
    // Arrange
    const { window, document, navigator, joinRoom } = setupCallPage(SHARED_LINK);
    const localStream = fakeStream('local-stream');
    navigator.mediaDevices.getUserMedia.mockResolvedValue(localStream);

    // Act
    initApp({ document, window, navigator, joinRoom });
    await setTimeout(0);

    // Assert
    expect(getEl<HTMLVideoElement>(document, '#localVideo').srcObject).toBe(localStream);
  });

  it('attaches remote stream to remoteVideo on auto-join', async () => {
    // Arrange
    const { window, document, navigator, joinRoom, room } = setupCallPage(SHARED_LINK);
    initApp({ document, window, navigator, joinRoom });
    await setTimeout(0);

    // Act
    const remoteStream = fakeStream('remote-stream');
    room.simulatePeerStream(remoteStream, 'peer-1');

    // Assert
    expect(getEl<HTMLVideoElement>(document, '#remoteVideo').srcObject).toBe(remoteStream);
  });

  it.each([
    [
      'the hash is an old v1 SDP blob, not an 8-char room ID',
      'https://example.com/#v1.someLongSdpBase64EncodedBlob',
    ],
    ['there is no hash', 'https://example.com/'],
  ])('does not auto-join when %s', async (_case, url) => {
    // Arrange
    const { window, document, navigator, joinRoom } = setupCallPage(url);

    // Act
    initApp({ document, window, navigator, joinRoom });
    await setTimeout(0);

    // Assert
    expect(joinRoom).not.toHaveBeenCalled();
  });
});
