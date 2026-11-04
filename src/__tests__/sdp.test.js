import { describe, it, expect } from 'vitest';
import { encodeSdp, decodeSdp } from '../shared/sdp.js';

describe('sdp', () => {
  const desc = { type: 'offer', sdp: 'v=0\r\no=- 1234 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' };

  it('encodes to a URL-safe string without +, /, or =', async () => {
    const encoded = await encodeSdp(desc);

    expect(typeof encoded).toBe('string');
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('roundtrips encode → decode back to the original object', async () => {
    const encoded = await encodeSdp(desc);
    const decoded = await decodeSdp(encoded);

    expect(decoded).toEqual(desc);
  });

  it('decodeSdp throws on invalid base64url', async () => {
    await expect(decodeSdp('!!!not-valid!!!')).rejects.toThrow();
  });

  it('decodeSdp throws on valid base64url that is not JSON', async () => {
    const garbage = btoa('not json').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    await expect(decodeSdp(garbage)).rejects.toThrow();
  });

  it('encodeSdp throws when CompressionStream is not available', async () => {
    const saved = CompressionStream;
    delete globalThis.CompressionStream;

    await expect(encodeSdp(desc)).rejects.toThrow('CompressionStream not supported');

    globalThis.CompressionStream = saved;
  });
});

describe('decodeSdp with output larger than the stream buffer', () => {
  it('round-trips without deadlocking', async () => {
    const sdp = Array.from({ length: 5000 }, (_, i) => `a=candidate:${i} 1 udp 2122260223 192.0.2.${i % 255} ${50_000 + i} typ host`).join('\r\n');
    const desc = { type: 'offer', sdp };

    const decoded = await decodeSdp(await encodeSdp(desc));

    expect(decoded).toEqual(desc);
  }, 3000);
});
