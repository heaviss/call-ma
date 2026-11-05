import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectAdapter } from '../connection/directAdapter.ts';
import { fakeStream as makeStream } from './fakes/dom.ts';

class FakePeerConnection {
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: { type: RTCSdpType; sdp: string | undefined } | null = null;
  iceGatheringState: RTCIceGatheringState = 'new';
  connectionState: RTCPeerConnectionState = 'new';
  onicegatheringstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: { streams: readonly MediaStream[] }) => void) | null = null;
  tracks: { track: MediaStreamTrack; stream: MediaStream }[] = [];

  addTrack(track: MediaStreamTrack, stream: MediaStream): void { this.tracks.push({ track, stream }); }

  async createOffer(): Promise<RTCSessionDescriptionInit> { return { type: 'offer', sdp: 'v=0\r\nfake-offer' }; }
  async createAnswer(): Promise<RTCSessionDescriptionInit> { return { type: 'answer', sdp: 'v=0\r\nfake-answer' }; }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc;
    this.iceGatheringState = 'complete';
    this.onicegatheringstatechange?.();
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = { type: desc.type, sdp: desc.sdp };
  }

  close(): void {}

  // Test helpers
  simulateTrack(stream: MediaStream): void { this.ontrack?.({ streams: [stream] }); }
  simulateConnected(): void {
    this.connectionState = 'connected';
    this.onconnectionstatechange?.();
  }
  simulateFailed(): void {
    this.connectionState = 'failed';
    this.onconnectionstatechange?.();
  }
}

function fakeStream(id = 'stream-1'): MediaStream {
  return makeStream(id, [{ kind: 'video', id }]);
}

// Must be a regular function (not arrow) so it works with `new`.
function stubPeerConnection(pc: FakePeerConnection) {
  return vi.fn<() => FakePeerConnection>(function () { return pc; });
}

describe('DirectAdapter', () => {
  let pc: FakePeerConnection;
  let adapter: DirectAdapter;

  beforeEach(() => {
    pc = new FakePeerConnection();
    adapter = new DirectAdapter({ PeerConnection: () => pc });
  });

  describe('createOffer', () => {
    it('returns a non-empty encoded string', async () => {
      const encoded = await adapter.createOffer(fakeStream());

      expect(encoded).toBeTypeOf('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('adds local stream tracks to the peer connection', async () => {
      const stream = fakeStream();

      await adapter.createOffer(stream);

      expect(pc.tracks).toContainEqual(expect.objectContaining({ stream }));
    });

    it('sets local description on the peer connection', async () => {
      await adapter.createOffer(fakeStream());

      expect(pc.localDescription).toStrictEqual({ type: 'offer', sdp: 'v=0\r\nfake-offer' });
    });
  });

  describe('createAnswer', () => {
    it('returns an encoded answer string', async () => {
      const offerEncoded = await adapter.createOffer(fakeStream());
      const pc2 = new FakePeerConnection();
      const answerAdapter = new DirectAdapter({ PeerConnection: () => pc2 });

      const answerEncoded = await answerAdapter.createAnswer(offerEncoded, fakeStream('stream-2'));

      expect(answerEncoded).toBeTypeOf('string');
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
      const onStream = vi.fn<Parameters<DirectAdapter['onStream']>[0]>();
      const remoteStream = fakeStream('remote');
      adapter.onStream(onStream);

      await adapter.createOffer(fakeStream());
      pc.simulateTrack(remoteStream);

      expect(onStream).toHaveBeenCalledWith(remoteStream);
    });

    it('fires onStream with null when a remote track arrives without a stream', async () => {
      const onStream = vi.fn<Parameters<DirectAdapter['onStream']>[0]>();
      adapter.onStream(onStream);
      await adapter.createOffer(fakeStream());

      pc.ontrack?.({ streams: [] });

      expect(onStream).toHaveBeenCalledWith(null);
    });

    it('fires onConnect when connection state becomes connected', async () => {
      const onConnect = vi.fn<Parameters<DirectAdapter['onConnect']>[0]>();
      adapter.onConnect(onConnect);

      await adapter.createOffer(fakeStream());
      pc.simulateConnected();

      expect(onConnect).toHaveBeenCalledExactlyOnceWith();
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
      pc.setLocalDescription = async (desc: RTCSessionDescriptionInit) => { pc.localDescription = desc; }; // never fires event

      const offerPromise = adapter.createOffer(fakeStream());
      vi.advanceTimersByTime(5000);
      await offerPromise;

      expect(pc.localDescription).not.toBeNull();
      vi.useRealTimers();
    });

    it('keeps waiting while ICE gathering is still in progress', async () => {
      vi.useFakeTimers();
      pc.setLocalDescription = async (desc: RTCSessionDescriptionInit) => {
        pc.localDescription = desc;
        pc.iceGatheringState = 'gathering';
        pc.onicegatheringstatechange?.();
      };

      const offerPromise = adapter.createOffer(fakeStream());
      await vi.advanceTimersByTimeAsync(4999);
      const pendingTimers = vi.getTimerCount();
      await vi.advanceTimersByTimeAsync(1);
      await offerPromise;

      expect(pendingTimers).toBe(1); // the 'gathering' event did not cancel the 5 s fallback
      vi.useRealTimers();
    });

    it('resolves immediately if ICE gathering is already complete', async () => {
      pc.iceGatheringState = 'complete'; // already complete before #waitForIce() is called

      const encoded = await adapter.createOffer(fakeStream());

      expect(pc.localDescription).not.toBeNull();
      expect(encoded).toBeTypeOf('string');
    });
  });

  describe('error handling', () => {
    it('fires onError when connection state becomes failed', async () => {
      const onError = vi.fn<Parameters<DirectAdapter['onError']>[0]>();
      adapter.onError(onError);

      await adapter.createOffer(fakeStream());
      pc.simulateFailed();

      expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    });
  });

  describe('default PeerConnection factory', () => {
    it('falls back to globalThis.RTCPeerConnection when none is provided', async () => {
      const fakePc = new FakePeerConnection();
      const FakeRTC = stubPeerConnection(fakePc);
      vi.stubGlobal('RTCPeerConnection', FakeRTC);

      const defaultAdapter = new DirectAdapter({ iceServers: [{ urls: 'stun:stun.example.com' }] });
      const encoded = await defaultAdapter.createOffer(fakeStream());

      expect(FakeRTC).toHaveBeenCalledExactlyOnceWith({ iceServers: [{ urls: 'stun:stun.example.com' }] });
      expect(encoded).toBeTypeOf('string');

      vi.unstubAllGlobals();
    });
  });
});
