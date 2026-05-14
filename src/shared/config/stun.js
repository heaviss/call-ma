const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:openrelay.metered.ca:80' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

function parseServers(str) {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ urls: url }));
}

export function getIceServers(env) {
  const e = env ?? (typeof process !== 'undefined' ? process.env : undefined) ?? {};
  const override = e.STUN_SERVERS;
  if (override && typeof override === 'string') {
    return parseServers(override);
  }
  return DEFAULT_ICE_SERVERS.slice();
}

// backward compat alias
export const getStunServers = getIceServers;

export { DEFAULT_ICE_SERVERS };
