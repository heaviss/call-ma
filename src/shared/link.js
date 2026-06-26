const ROOM_ID_RE = /^[a-z0-9]{8}$/;

function base(locationLike) {
  return `${locationLike.origin}${locationLike.pathname}${locationLike.search || ''}`;
}

export function buildRoomUrl(locationLike, roomId) {
  return `${base(locationLike)}#${roomId}`;
}

export function getRoomIdFromUrl(url) {
  try {
    const val = new URL(url).hash.slice(1);
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
  return `${base(locationLike)}#${type}=${encoded}`;
}

export function parseDirectUrl(url) {
  try {
    const params = new URLSearchParams(new URL(url).hash.slice(1));
    const type = ['offer', 'answer'].find((t) => params.has(t)) ?? null;
    if (!type) return null;
    const encoded = params.get(type);
    return encoded ? { type, encoded } : null;
  } catch {
    return null;
  }
}
