import type { Mock } from 'vitest';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JoinRoomLike } from '../connection/trysteroAdapter.ts';

import { TrysteroAdapter } from '../connection/trysteroAdapter.ts';
import { fakeStream } from './fakes/dom.ts';
import { FakeRoom } from './fakes/fakeRoom.ts';


describe('TrysteroAdapter', () => {
  let fakeRoom: FakeRoom;
  let fakeJoinRoom: Mock<JoinRoomLike>;
  let adapter: TrysteroAdapter;
  const localStream = fakeStream('local');

  beforeEach(() => {
    fakeRoom = new FakeRoom();
    fakeJoinRoom = vi.fn<JoinRoomLike>().mockReturnValue(fakeRoom);
    adapter = new TrysteroAdapter({ joinRoom: fakeJoinRoom });
  });

  it('calls joinRoom with appId and roomId on join()', () => {
    adapter.join('abc12345', localStream);

    expect(fakeJoinRoom).toHaveBeenCalledWith({ appId: 'call-ma' }, 'abc12345', expect.any(Object));
  });

  it('sends local stream to a specific peer when they join', () => {
    adapter.join('abc12345', localStream);
    fakeRoom.simulatePeerJoin('peer-1');

    expect(fakeRoom.addStreamCalls.some((c) => c.stream === localStream && c.target === 'peer-1')).toBe(true);
  });

  it('fires onConnect when a peer joins', () => {
    const onConnect = vi.fn<Parameters<TrysteroAdapter['onConnect']>[0]>();
    adapter.onConnect(onConnect).join('abc12345', localStream);
    fakeRoom.simulatePeerJoin('peer-1');

    expect(onConnect).toHaveBeenCalledWith('peer-1');
  });

  it('does not fire onConnect when the peer stream arrived before the join event', () => {
    // Arrange — stream arrives first, adding peer to connectedPeers
    const onConnect = vi.fn<Parameters<TrysteroAdapter['onConnect']>[0]>();
    adapter.onConnect(onConnect).join('abc12345', localStream);
    fakeRoom.simulatePeerStream(fakeStream('remote'), 'peer-1');

    // Act — join event fires after stream
    fakeRoom.simulatePeerJoin('peer-1');

    // Assert — onConnect is suppressed since peer already counted
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('fires onStream when a peer sends their stream', () => {
    const onStream = vi.fn<Parameters<TrysteroAdapter['onStream']>[0]>();
    const remoteStream = fakeStream('remote');
    adapter.onStream(onStream).join('abc12345', localStream);
    fakeRoom.simulatePeerStream(remoteStream, 'peer-1');

    expect(onStream).toHaveBeenCalledWith(remoteStream, 'peer-1');
  });

  it('fires onPeerLeave when a peer leaves', () => {
    const onPeerLeave = vi.fn<Parameters<TrysteroAdapter['onPeerLeave']>[0]>();
    adapter.onPeerLeave(onPeerLeave).join('abc12345', localStream);
    fakeRoom.simulatePeerLeave('peer-1');

    expect(onPeerLeave).toHaveBeenCalledWith('peer-1');
  });

  it('calls room.leave() on destroy()', () => {
    adapter.join('abc12345', localStream);
    adapter.destroy();

    expect(fakeRoom.left).toBe(true);
  });

  it('reports transport join errors through onError', () => {
    const onError = vi.fn<Parameters<TrysteroAdapter['onError']>[0]>();
    adapter.onError(onError).join('abc12345', localStream);
    const callbacks = fakeJoinRoom.mock.calls[0]?.[2];

    callbacks?.onJoinError?.({ error: 'configure TURN servers', appId: 'call-ma', roomId: 'abc12345', peerId: 'self' });

    expect(onError).toHaveBeenCalledWith(new Error('configure TURN servers'));
  });

  it('lets programmer errors from joinRoom propagate instead of hiding them in onError', () => {
    const onError = vi.fn<Parameters<TrysteroAdapter['onError']>[0]>();
    fakeJoinRoom.mockImplementation(() => { throw new TypeError('bad config'); });

    expect(() => adapter.onError(onError).join('abc12345', localStream)).toThrow('bad config');
    expect(onError).not.toHaveBeenCalled();
  });

  it('returns the adapter for chaining from join()', () => {
    const result = adapter.join('abc12345', localStream);

    expect(result).toBe(adapter);
  });

  describe('multi-transport', () => {
    it('calls all joinRoom functions on join()', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn<JoinRoomLike>().mockReturnValue(fakeRoom2);
      const multiAdapter = new TrysteroAdapter({
        transports: [
          { joinRoom: fakeJoinRoom },
          { joinRoom: fakeJoinRoom2 },
        ],
      });

      multiAdapter.join('abc12345', localStream);

      expect(fakeJoinRoom).toHaveBeenCalledWith({ appId: 'call-ma' }, 'abc12345', expect.any(Object));
      expect(fakeJoinRoom2).toHaveBeenCalledWith({ appId: 'call-ma' }, 'abc12345', expect.any(Object));
    });

    it('passes relayConfig per transport and the same ICE servers to every transport', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn<JoinRoomLike>().mockReturnValue(fakeRoom2);
      const multiAdapter = new TrysteroAdapter({
        transports: [
          { joinRoom: fakeJoinRoom,  relayUrls: ['wss://mqtt.example.com'] },
          { joinRoom: fakeJoinRoom2, relayUrls: ['wss://tracker.example.com'] },
        ],
        iceServers: [{ urls: 'turn:turn.example.com', username: 'u', credential: 'p' }],
      });

      multiAdapter.join('abc12345', localStream);

      expect(fakeJoinRoom).toHaveBeenCalledWith({
        appId: 'call-ma',
        relayConfig: { urls: ['wss://mqtt.example.com'] },
        rtcConfig: { iceServers: [{ urls: 'turn:turn.example.com', username: 'u', credential: 'p' }] },
      }, 'abc12345', expect.any(Object));
      expect(fakeJoinRoom2).toHaveBeenCalledWith({
        appId: 'call-ma',
        relayConfig: { urls: ['wss://tracker.example.com'] },
        rtcConfig: { iceServers: [{ urls: 'turn:turn.example.com', username: 'u', credential: 'p' }] },
      }, 'abc12345', expect.any(Object));
    });

    it('fires onStream only once when same peer connects via both transports', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn<JoinRoomLike>().mockReturnValue(fakeRoom2);
      const multiAdapter = new TrysteroAdapter({
        transports: [{ joinRoom: fakeJoinRoom }, { joinRoom: fakeJoinRoom2 }],
      });
      const onStream = vi.fn<Parameters<TrysteroAdapter['onStream']>[0]>();
      const remoteStream1 = fakeStream('remote-mqtt');
      const remoteStream2 = fakeStream('remote-torrent');

      multiAdapter.onStream(onStream).join('abc12345', localStream);
      fakeRoom.simulatePeerStream(remoteStream1, 'peer-1');
      fakeRoom2.simulatePeerStream(remoteStream2, 'peer-1');

      expect(onStream).toHaveBeenCalledTimes(1);
      expect(onStream).toHaveBeenCalledWith(remoteStream1, 'peer-1');
    });

    it('allows a new stream after peer leaves and rejoins', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn<JoinRoomLike>().mockReturnValue(fakeRoom2);
      const multiAdapter = new TrysteroAdapter({
        transports: [{ joinRoom: fakeJoinRoom }, { joinRoom: fakeJoinRoom2 }],
      });
      const onStream = vi.fn<Parameters<TrysteroAdapter['onStream']>[0]>();
      const remoteStream = fakeStream('remote');

      multiAdapter.onStream(onStream).join('abc12345', localStream);
      fakeRoom.simulatePeerStream(remoteStream, 'peer-1');
      fakeRoom.simulatePeerLeave('peer-1');
      fakeRoom2.simulatePeerStream(remoteStream, 'peer-1');

      expect(onStream).toHaveBeenCalledTimes(2);
    });

    it('leaves all rooms on destroy()', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn<JoinRoomLike>().mockReturnValue(fakeRoom2);
      const multiAdapter = new TrysteroAdapter({
        transports: [{ joinRoom: fakeJoinRoom }, { joinRoom: fakeJoinRoom2 }],
      });

      multiAdapter.join('abc12345', localStream);
      multiAdapter.destroy();

      expect(fakeRoom.left).toBe(true);
      expect(fakeRoom2.left).toBe(true);
    });
  });
});
