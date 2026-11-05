import { vi } from 'vitest';

/**
The slice of RTCPeerConnection that Direct mode touches, plus `simulate*` hooks for tests.
*/
export interface FakePeerConnection {
  localDescription: RTCSessionDescriptionInit | null;
  remoteDescription: { type: RTCSdpType; sdp: string | undefined } | null;
  iceGatheringState: RTCIceGatheringState;
  connectionState: RTCPeerConnectionState;
  onicegatheringstatechange: (() => void) | null;
  onconnectionstatechange: (() => void) | null;
  ontrack: ((event: { streams: readonly MediaStream[] }) => void) | null;
  tracks: { track: MediaStreamTrack; stream: MediaStream }[];
  addTrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  createAnswer: () => Promise<RTCSessionDescriptionInit>;
  setLocalDescription: (desc: RTCSessionDescriptionInit) => Promise<void>;
  setRemoteDescription: (desc: RTCSessionDescriptionInit) => Promise<void>;
  simulateTrack: (stream: MediaStream) => void;
  simulateConnectionState: (state: RTCPeerConnectionState) => void;
}

/**
A peer connection whose ICE gathering completes as soon as the local description is set.
@returns a fresh fake; tests may override its methods to inject failures.
*/
export function makePeerConnection(): FakePeerConnection {
  const pc: FakePeerConnection = {
    localDescription: null,
    remoteDescription: null,
    iceGatheringState: 'new',
    connectionState: 'new',
    onicegatheringstatechange: null,
    onconnectionstatechange: null,
    ontrack: null,
    tracks: [],
    addTrack: (track, stream) => {
      pc.tracks.push({ track, stream });
    },
    createOffer: () => Promise.resolve({ type: 'offer', sdp: 'v=0\r\nfake-offer' }),
    createAnswer: () => Promise.resolve({ type: 'answer', sdp: 'v=0\r\nfake-answer' }),
    setLocalDescription: (desc) => {
      pc.localDescription = desc;
      pc.iceGatheringState = 'complete';
      pc.onicegatheringstatechange?.();
      return Promise.resolve();
    },
    setRemoteDescription: (desc) => {
      pc.remoteDescription = { type: desc.type, sdp: desc.sdp };
      return Promise.resolve();
    },
    simulateTrack: (stream) => {
      pc.ontrack?.({ streams: [stream] });
    },
    simulateConnectionState: (state) => {
      pc.connectionState = state;
      pc.onconnectionstatechange?.();
    },
  };
  return pc;
}

/**
Callers use `new RTCPeerConnection(cfg)`; a regular function works with `new`, `vi.fn().mockReturnValue` does not.
@param pc the fake every construction returns
@returns a constructor stand-in
*/
export function stubPeerConnection(pc: FakePeerConnection) {
  return vi.fn<() => FakePeerConnection>(function () {
    return pc;
  });
}
