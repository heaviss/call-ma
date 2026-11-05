const ROOM_ID_RE = /^[a-z0-9]{8}$/;

export interface LocationLike {
  origin: string;
  pathname: string;
  search?: string;
}

export interface ClipboardNavigatorLike {
  clipboard?: Pick<Clipboard, 'writeText'>;
}

export type DirectLinkType = 'offer' | 'answer';

export interface DirectLink {
  type: DirectLinkType;
  encoded: string;
}

const DIRECT_LINK_TYPES: readonly DirectLinkType[] = ['offer', 'answer'];

function base(locationLike: LocationLike): string {
  return `${locationLike.origin}${locationLike.pathname}${locationLike.search || ''}`;
}

export function buildRoomUrl(locationLike: LocationLike, roomId: string): string {
  return `${base(locationLike)}#${roomId}`;
}

export function getRoomIdFromUrl(url: string): string | null {
  try {
    const val = new URL(url).hash.slice(1);
    return ROOM_ID_RE.test(val) ? val : null;
  } catch {
    return null;
  }
}

export async function copyToClipboard(navigatorLike: ClipboardNavigatorLike | null | undefined, text: string) {
  try {
    if (navigatorLike?.clipboard?.writeText) {
      await navigatorLike.clipboard.writeText(text);
      return true;
    }
  } catch {
    // swallow
  }
  return false;
}

export function buildDirectUrl(locationLike: LocationLike, type: DirectLinkType, encoded: string): string {
  return `${base(locationLike)}#${type}=${encoded}`;
}

export function parseDirectUrl(url: string): DirectLink | null {
  try {
    const params = new URLSearchParams(new URL(url).hash.slice(1));
    const type = DIRECT_LINK_TYPES.find((t) => params.has(t)) ?? null;
    if (!type) { return null; }
    const encoded = params.get(type);
    return encoded ? { type, encoded } : null;
  } catch {
    return null;
  }
}
