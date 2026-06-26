import { describe, it, expect, afterEach } from 'vitest';
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
    const garbage = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    await expect(decodeSdp(garbage)).rejects.toThrow();
  });

  it('encodeSdp throws when CompressionStream is not available', async () => {
    const saved = globalThis.CompressionStream;
    delete globalThis.CompressionStream;

    await expect(encodeSdp(desc)).rejects.toThrow('CompressionStream not supported');

    globalThis.CompressionStream = saved;
  });
});
