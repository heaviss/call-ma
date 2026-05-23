import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrysteroAdapter } from '../connection/trysteroAdapter.js';

class FakeRoom {
  constructor() {
    this._addStreamCalls = [];
    this._onPeerStreamCb = null;
    this._onPeerJoinCb = null;
    this._onPeerLeaveCb = null;
    this.left = false;
  }

  addStream(stream, peerId)  { this._addStreamCalls.push({ stream, peerId }); }
  onPeerStream(cb)           { this._onPeerStreamCb = cb; }
  onPeerJoin(cb)             { this._onPeerJoinCb = cb; }
  onPeerLeave(cb)            { this._onPeerLeaveCb = cb; }
  leave()                    { this.left = true; }

  // Test helpers
  simulatePeerJoin(peerId)              { this._onPeerJoinCb?.(peerId); }
  simulatePeerLeave(peerId)             { this._onPeerLeaveCb?.(peerId); }
  simulatePeerStream(stream, peerId)    { this._onPeerStreamCb?.(stream, peerId); }
}

describe('TrysteroAdapter', () => {
  let fakeRoom;
  let fakeJoinRoom;
  let adapter;
  const localStream = { id: 'local' };

  beforeEach(() => {
    fakeRoom = new FakeRoom();
    fakeJoinRoom = vi.fn().mockReturnValue(fakeRoom);
    adapter = new TrysteroAdapter({ joinRoom: fakeJoinRoom });
  });

  it('calls joinRoom with appId and roomId on join()', () => {
    adapter.join('abc12345', localStream);

    expect(fakeJoinRoom).toHaveBeenCalledWith({ appId: 'call-ma' }, 'abc12345');
  });

  it('adds local stream to the room immediately on join()', () => {
    adapter.join('abc12345', localStream);

    expect(fakeRoom._addStreamCalls.some((c) => c.stream === localStream && c.peerId == null)).toBe(true);
  });

  it('sends local stream to a specific peer when they join', () => {
    adapter.join('abc12345', localStream);
    fakeRoom.simulatePeerJoin('peer-1');

    expect(fakeRoom._addStreamCalls.some((c) => c.stream === localStream && c.peerId === 'peer-1')).toBe(true);
  });

  it('fires onConnect when a peer joins', () => {
    const onConnect = vi.fn();
    adapter.onConnect(onConnect).join('abc12345', localStream);
    fakeRoom.simulatePeerJoin('peer-1');

    expect(onConnect).toHaveBeenCalledWith('peer-1');
  });

  it('does not fire onConnect when the peer stream arrived before the join event', () => {
    // Arrange — stream arrives first, adding peer to connectedPeers
    const onConnect = vi.fn();
    adapter.onConnect(onConnect).join('abc12345', localStream);
    fakeRoom.simulatePeerStream({ id: 'remote' }, 'peer-1');

    // Act — join event fires after stream
    fakeRoom.simulatePeerJoin('peer-1');

    // Assert — onConnect is suppressed since peer already counted
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('fires onStream when a peer sends their stream', () => {
    const onStream = vi.fn();
    const remoteStream = { id: 'remote' };
    adapter.onStream(onStream).join('abc12345', localStream);
    fakeRoom.simulatePeerStream(remoteStream, 'peer-1');

    expect(onStream).toHaveBeenCalledWith(remoteStream, 'peer-1');
  });

  it('fires onPeerLeave when a peer leaves', () => {
    const onPeerLeave = vi.fn();
    adapter.onPeerLeave(onPeerLeave).join('abc12345', localStream);
    fakeRoom.simulatePeerLeave('peer-1');

    expect(onPeerLeave).toHaveBeenCalledWith('peer-1');
  });

  it('calls room.leave() on destroy()', () => {
    adapter.join('abc12345', localStream);
    adapter.destroy();

    expect(fakeRoom.left).toBe(true);
  });

  it('fires onError if joinRoom throws', () => {
    const onError = vi.fn();
    const boom = new Error('relay down');
    fakeJoinRoom.mockImplementation(() => { throw boom; });

    adapter.onError(onError).join('abc12345', localStream);

    expect(onError).toHaveBeenCalledWith(boom);
  });

  it('returns the adapter for chaining from join()', () => {
    const result = adapter.join('abc12345', localStream);

    expect(result).toBe(adapter);
  });

  describe('multi-transport', () => {
    it('calls all joinRoom functions on join()', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn().mockReturnValue(fakeRoom2);
      const multiAdapter = new TrysteroAdapter({
        transports: [
          { joinRoom: fakeJoinRoom },
          { joinRoom: fakeJoinRoom2 },
        ],
      });

      multiAdapter.join('abc12345', localStream);

      expect(fakeJoinRoom).toHaveBeenCalledWith({ appId: 'call-ma' }, 'abc12345');
      expect(fakeJoinRoom2).toHaveBeenCalledWith({ appId: 'call-ma' }, 'abc12345');
    });

    it('passes relayConfig and turnConfig per transport', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn().mockReturnValue(fakeRoom2);
      const multiAdapter = new TrysteroAdapter({
        transports: [
          { joinRoom: fakeJoinRoom,  relayUrls: ['wss://mqtt.example.com'] },
          { joinRoom: fakeJoinRoom2, relayUrls: ['wss://tracker.example.com'] },
        ],
        turnConfig: [{ urls: 'turn:turn.example.com', username: 'u', credential: 'p' }],
      });

      multiAdapter.join('abc12345', localStream);

      expect(fakeJoinRoom).toHaveBeenCalledWith({
        appId: 'call-ma',
        relayConfig: { urls: ['wss://mqtt.example.com'] },
        turnConfig: [{ urls: 'turn:turn.example.com', username: 'u', credential: 'p' }],
      }, 'abc12345');
      expect(fakeJoinRoom2).toHaveBeenCalledWith({
        appId: 'call-ma',
        relayConfig: { urls: ['wss://tracker.example.com'] },
        turnConfig: [{ urls: 'turn:turn.example.com', username: 'u', credential: 'p' }],
      }, 'abc12345');
    });

    it('fires onStream only once when same peer connects via both transports', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn().mockReturnValue(fakeRoom2);
      const multiAdapter = new TrysteroAdapter({
        transports: [{ joinRoom: fakeJoinRoom }, { joinRoom: fakeJoinRoom2 }],
      });
      const onStream = vi.fn();
      const remoteStream1 = { id: 'remote-mqtt' };
      const remoteStream2 = { id: 'remote-torrent' };

      multiAdapter.onStream(onStream).join('abc12345', localStream);
      fakeRoom.simulatePeerStream(remoteStream1, 'peer-1');
      fakeRoom2.simulatePeerStream(remoteStream2, 'peer-1');

      expect(onStream).toHaveBeenCalledTimes(1);
      expect(onStream).toHaveBeenCalledWith(remoteStream1, 'peer-1');
    });

    it('allows a new stream after peer leaves and rejoins', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn().mockReturnValue(fakeRoom2);
      const multiAdapter = new TrysteroAdapter({
        transports: [{ joinRoom: fakeJoinRoom }, { joinRoom: fakeJoinRoom2 }],
      });
      const onStream = vi.fn();
      const remoteStream = { id: 'remote' };

      multiAdapter.onStream(onStream).join('abc12345', localStream);
      fakeRoom.simulatePeerStream(remoteStream, 'peer-1');
      fakeRoom.simulatePeerLeave('peer-1');
      fakeRoom2.simulatePeerStream(remoteStream, 'peer-1');

      expect(onStream).toHaveBeenCalledTimes(2);
    });

    it('leaves all rooms on destroy()', () => {
      const fakeRoom2 = new FakeRoom();
      const fakeJoinRoom2 = vi.fn().mockReturnValue(fakeRoom2);
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
