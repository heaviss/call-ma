import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DirectAdapter } from '../connection/directAdapter.js';

class FakePeerConnection {
  localDescription = null;
  remoteDescription = null;
  iceGatheringState = 'new';
  connectionState = 'new';
  onicegatheringstatechange = null;
  onconnectionstatechange = null;
  ontrack = null;
  _tracks = [];

  addTrack(track, stream) { this._tracks.push({ track, stream }); }

  async createOffer() { return { type: 'offer', sdp: 'v=0\r\nfake-offer' }; }
  async createAnswer() { return { type: 'answer', sdp: 'v=0\r\nfake-answer' }; }

  async setLocalDescription(desc) {
    this.localDescription = desc;
    this.iceGatheringState = 'complete';
    this.onicegatheringstatechange?.();
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = { type: desc.type, sdp: desc.sdp };
  }

  close() {}

  // Test helpers
  simulateTrack(stream) { this.ontrack?.({ streams: [stream] }); }
  simulateConnected() {
    this.connectionState = 'connected';
    this.onconnectionstatechange?.();
  }
}

function fakeStream(id = 'stream-1') {
  return { id, getTracks: () => [{ kind: 'video', id }] };
}

describe('DirectAdapter', () => {
  let pc;
  let adapter;

  beforeEach(() => {
    pc = new FakePeerConnection();
    adapter = new DirectAdapter({ PeerConnection: () => pc });
  });

  describe('createOffer', () => {
    it('returns a non-empty encoded string', async () => {
      const encoded = await adapter.createOffer(fakeStream());

      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('adds local stream tracks to the peer connection', async () => {
      const stream = fakeStream();

      await adapter.createOffer(stream);

      expect(pc._tracks.some((t) => t.stream === stream)).toBe(true);
    });

    it('sets local description on the peer connection', async () => {
      await adapter.createOffer(fakeStream());

      expect(pc.localDescription).toEqual({ type: 'offer', sdp: 'v=0\r\nfake-offer' });
    });
  });

  describe('createAnswer', () => {
    it('returns an encoded answer string', async () => {
      const offerEncoded = await adapter.createOffer(fakeStream());
      const pc2 = new FakePeerConnection();
      const answerAdapter = new DirectAdapter({ PeerConnection: () => pc2 });

      const answerEncoded = await answerAdapter.createAnswer(offerEncoded, fakeStream('stream-2'));

      expect(typeof answerEncoded).toBe('string');
      expect(answerEncoded.length).toBeGreaterThan(0);
    });

    it('sets the offer as remote description before answering', async () => {
      const offerEncoded = await adapter.createOffer(fakeStream());
      const pc2 = new FakePeerConnection();
      const answerAdapter = new DirectAdapter({ PeerConnection: () => pc2 });

      await answerAdapter.createAnswer(offerEncoded, fakeStream('stream-2'));

      expect(pc2.remoteDescription?.type).toBe('offer');
    });
  });

  describe('applyAnswer', () => {
    it('sets the answer as remote description on the initiator side', async () => {
      const offerEncoded = await adapter.createOffer(fakeStream());
      const pc2 = new FakePeerConnection();
      const answerAdapter = new DirectAdapter({ PeerConnection: () => pc2 });
      const answerEncoded = await answerAdapter.createAnswer(offerEncoded, fakeStream('stream-2'));

      await adapter.applyAnswer(answerEncoded);

      expect(pc.remoteDescription?.type).toBe('answer');
    });

    it('throws if called before createOffer', async () => {
      await expect(adapter.applyAnswer('anything')).rejects.toThrow('no pending offer');
    });
  });

  describe('callbacks', () => {
    it('fires onStream when a remote track arrives', async () => {
      const onStream = vi.fn();
      const remoteStream = fakeStream('remote');
      adapter.onStream(onStream);

      await adapter.createOffer(fakeStream());
      pc.simulateTrack(remoteStream);

      expect(onStream).toHaveBeenCalledWith(remoteStream);
    });

    it('fires onConnect when connection state becomes connected', async () => {
      const onConnect = vi.fn();
      adapter.onConnect(onConnect);

      await adapter.createOffer(fakeStream());
      pc.simulateConnected();

      expect(onConnect).toHaveBeenCalledOnce();
    });

    it('supports fluent chaining of callbacks', () => {
      expect(adapter.onStream(vi.fn())).toBe(adapter);
      expect(adapter.onConnect(vi.fn())).toBe(adapter);
      expect(adapter.onError(vi.fn())).toBe(adapter);
    });
  });

  describe('ICE gathering timeout', () => {
    it('resolves after 5 s if ICE gathering never completes', async () => {
      vi.useFakeTimers();
      pc.setLocalDescription = async (desc) => { pc.localDescription = desc; }; // never fires event

      const offerPromise = adapter.createOffer(fakeStream());
      vi.advanceTimersByTime(5000);
      await offerPromise;

      expect(pc.localDescription).not.toBeNull();
      vi.useRealTimers();
    });
  });
});
