export class TrysteroAdapter {
  constructor({ joinRoom }) {
    this._joinRoom = joinRoom;
    this._room = null;
    this._localStream = null;
    this._onStream = null;
    this._onConnect = null;
    this._onError = null;
    this._onPeerLeave = null;
  }

  onStream(cb)    { this._onStream = cb;    return this; }
  onConnect(cb)   { this._onConnect = cb;   return this; }
  onError(cb)     { this._onError = cb;     return this; }
  onPeerLeave(cb) { this._onPeerLeave = cb; return this; }

  join(roomId, localStream) {
    this._localStream = localStream;
    try {
      this._room = this._joinRoom({ appId: 'call-ma' }, roomId);
      // Send local stream to any already-present peers, and to each peer as they join
      this._room.addStream(localStream);
      this._room.onPeerJoin((peerId) => {
        this._room.addStream(localStream, peerId);
        this._onConnect?.(peerId);
      });
      this._room.onPeerStream((stream, peerId) => this._onStream?.(stream, peerId));
      this._room.onPeerLeave((peerId) => this._onPeerLeave?.(peerId));
    } catch (err) {
      this._onError?.(err);
    }
    return this;
  }

  destroy() {
    this._room?.leave?.();
    this._room = null;
  }
}
