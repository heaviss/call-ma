import type { AddMediaOptions, JoinRoomCallbacks, JoinRoomConfig, Room } from '@trystero-p2p/core';

// The part of a Trystero room the adapter uses; `FakeRoom` implements the same surface.
export interface RoomLike {
  addStream(stream: MediaStream, options?: AddMediaOptions): unknown;
  leave(): unknown;
  onPeerJoin: Room['onPeerJoin'];
  onPeerLeave: Room['onPeerLeave'];
  onPeerStream: Room['onPeerStream'];
}

export type JoinRoomLike = (config: JoinRoomConfig, roomId: string, callbacks?: JoinRoomCallbacks) => RoomLike;

export interface Transport {
  joinRoom: JoinRoomLike;
  relayUrls?: string[] | undefined;
}

// transports = [{ joinRoom, relayUrls? }]  (preferred)
// joinRoom = single fn                      (backward compat)
export type TransportOptions =
  | { transports: readonly Transport[]; joinRoom?: undefined }
  | { joinRoom: JoinRoomLike; transports?: undefined };

export type TrysteroAdapterOptions = TransportOptions & {
  iceServers?: RTCIceServer[] | undefined;
};

type StreamCallback = (stream: MediaStream, peerId: string) => void;
type PeerCallback = (peerId: string) => void;
type ErrorCallback = (error: Error) => void;

export class TrysteroAdapter {
  private readonly _transports: readonly Transport[];
  private readonly _iceServers: RTCIceServer[] | undefined;
  private _rooms: RoomLike[] = [];
  private _onStream: StreamCallback | null = null;
  private _onConnect: PeerCallback | null = null;
  private _onError: ErrorCallback | null = null;
  private _onPeerLeave: PeerCallback | null = null;

  constructor(options: TrysteroAdapterOptions) {
    this._transports = options.transports === undefined ? [{ joinRoom: options.joinRoom }] : options.transports;
    this._iceServers = options.iceServers;
  }

  onStream(cb: StreamCallback): this    { this._onStream = cb;    return this; }
  onConnect(cb: PeerCallback): this     { this._onConnect = cb;   return this; }
  onError(cb: ErrorCallback): this      { this._onError = cb;     return this; }
  onPeerLeave(cb: PeerCallback): this   { this._onPeerLeave = cb; return this; }

  // Programmer errors (bad config, API drift) throw; network failures arrive via onError.
  join(roomId: string, localStream: MediaStream): this {
    const connectedPeers = new Set<string>();
    const callbacks: JoinRoomCallbacks = { onJoinError: ({ error }) => this._onError?.(new Error(error)) };

    for (const { joinRoom, relayUrls } of this._transports) {
      const config: JoinRoomConfig = { appId: 'call-ma' };
      if (relayUrls?.length)        config.relayConfig = { urls: relayUrls };
      if (this._iceServers?.length) config.rtcConfig   = { iceServers: this._iceServers };

      const room = joinRoom(config, roomId, callbacks);
      this._rooms.push(room);

      room.onPeerJoin = (peerId) => {
        room.addStream(localStream, { target: peerId });
        if (!connectedPeers.has(peerId)) this._onConnect?.(peerId);
      };
      room.onPeerStream = (stream, peerId) => {
        if (connectedPeers.has(peerId)) return;
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

  destroy(): void {
    for (const r of this._rooms) r?.leave?.();
    this._rooms = [];
  }
}
