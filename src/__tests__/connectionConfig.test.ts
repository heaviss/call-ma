import { describe, expect, it } from 'vitest';

import { DEFAULT_STUN_URLS, getConnectionConfig } from '../shared/config/connection.ts';

const noParams = new URLSearchParams();

describe('getConnectionConfig — ICE servers', () => {
  it('uses the default STUN list when nothing is configured', () => {
    const { iceServers } = getConnectionConfig({ env: {}, searchParams: noParams });

    expect(iceServers).toStrictEqual(DEFAULT_STUN_URLS.map((urls) => ({ urls })));
  });

  it('includes STUN servers reachable from Russia by default', () => {
    expect(DEFAULT_STUN_URLS).toContain('stun:stun.nextcloud.com:3478');
  });

  it('replaces the default STUN list with VITE_STUN_SERVERS', () => {
    const env = { VITE_STUN_SERVERS: ' stun:a.example.com:3478 , stun:b.example.com ' };

    const { iceServers } = getConnectionConfig({ env, searchParams: noParams });

    expect(iceServers).toStrictEqual([{ urls: 'stun:a.example.com:3478' }, { urls: 'stun:b.example.com' }]);
  });

  it('lets ?stun= override VITE_STUN_SERVERS', () => {
    const env = { VITE_STUN_SERVERS: 'stun:env.example.com' };
    const searchParams = new URLSearchParams('stun=stun:url.example.com&stun=stun:url2.example.com');

    const { iceServers } = getConnectionConfig({ env, searchParams });

    expect(iceServers).toStrictEqual([{ urls: 'stun:url.example.com' }, { urls: 'stun:url2.example.com' }]);
  });

  it('ignores ?stun= entries that are not STUN URLs', () => {
    const searchParams = new URLSearchParams('stun=turn:evil.example.com');

    const { iceServers } = getConnectionConfig({ env: {}, searchParams });

    expect(iceServers).toStrictEqual(DEFAULT_STUN_URLS.map((urls) => ({ urls })));
  });

  it('appends TURN servers with credentials from env', () => {
    const env = {
      VITE_STUN_SERVERS: 'stun:a.example.com',
      VITE_TURN_URL: 'turns:t1.example.com:5349,turn:t2.example.com',
      VITE_TURN_USER: 'u',
      VITE_TURN_PASS: 'p',
    };

    const { iceServers } = getConnectionConfig({ env, searchParams: noParams });

    expect(iceServers).toStrictEqual([
      { urls: 'stun:a.example.com' },
      { urls: 'turns:t1.example.com:5349', username: 'u', credential: 'p' },
      { urls: 'turn:t2.example.com', username: 'u', credential: 'p' },
    ]);
  });

  it('never reads TURN from URL params', () => {
    const searchParams = new URLSearchParams('turn=turn:x.example.com');

    const { iceServers } = getConnectionConfig({ env: {}, searchParams });

    expect(iceServers.some(({ urls }) => String(urls).startsWith('turn'))).toBe(false);
  });
});

describe('getConnectionConfig — relays', () => {
  it('has no relay overrides when nothing is configured', () => {
    const config = getConnectionConfig({ env: {}, searchParams: noParams });

    expect(config.mqttRelayUrls).toBeUndefined();
    expect(config.torrentRelayUrls).toBeUndefined();
  });

  it('reads wss:// relays from env and drops other schemes', () => {
    const env = {
      VITE_MQTT_RELAYS: 'wss://a.example.com/mqtt,ws://insecure.example.com',
      VITE_TORRENT_TRACKERS: 'wss://t.example.com',
    };

    const config = getConnectionConfig({ env, searchParams: noParams });

    expect(config.mqttRelayUrls).toStrictEqual(['wss://a.example.com/mqtt']);
    expect(config.torrentRelayUrls).toStrictEqual(['wss://t.example.com']);
  });

  it('lets URL params override env relays', () => {
    const env = { VITE_MQTT_RELAYS: 'wss://env.example.com', VITE_TORRENT_TRACKERS: 'wss://env-t.example.com' };
    const searchParams = new URLSearchParams('mqttRelay=wss://url.example.com&torrentTracker=wss://url-t.example.com');

    const config = getConnectionConfig({ env, searchParams });

    expect(config.mqttRelayUrls).toStrictEqual(['wss://url.example.com']);
    expect(config.torrentRelayUrls).toStrictEqual(['wss://url-t.example.com']);
  });
});
