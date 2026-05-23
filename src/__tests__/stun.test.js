import { describe, it, expect } from 'vitest';
import { getIceServers, getTurnConfig, getStunServers, DEFAULT_ICE_SERVERS } from '../shared/config/stun.js';

describe('getIceServers', () => {
  it('returns DEFAULT_ICE_SERVERS when no override is given', () => {
    const result = getIceServers({});

    expect(result).toEqual(DEFAULT_ICE_SERVERS);
  });

  it('returns a different array reference than DEFAULT_ICE_SERVERS', () => {
    const result = getIceServers({});

    expect(result).not.toBe(DEFAULT_ICE_SERVERS);
  });

  it('returns parsed servers when STUN_SERVERS env var is set', () => {
    const result = getIceServers({ STUN_SERVERS: 'stun:a.example.com:3478,stun:b.example.com:3478' });

    expect(result).toEqual([
      { urls: 'stun:a.example.com:3478' },
      { urls: 'stun:b.example.com:3478' },
    ]);
  });

  it('trims whitespace from STUN_SERVERS entries', () => {
    const result = getIceServers({ STUN_SERVERS: ' stun:a.example.com , stun:b.example.com ' });

    expect(result).toEqual([
      { urls: 'stun:a.example.com' },
      { urls: 'stun:b.example.com' },
    ]);
  });

  it('falls back to globalThis.process.env when env is undefined', () => {
    const original = globalThis.process;
    globalThis.process = { env: { STUN_SERVERS: 'stun:env.example.com:3478' } };
    try {
      expect(getIceServers(undefined)).toEqual([{ urls: 'stun:env.example.com:3478' }]);
    } finally {
      globalThis.process = original;
    }
  });
});

describe('getTurnConfig', () => {
  it('returns undefined when TURN_URL is not set', () => {
    expect(getTurnConfig({})).toBeUndefined();
  });

  it('returns undefined when TURN_URL is not a string', () => {
    expect(getTurnConfig({ TURN_URL: 42 })).toBeUndefined();
  });

  it('returns a config array when TURN_URL is set', () => {
    const result = getTurnConfig({ TURN_URL: 'turns:turn.example.com:5349' });

    expect(result).toEqual([{ urls: 'turns:turn.example.com:5349' }]);
  });

  it('includes username and credential when TURN_USER and TURN_PASS are set', () => {
    const result = getTurnConfig({
      TURN_URL: 'turns:turn.example.com:5349',
      TURN_USER: 'myuser',
      TURN_PASS: 'mypass',
    });

    expect(result).toEqual([
      { urls: 'turns:turn.example.com:5349', username: 'myuser', credential: 'mypass' },
    ]);
  });

  it('handles multiple comma-separated TURN_URL entries', () => {
    const result = getTurnConfig({ TURN_URL: 'turns:a.example.com,turns:b.example.com' });

    expect(result).toEqual([
      { urls: 'turns:a.example.com' },
      { urls: 'turns:b.example.com' },
    ]);
  });

  it('omits username when only TURN_PASS is set', () => {
    const result = getTurnConfig({ TURN_URL: 'turns:turn.example.com', TURN_PASS: 'pass' });

    expect(result[0]).not.toHaveProperty('username');
    expect(result[0]).toHaveProperty('credential', 'pass');
  });
});

describe('getStunServers', () => {
  it('is an alias for getIceServers', () => {
    expect(getStunServers).toBe(getIceServers);
  });
});

describe('DEFAULT_ICE_SERVERS', () => {
  it('contains at least one Google STUN server', () => {
    expect(DEFAULT_ICE_SERVERS.some((s) => s.urls.includes('stun.l.google.com'))).toBe(true);
  });
});
