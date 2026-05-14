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
});
