import { describe, it, expect } from 'vitest';
import { createStrategy } from '@trystero-p2p/core';
import { FakeRoom } from './fakes/fakeRoom.ts';
import { fakeStream } from './fakes/dom.ts';
import { TrysteroAdapter } from '../connection/trysteroAdapter.ts';

class StubPeerConnection {
  addEventListener() {}
  removeEventListener() {}
  createDataChannel() { return { addEventListener() {}, close() {} }; }
  async createOffer() { return { type: 'offer', sdp: '' }; }
  async setLocalDescription() {}
  close() {}
}

// Only the methods an offline room touches; Trystero types rtcPolyfill as the full constructor.
const rtcPolyfill = StubPeerConnection as unknown as typeof RTCPeerConnection;

const noop = () => {};

function offlineJoinRoom() {
  return createStrategy({
    init: () => [],
    subscribe: () => noop,
    announce: noop,
  });
}

function realRoom() {
  return offlineJoinRoom()({ appId: 'contract', rtcPolyfill }, 'room');
}

const HANDLERS = ['onPeerJoin', 'onPeerLeave', 'onPeerStream'] as const;

describe.each([
  ['real Trystero room', realRoom],
  ['FakeRoom', () => new FakeRoom()],
])('room contract: %s', (_name, makeRoom) => {
  it.each(HANDLERS)('%s is unset until assigned, not a subscribe method', (key) => {
    const room = makeRoom();

    expect(typeof room[key]).not.toBe('function');
    room.leave();
  });

  it.each(HANDLERS)('%s is an assignable handler property', (key) => {
    const room = makeRoom();

    room[key] = noop;

    expect(room[key]).toBe(noop);
    room.leave();
  });

  it('exposes addStream and leave as methods', () => {
    const room = makeRoom();

    expect(typeof room.addStream).toBe('function');
    expect(typeof room.leave).toBe('function');
    room.leave();
  });
});

describe('TrysteroAdapter against a real Trystero room', () => {
  it('joins without errors', () => {
    const joinRoom = offlineJoinRoom();
    const errors: Error[] = [];
    const adapter = new TrysteroAdapter({
      transports: [{ joinRoom: (config, roomId, callbacks) =>
        joinRoom({ ...config, rtcPolyfill }, roomId, callbacks) }],
    }).onError((error) => { errors.push(error); });

    adapter.join('room', fakeStream('local'));

    expect(errors).toEqual([]);
    adapter.destroy();
  });
});
