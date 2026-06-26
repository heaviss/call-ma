import { describe, it, expect, vi } from 'vitest';
import { buildRoomUrl, getRoomIdFromUrl, copyToClipboard, buildDirectUrl, parseDirectUrl } from '../shared/link.js';

function makeLocation(href) {
  const u = new URL(href);
  return {
    href: u.href,
    origin: u.origin,
    pathname: u.pathname,
    search: u.search,
  };
}

describe('link utilities', () => {
  describe('buildRoomUrl', () => {
    it('builds a URL with the room ID in the hash', () => {
      // Arrange
      const location = makeLocation('https://example.com/app/index.html');

      // Act
      const url = buildRoomUrl(location, 'abc12345');

      // Assert
      expect(url).toBe('https://example.com/app/index.html#abc12345');
    });

    it('preserves query params', () => {
      // Arrange
      const location = makeLocation('https://example.com/app/?foo=bar');

      // Act
      const url = buildRoomUrl(location, 'xyz98765');

      // Assert
      expect(url).toBe('https://example.com/app/?foo=bar#xyz98765');
    });
  });

  describe('getRoomIdFromUrl', () => {
    it('extracts a valid 8-char alphanumeric room ID from the hash', () => {
      // Arrange / Act
      const roomId = getRoomIdFromUrl('https://example.com/#abc12345');

      // Assert
      expect(roomId).toBe('abc12345');
    });

    it('returns null when there is no hash', () => {
      expect(getRoomIdFromUrl('https://example.com/')).toBeNull();
    });

    it('returns null for an old v1.xxx SDP hash', () => {
      expect(getRoomIdFromUrl('https://example.com/#v1.someLongBase64EncodedSdpBlob')).toBeNull();
    });

    it('returns null for a hash shorter than 8 chars', () => {
      expect(getRoomIdFromUrl('https://example.com/#abc123')).toBeNull();
    });

    it('returns null for a hash longer than 8 chars', () => {
      expect(getRoomIdFromUrl('https://example.com/#abc123456')).toBeNull();
    });

    it('returns null for a hash with uppercase letters', () => {
      expect(getRoomIdFromUrl('https://example.com/#ABC12345')).toBeNull();
    });

    it('returns null for an invalid URL that throws during parsing', () => {
      expect(getRoomIdFromUrl('not a valid url at all')).toBeNull();
    });
  });

  describe('copyToClipboard', () => {
    it('copies text to clipboard and returns true', async () => {
      // Arrange
      const writeText = vi.fn().mockResolvedValue(undefined);
      const navigatorLike = { clipboard: { writeText } };

      // Act
      const ok = await copyToClipboard(navigatorLike, 'hello');

      // Assert
      expect(ok).toBe(true);
      expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('returns false if clipboard is not available', async () => {
      expect(await copyToClipboard({}, 'x')).toBe(false);
    });
  });
});

describe('buildDirectUrl', () => {
  const loc = { origin: 'https://example.com', pathname: '/', search: '' };

  it('builds an offer URL', () => {
    expect(buildDirectUrl(loc, 'offer', 'abc123')).toBe('https://example.com/#offer=abc123');
  });

  it('builds an answer URL', () => {
    expect(buildDirectUrl(loc, 'answer', 'xyz789')).toBe('https://example.com/#answer=xyz789');
  });

  it('preserves search params in the URL', () => {
    const locWithSearch = { origin: 'https://example.com', pathname: '/', search: '?foo=bar' };
    expect(buildDirectUrl(locWithSearch, 'offer', 'abc')).toBe('https://example.com/?foo=bar#offer=abc');
  });
});

describe('parseDirectUrl', () => {
  it('returns type and encoded for an offer hash', () => {
    expect(parseDirectUrl('https://example.com/#offer=abc123')).toEqual({ type: 'offer', encoded: 'abc123' });
  });

  it('returns type and encoded for an answer hash', () => {
    expect(parseDirectUrl('https://example.com/#answer=xyz789')).toEqual({ type: 'answer', encoded: 'xyz789' });
  });

  it('returns null for a Trystero room hash', () => {
    expect(parseDirectUrl('https://example.com/#a1b2c3d4')).toBeNull();
  });

  it('returns null for an unknown hash prefix', () => {
    expect(parseDirectUrl('https://example.com/#unknown=abc')).toBeNull();
  });

  it('returns null for an empty encoded value', () => {
    expect(parseDirectUrl('https://example.com/#offer=')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(parseDirectUrl('not-a-url')).toBeNull();
  });

  it('returns null for a URL with no hash', () => {
    expect(parseDirectUrl('https://example.com/')).toBeNull();
  });
});
