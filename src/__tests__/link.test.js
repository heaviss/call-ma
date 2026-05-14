import { describe, it, expect, vi } from 'vitest';
import { buildSignalUrl, parseSignalFromUrl, copyToClipboard } from '../shared/link.js';
import { CODEC_VERSION } from '../shared/codec.js';

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
  it('builds a URL with hash-encoded signal', () => {
    // Arrange
    const location = makeLocation('https://example.com/app/index.html');
    const encoded = `${CODEC_VERSION}.AAA`;

    // Act
    const url = buildSignalUrl(location, encoded);

    // Assert
    expect(url).toBe('https://example.com/app/index.html#' + encoded);
  });

  it('parses signal from URL hash when present', () => {
    // Arrange
    const encoded = `${CODEC_VERSION}.BBBB`;
    const url = 'https://x.y/#' + encoded;

    // Act
    const parsed = parseSignalFromUrl(url);

    // Assert
    expect(parsed).toBe(encoded);
  });

  it('returns null when URL has no hash signal', () => {
    // Arrange
    const url = 'https://x.y/'

    // Act
    const parsed = parseSignalFromUrl(url);

    // Assert
    expect(parsed).toBeNull();
  });

  it('copies full link to clipboard via abstraction', async () => {
    // Arrange
    const writeText = vi.fn().mockResolvedValue(undefined);
    const navigatorLike = { clipboard: { writeText } };
    const text = 'hello';

    // Act
    const ok = await copyToClipboard(navigatorLike, text);

    // Assert
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith(text);
  });

  it('returns false if clipboard not available', async () => {
    // Arrange
    const ok = await copyToClipboard({}, 'x');

    // Act / Assert
    expect(ok).toBe(false);
  });
});
