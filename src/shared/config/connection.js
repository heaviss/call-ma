// Google first for everyone else; the rest answer from Russia per OONI 2026 (Google does not).
export const DEFAULT_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun.nextcloud.com:3478',
  'stun:stun.sonetel.com',
  'stun:stun.telnyx.com',
];

const splitList = (value) => (typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);

const fromParams = (searchParams, key) => searchParams.getAll(key).flatMap(splitList);

function pick(searchParams, key, envValue, isValid) {
  const fromUrl = fromParams(searchParams, key).filter(isValid);
  if (fromUrl.length > 0) return fromUrl;
  const fromEnv = splitList(envValue).filter(isValid);
  return fromEnv.length > 0 ? fromEnv : undefined;
}

const isWss = (url) => url.startsWith('wss://');
const isStun = (url) => /^stuns?:/i.test(url);

/**
Everything a call needs to reach peers, read once from the build env and the page URL.
URL params win over env and travel in shared links; TURN credentials come from env only.
*/
export function getConnectionConfig({ env, searchParams }) {
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
