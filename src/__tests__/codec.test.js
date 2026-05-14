import { describe, it, expect } from 'vitest';
import { encodeSignal, decodeSignal, CODEC_VERSION } from '../shared/codec.js';

// Arrange / Act / Assert style tests

describe('signal codec', () => {
  it('roundtrips a valid offer payload with URL-safe string', () => {
    // Arrange
    const payload = {
      v: CODEC_VERSION,
      role: 'offer',
      sp: { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1' },
    };

    // Act
    const encoded = encodeSignal(payload);
    const decoded = decodeSignal(encoded);

    // Assert
    expect(typeof encoded).toBe('string');
    expect(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(encoded)).toBe(true); // version.prefix.payload
    expect(decoded).toEqual(payload);
  });

  it('rejects empty or non-string inputs with helpful error', () => {
    // Arrange
    const badValues = [null, undefined, '', 42, {}];

    // Act / Assert
    for (const v of badValues) {
      expect(() => decodeSignal(v)).toThrow(/invalid signal/i);
    }
  });

  it('rejects corrupted base64 with helpful error', () => {
    // Arrange
    const corrupted = 'v1.not-base64!!';

    // Act / Assert
    expect(() => decodeSignal(corrupted)).toThrow(/malformed/i);
  });

  it('rejects mismatched or missing version', () => {
    // Arrange
    const payload = { v: CODEC_VERSION, role: 'answer', sp: { type: 'answer' } };
    const encoded = encodeSignal(payload);

    // Act
    const tampered = encoded.replace(/^v1\./, 'v9.');

    // Assert
    expect(() => decodeSignal(tampered)).toThrow(/version/i);

    const noVersion = encoded.split('.').slice(1).join('.');
    expect(() => decodeSignal(noVersion)).toThrow(/version/i);
  });

  it('validates minimal payload shape', () => {
    // Arrange
    const good = { v: CODEC_VERSION, role: 'offer', sp: { type: 'offer' } };
    const badMissingRole = { v: CODEC_VERSION, sp: {} };
    const badRole = { v: CODEC_VERSION, role: 'weird', sp: {} };

    // Act / Assert
    expect(() => decodeSignal(encodeSignal(good))).not.toThrow();
    expect(() => decodeSignal(encodeSignal(badMissingRole))).toThrow(/payload/i);
    expect(() => decodeSignal(encodeSignal(badRole))).toThrow(/role/i);
  });
});
