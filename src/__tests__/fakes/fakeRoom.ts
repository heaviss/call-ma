import type { AddMediaOptions, PeerTarget } from '@trystero-p2p/core';
import type { RoomLike } from '../../connection/trysteroAdapter.ts';

// Mirrors the Trystero 0.26 room interface. roomContract.test.ts keeps it honest.
export class FakeRoom implements RoomLike {
  onPeerJoin: RoomLike['onPeerJoin'] = null;
  onPeerLeave: RoomLike['onPeerLeave'] = null;
  onPeerStream: RoomLike['onPeerStream'] = null;
  addStreamCalls: { stream: MediaStream; target: PeerTarget | undefined }[] = [];
  left = false;

  addStream(stream: MediaStream, options: AddMediaOptions = {}): void { this.addStreamCalls.push({ stream, target: options.target }); }
  leave(): void { this.left = true; }

  simulatePeerJoin(peerId: string): void                        { this.onPeerJoin?.(peerId); }
  simulatePeerLeave(peerId: string): void                       { this.onPeerLeave?.(peerId); }
  simulatePeerStream(stream: MediaStream, peerId: string): void { this.onPeerStream?.(stream, peerId); }
}
