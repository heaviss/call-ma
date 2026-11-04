// Mirrors the Trystero 0.26 room interface. roomContract.test.js keeps it honest.
export class FakeRoom {
  onPeerJoin = null;
  onPeerLeave = null;
  onPeerStream = null;
  addStreamCalls = [];
  left = false;

  addStream(stream, options = {}) { this.addStreamCalls.push({ stream, target: options.target }); }
  leave() { this.left = true; }

  simulatePeerJoin(peerId)           { this.onPeerJoin?.(peerId); }
  simulatePeerLeave(peerId)          { this.onPeerLeave?.(peerId); }
  simulatePeerStream(stream, peerId) { this.onPeerStream?.(stream, peerId); }
}
