export class TrysteroAdapter {
  constructor({ joinRoom, transports, iceServers }) {
    // transports = [{ joinRoom, relayUrls? }]  (preferred)
    // joinRoom = single fn                      (backward compat)
    this._transports = transports ?? [{ joinRoom }];
    this._iceServers = iceServers;
    this._rooms = [];
    this._onStream    = null;
    this._onConnect   = null;
    this._onError     = null;
    this._onPeerLeave = null;
  }

  onStream(cb)    { this._onStream = cb;    return this; }
  onConnect(cb)   { this._onConnect = cb;   return this; }
  onError(cb)     { this._onError = cb;     return this; }
  onPeerLeave(cb) { this._onPeerLeave = cb; return this; }

  // Programmer errors (bad config, API drift) throw; network failures arrive via onError.
  join(roomId, localStream) {
    const connectedPeers = new Set();
    const callbacks = { onJoinError: ({ error }) => this._onError?.(new Error(error)) };

    for (const { joinRoom, relayUrls } of this._transports) {
      const config = { appId: 'call-ma' };
      if (relayUrls?.length)        {config.relayConfig = { urls: relayUrls };}
      if (this._iceServers?.length) {config.rtcConfig   = { iceServers: this._iceServers };}

      const room = joinRoom(config, roomId, callbacks);
      this._rooms.push(room);

      room.onPeerJoin = (peerId) => {
        room.addStream(localStream, { target: peerId });
        if (!connectedPeers.has(peerId)) {this._onConnect?.(peerId);}
      };
      room.onPeerStream = (stream, peerId) => {
        if (connectedPeers.has(peerId)) {
          return;
        }

        connectedPeers.add(peerId);
        this._onStream?.(stream, peerId);
      };
      room.onPeerLeave = (peerId) => {
        connectedPeers.delete(peerId);
        this._onPeerLeave?.(peerId);
      };
    }
    return this;
  }

  destroy() {
    for (const r of this._rooms) {r?.leave?.();}
    this._rooms = [];
  }
}
