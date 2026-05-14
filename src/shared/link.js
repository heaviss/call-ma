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
