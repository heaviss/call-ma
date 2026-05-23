export class TrysteroAdapter {
  constructor({ joinRoom, transports, turnConfig }) {
    // transports = [{ joinRoom, relayUrls? }]  (preferred)
    // joinRoom = single fn                      (backward compat)
    this._transports = transports ?? [{ joinRoom }];
    this._turnConfig = turnConfig;
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

  join(roomId, localStream) {
    const connectedPeers = new Set();

    for (const { joinRoom, relayUrls } of this._transports) {
      const config = { appId: 'call-ma' };
      if (relayUrls?.length)        config.relayConfig = { urls: relayUrls };
      if (this._turnConfig?.length) config.turnConfig  = this._turnConfig;

      try {
        const room = joinRoom(config, roomId);
        this._rooms.push(room);

        room.addStream(localStream);
        room.onPeerJoin((peerId) => {
          room.addStream(localStream, peerId);
          if (!connectedPeers.has(peerId)) this._onConnect?.(peerId);
        });
        room.onPeerStream((stream, peerId) => {
          if (!connectedPeers.has(peerId)) {
            connectedPeers.add(peerId);
            this._onStream?.(stream, peerId);
          }
        });
        room.onPeerLeave((peerId) => {
          connectedPeers.delete(peerId);
          this._onPeerLeave?.(peerId);
        });
      } catch (error) {
        this._onError?.(error);
      }
    }
    return this;
  }

  destroy() {
    for (const r of this._rooms) r?.leave?.();
    this._rooms = [];
  }
}
