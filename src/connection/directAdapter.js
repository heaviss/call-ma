import { encodeSdp, decodeSdp } from '../shared/sdp.js';

export class DirectAdapter {
  #PeerConnection;
  #iceConfig;
  #pc = null;
  #onStreamCb = null;
  #onConnectCb = null;
  #onErrorCb = null;

  constructor({ iceServers = [], turnConfig, PeerConnection = () => new globalThis.RTCPeerConnection({ iceServers: [...iceServers, ...(turnConfig ?? [])] }) } = {}) {
    this.#PeerConnection = PeerConnection;
    this.#iceConfig = { iceServers: [...iceServers, ...(turnConfig ?? [])] };
  }

  onStream(cb)  { this.#onStreamCb  = cb; return this; }
  onConnect(cb) { this.#onConnectCb = cb; return this; }
  onError(cb)   { this.#onErrorCb   = cb; return this; }

  async createOffer(stream) {
    this.#pc = this.#PeerConnection(this.#iceConfig);
    this.#setup();
    for (const track of stream.getTracks()) this.#pc.addTrack(track, stream);
    const iceWaiter = this.#waitForIce(); // ponytail: register timer before any await so fake-timers tests work
    const offer = await this.#pc.createOffer();
    await this.#pc.setLocalDescription(offer);
    await iceWaiter;
    return encodeSdp(this.#pc.localDescription);
  }

  async createAnswer(offerEncoded, stream) {
    this.#pc = this.#PeerConnection(this.#iceConfig);
    this.#setup();
    const iceWaiter = this.#waitForIce(); // ponytail: register timer before any await so fake-timers tests work
    const offer = await decodeSdp(offerEncoded);
    await this.#pc.setRemoteDescription(offer);
    for (const track of stream.getTracks()) this.#pc.addTrack(track, stream);
    const answer = await this.#pc.createAnswer();
    await this.#pc.setLocalDescription(answer);
    await iceWaiter;
    return encodeSdp(this.#pc.localDescription);
  }

  async applyAnswer(answerEncoded) {
    if (!this.#pc) throw new Error('no pending offer');
    const answer = await decodeSdp(answerEncoded);
    await this.#pc.setRemoteDescription(answer);
  }

  #setup() {
    this.#pc.ontrack = ({ streams }) => {
      if (this.#onStreamCb) this.#onStreamCb(streams[0]);
    };
    this.#pc.onconnectionstatechange = () => {
      if (this.#pc.connectionState === 'connected' && this.#onConnectCb) this.#onConnectCb();
      if (this.#pc.connectionState === 'failed' && this.#onErrorCb) this.#onErrorCb(new Error('connection failed'));
    };
  }

  #waitForIce() {
    return new Promise((resolve) => {
      if (this.#pc.iceGatheringState === 'complete') { resolve(); return; }
      const timer = setTimeout(resolve, 5000);
      this.#pc.onicegatheringstatechange = () => {
        if (this.#pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      };
    });
  }
}
