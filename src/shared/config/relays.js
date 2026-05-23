function parseWssUrls(str) {
  return str.split(',').map((s) => s.trim()).filter((s) => s.startsWith('wss://'));
}

function fromUrlParam(searchParams, key) {
  const vals = searchParams
    ?.getAll(key)
    .flatMap((v) => v.split(',').map((s) => s.trim()))
    .filter((s) => s.startsWith('wss://'));
  return vals?.length ? vals : undefined;
}

function fromEnv(env, key) {
  const e = env ?? (globalThis.process?.env) ?? {};
  const v = e[key];
  return v && typeof v === 'string' ? parseWssUrls(v) : undefined;
}

export function getMqttRelayUrls(env, searchParams) {
  return fromUrlParam(searchParams, 'mqttRelay') ?? fromEnv(env, 'MQTT_RELAYS');
}

export function getTorrentRelayUrls(env, searchParams) {
  return fromUrlParam(searchParams, 'torrentTracker') ?? fromEnv(env, 'TORRENT_TRACKERS');
}
