import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMqttRelayUrls, getTorrentRelayUrls } from '../shared/config/relays.js';

describe('getMqttRelayUrls', () => {
  let originalProcess;

  beforeEach(() => {
    originalProcess = globalThis.process;
    globalThis.process = { env: {} };
  });

  afterEach(() => {
    globalThis.process = originalProcess;
  });

  it('returns undefined when no env var and no URL params', () => {
    expect(getMqttRelayUrls(undefined, new URLSearchParams())).toBeUndefined();
  });

  it('reads MQTT_RELAYS env var (single URL)', () => {
    const result = getMqttRelayUrls({ MQTT_RELAYS: 'wss://broker.example.com:8084/mqtt' }, new URLSearchParams());
    expect(result).toEqual(['wss://broker.example.com:8084/mqtt']);
  });

  it('reads MQTT_RELAYS env var (comma-separated)', () => {
    const result = getMqttRelayUrls(
      { MQTT_RELAYS: 'wss://broker-a.example.com:8084/mqtt,wss://broker-b.example.com:8084/mqtt' },
      new URLSearchParams(),
    );
    expect(result).toEqual([
      'wss://broker-a.example.com:8084/mqtt',
      'wss://broker-b.example.com:8084/mqtt',
    ]);
  });

  it('reads ?mqttRelay= URL param', () => {
    const result = getMqttRelayUrls(undefined, new URLSearchParams('mqttRelay=wss://broker.example.com:8084/mqtt'));
    expect(result).toEqual(['wss://broker.example.com:8084/mqtt']);
  });

  it('URL param overrides env var', () => {
    const result = getMqttRelayUrls(
      { MQTT_RELAYS: 'wss://env.example.com:8084/mqtt' },
      new URLSearchParams('mqttRelay=wss://url.example.com:8084/mqtt'),
    );
    expect(result).toEqual(['wss://url.example.com:8084/mqtt']);
  });

  it('filters out non-wss entries from env var', () => {
    const result = getMqttRelayUrls(
      { MQTT_RELAYS: 'wss://good.example.com,ws://bad.example.com,http://also-bad.example.com' },
      new URLSearchParams(),
    );
    expect(result).toEqual(['wss://good.example.com']);
  });

  it('filters out non-wss entries from URL param', () => {
    const result = getMqttRelayUrls(
      undefined,
      new URLSearchParams('mqttRelay=ws://bad.example.com'),
    );
    expect(result).toBeUndefined();
  });
});

describe('getTorrentRelayUrls', () => {
  it('returns undefined when no env var and no URL params', () => {
    expect(getTorrentRelayUrls(undefined, new URLSearchParams())).toBeUndefined();
  });

  it('reads TORRENT_TRACKERS env var', () => {
    const result = getTorrentRelayUrls(
      { TORRENT_TRACKERS: 'wss://tracker.example.com' },
      new URLSearchParams(),
    );
    expect(result).toEqual(['wss://tracker.example.com']);
  });

  it('reads ?torrentTracker= URL param', () => {
    const result = getTorrentRelayUrls(
      undefined,
      new URLSearchParams('torrentTracker=wss://tracker.example.com'),
    );
    expect(result).toEqual(['wss://tracker.example.com']);
  });

  it('URL param overrides env var', () => {
    const result = getTorrentRelayUrls(
      { TORRENT_TRACKERS: 'wss://env-tracker.example.com' },
      new URLSearchParams('torrentTracker=wss://url-tracker.example.com'),
    );
    expect(result).toEqual(['wss://url-tracker.example.com']);
  });
});
