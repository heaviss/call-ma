import { describe, it, expect, vi } from 'vitest';
import { buildRoomUrl, getRoomIdFromUrl, copyToClipboard } from '../shared/link.js';

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
