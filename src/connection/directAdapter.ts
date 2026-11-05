import { decodeSdp, encodeSdp } from '../shared/sdp.ts';

// The part of `RTCPeerConnection` the adapter uses, so tests can pass a fake.
export interface PeerConnectionLike {
  ontrack: ((event: RTCTrackEvent) => unknown) | null;
  onconnectionstatechange: ((event: Event) => unknown) | null;
  onicegatheringstatechange: ((event: Event) => unknown) | null;
  readonly connectionState: RTCPeerConnectionState;
  readonly iceGatheringState: RTCIceGatheringState;
  readonly localDescription: RTCSessionDescriptionInit | null;
  addTrack(track: MediaStreamTrack, stream: MediaStream): unknown;
  createOffer(): Promise<RTCSessionDescriptionInit>;
  createAnswer(): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
}

export type PeerConnectionFactory = (config: RTCConfiguration) => PeerConnectionLike;

export interface DirectAdapterOptions {
  iceServers?: RTCIceServer[] | undefined;
  PeerConnection?: PeerConnectionFactory;
}

export class DirectAdapter {
  #PeerConnection: PeerConnectionFactory;
  #iceConfig: RTCConfiguration;
  #pc: PeerConnectionLike | null = null;
  #onStreamCb: ((stream: MediaStream | null) => void) | null = null;
  #onConnectCb: (() => void) | null = null;
  #onErrorCb: ((error: Error) => void) | null = null;

  constructor({ iceServers = [], PeerConnection }: DirectAdapterOptions = {}) {
    this.#iceConfig = { iceServers };
    this.#PeerConnection = PeerConnection ?? ((cfg) => new RTCPeerConnection(cfg));
  }

  #setup(pc: PeerConnectionLike): void {
    pc.ontrack = ({ streams }) => {
      if (this.#onStreamCb) {
        this.#onStreamCb(streams[0] ?? null);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && this.#onConnectCb) {
        this.#onConnectCb();
      }
      if (pc.connectionState === 'failed' && this.#onErrorCb) {
        this.#onErrorCb(new Error('connection failed'));
      }
    };
  }

  #waitForIce(pc: PeerConnectionLike): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 5000);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState !== 'complete') {
          return;
        }
        clearTimeout(timer);
        resolve();
      };
    });
  }

  onStream(cb: (stream: MediaStream | null) => void): this {
    this.#onStreamCb = cb;
    return this;
  }
  onConnect(cb: () => void): this {
    this.#onConnectCb = cb;
    return this;
  }
  onError(cb: (error: Error) => void): this {
    this.#onErrorCb = cb;
    return this;
  }

  async createOffer(stream: MediaStream): Promise<string> {
    const pc = this.#PeerConnection(this.#iceConfig);
    this.#pc = pc;
    this.#setup(pc);
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }
    const iceWaiter = this.#waitForIce(pc); // ponytail: register timer before any await so fake-timers tests work
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await iceWaiter;
    return encodeSdp(pc.localDescription);
  }

  async createAnswer(offerEncoded: string, stream: MediaStream): Promise<string> {
    const pc = this.#PeerConnection(this.#iceConfig);
    this.#pc = pc;
    this.#setup(pc);
    const iceWaiter = this.#waitForIce(pc); // ponytail: register timer before any await so fake-timers tests work
    const offer = await decodeSdp(offerEncoded);
    await pc.setRemoteDescription(offer);
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await iceWaiter;
    return encodeSdp(pc.localDescription);
  }

  async applyAnswer(answerEncoded: string): Promise<void> {
    if (!this.#pc) {
      throw new Error('no pending offer');
    }
    const answer = await decodeSdp(answerEncoded);
    await this.#pc.setRemoteDescription(answer);
  }
}
