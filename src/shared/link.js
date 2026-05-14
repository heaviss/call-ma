export function buildSignalUrl(locationLike, encoded) {
  const base = `${locationLike.origin}${locationLike.pathname}${locationLike.search || ''}`;
  return `${base}#${encoded}`;
}

export function parseSignalFromUrl(url) {
  try {
    const u = new URL(url);
    const hash = u.hash || '';
    const val = hash.startsWith('#') ? hash.slice(1) : hash;
    return val ? val : null;
  } catch {
    return null;
  }
}

export async function copyToClipboard(navigatorLike, text) {
  try {
    if (navigatorLike && navigatorLike.clipboard && navigatorLike.clipboard.writeText) {
      await navigatorLike.clipboard.writeText(text);
      return true;
    }
  } catch {
    // swallow
  }
  return false;
}
