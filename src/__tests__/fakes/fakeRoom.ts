import type { AddMediaOptions, PeerTarget } from '@trystero-p2p/core';

import { vi } from 'vitest';

import type { JoinRoomLike, RoomLike } from '../../connection/trysteroAdapter.ts';

// Mirrors the Trystero 0.26 room interface. roomContract.test.ts keeps it honest.
export class FakeRoom implements RoomLike {
  onPeerJoin: RoomLike['onPeerJoin'] = null;
  onPeerLeave: RoomLike['onPeerLeave'] = null;
  onPeerStream: RoomLike['onPeerStream'] = null;
  addStreamCalls: { stream: MediaStream; target: PeerTarget | undefined }[] = [];
  left = false;

  addStream(stream: MediaStream, options: AddMediaOptions = {}): void {
    this.addStreamCalls.push({ stream, target: options.target });
  }
  leave(): void {
    this.left = true;
  }

  simulatePeerJoin(peerId: string): void {
    this.onPeerJoin?.(peerId);
  }
  simulatePeerLeave(peerId: string): void {
    this.onPeerLeave?.(peerId);
  }
  simulatePeerStream(stream: MediaStream, peerId: string): void {
    this.onPeerStream?.(stream, peerId);
  }
}

/**
A Transport stand-in: its `joinRoom` is the external dependency, so it is a `vi.fn`.
@returns the room every join returns, and the spy for asserting join calls
*/
export function fakeTransport() {
  const room = new FakeRoom();
  const joinRoom = vi.fn<JoinRoomLike>().mockReturnValue(room);
  return { room, joinRoom };
}
