// Google first for everyone else; the rest answer from Russia per OONI 2026 (Google does not).
export const DEFAULT_STUN_URLS: readonly string[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun.nextcloud.com:3478',
  'stun:stun.sonetel.com',
  'stun:stun.telnyx.com',
];

export interface ConnectionEnv {
  VITE_STUN_SERVERS?: string;
  VITE_MQTT_RELAYS?: string;
  VITE_TORRENT_TRACKERS?: string;
  VITE_TURN_URL?: string;
  VITE_TURN_USER?: string;
  VITE_TURN_PASS?: string;
}

export interface ConnectionConfig {
  iceServers: RTCIceServer[];
  mqttRelayUrls: string[] | undefined;
  torrentRelayUrls: string[] | undefined;
}

const splitList = (value: unknown): string[] => (typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);

const fromParams = (searchParams: URLSearchParams, key: string): string[] => searchParams.getAll(key).flatMap(splitList);

function pick(searchParams: URLSearchParams, key: string, envValue: string | undefined, isValid: (url: string) => boolean): string[] | undefined {
  const fromUrl = fromParams(searchParams, key).filter(isValid);
  if (fromUrl.length > 0) { return fromUrl; }
  const fromEnv = splitList(envValue).filter(isValid);
  return fromEnv.length > 0 ? fromEnv : undefined;
}

const isWss = (url: string): boolean => url.startsWith('wss://');
const isStun = (url: string): boolean => /^stuns?:/i.test(url);

/**
Everything a call needs to reach peers, read once from the build env and the page URL.
URL params win over env and travel in shared links; TURN credentials come from env only.
*/
export function getConnectionConfig({ env, searchParams }: { env: ConnectionEnv; searchParams: URLSearchParams }): ConnectionConfig {
  const stunUrls = pick(searchParams, 'stun', env.VITE_STUN_SERVERS, isStun) ?? DEFAULT_STUN_URLS;
  const credentials = {
    ...(env.VITE_TURN_USER && { username: env.VITE_TURN_USER }),
    ...(env.VITE_TURN_PASS && { credential: env.VITE_TURN_PASS }),
  };

  return {
    iceServers: [
      ...stunUrls.map((urls) => ({ urls })),
      ...splitList(env.VITE_TURN_URL).map((urls) => ({ urls, ...credentials })),
    ],
    mqttRelayUrls: pick(searchParams, 'mqttRelay', env.VITE_MQTT_RELAYS, isWss),
    torrentRelayUrls: pick(searchParams, 'torrentTracker', env.VITE_TORRENT_TRACKERS, isWss),
  };
}
