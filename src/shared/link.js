const ROOM_ID_RE = /^[a-z0-9]{8}$/;

export function buildRoomUrl(locationLike, roomId) {
  const base = `${locationLike.origin}${locationLike.pathname}${locationLike.search || ''}`;
  return `${base}#${roomId}`;
}

export function getRoomIdFromUrl(url) {
  try {
    const hash = new URL(url).hash;
    const val = hash.startsWith('#') ? hash.slice(1) : hash;
    return ROOM_ID_RE.test(val) ? val : null;
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

export function buildDirectUrl(locationLike, type, encoded) {
  const base = `${locationLike.origin}${locationLike.pathname}${locationLike.search || ''}`;
  return `${base}#${type}=${encoded}`;
}

export function parseDirectUrl(url) {
  try {
    const hash = new URL(url).hash.slice(1);
    const eq = hash.indexOf('=');
    if (eq === -1) return null;
    const type = hash.slice(0, eq);
    if (type !== 'offer' && type !== 'answer') return null;
    const encoded = hash.slice(eq + 1);
    return encoded ? { type, encoded } : null;
  } catch {
    return null;
  }
}
