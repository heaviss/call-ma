const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function parseServers(str) {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ urls: url }));
}

export function getIceServers(env) {
  const e = env ?? (globalThis.process?.env) ?? {};
  const override = e.STUN_SERVERS;
  if (override && typeof override === 'string') {
    return parseServers(override);
  }
  return [...DEFAULT_ICE_SERVERS];
}

// backward compat alias
export const getStunServers = getIceServers;

export { DEFAULT_ICE_SERVERS };
