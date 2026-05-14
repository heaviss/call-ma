const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:global.stun.twilio.com:3478?transport=udp',
];

function parseServers(str) {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getStunServers(env) {
  const e = env ?? (typeof process !== 'undefined' ? process.env : undefined) ?? {};
  const override = e.STUN_SERVERS;
  if (override && typeof override === 'string') {
    return parseServers(override);
  }
  return DEFAULT_STUN_SERVERS.slice();
}

export { DEFAULT_STUN_SERVERS };
