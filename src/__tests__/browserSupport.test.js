import { describe, it, expect } from 'vitest';
import { checkSupport, mapMediaError } from '../shared/browserSupport.js';

function fakeEnv(overrides = {}) {
  return {
    window: { isSecureContext: true, ...overrides.window },
    navigator: { mediaDevices: {}, ...overrides.navigator },
    RTCPeerConnection () {},
    ...overrides,
  };
}

describe('checkSupport', () => {
  it('returns ok:true in a fully capable environment', () => {
    expect(checkSupport(fakeEnv())).toEqual({ ok: true, reason: null });
  });

  it('returns ok:false when not a secure context', () => {
    const { ok, reason } = checkSupport(fakeEnv({ window: { isSecureContext: false } }));

    expect(ok).toBe(false);
    expect(reason).toMatch(/https/i);
  });

  it('returns ok:false when mediaDevices is missing', () => {
    const { ok, reason } = checkSupport(fakeEnv({ navigator: {} }));

    expect(ok).toBe(false);
    expect(reason).toMatch(/media/i);
  });

  it('returns ok:false when RTCPeerConnection is missing', () => {
    const env = fakeEnv();
    env.RTCPeerConnection = undefined;

    const { ok, reason } = checkSupport(env);

    expect(ok).toBe(false);
    expect(reason).toMatch(/webrtc/i);
  });
});

describe('mapMediaError', () => {
  it('maps NotAllowedError to permission denied message', () => {
    const err = new DOMException('denied', 'NotAllowedError');

    expect(mapMediaError(err)).toMatch(/permission denied/i);
  });

  it('maps PermissionDeniedError to permission denied message', () => {
    const err = new DOMException('denied', 'PermissionDeniedError');

    expect(mapMediaError(err)).toMatch(/permission denied/i);
  });

  it('maps NotFoundError to no device found message', () => {
    const err = new DOMException('nope', 'NotFoundError');

    expect(mapMediaError(err)).toMatch(/no camera/i);
  });

  it('maps NotReadableError to in-use message', () => {
    const err = new DOMException('busy', 'NotReadableError');

    expect(mapMediaError(err)).toMatch(/already in use/i);
  });

  it('returns a generic message for unknown error names', () => {
    const err = new DOMException('weird', 'WeirdError');

    expect(mapMediaError(err)).toMatch(/media error/i);
  });

  it('handles null gracefully', () => {
    expect(mapMediaError(null)).toMatch(/unknown/i);
  });
});
