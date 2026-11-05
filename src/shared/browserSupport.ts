const ERROR_MAP: Readonly<Partial<Record<string, string>>> = {
  NotAllowedError: 'Camera/mic permission denied.',
  PermissionDeniedError: 'Camera/mic permission denied.',
  NotFoundError: 'No camera or microphone found.',
  DevicesNotFoundError: 'No camera or microphone found.',
  NotReadableError: 'Camera or mic is already in use.',
  TrackStartError: 'Camera or mic is already in use.',
  OverconstrainedError: 'Camera/mic does not meet constraints.',
  TypeError: 'Invalid media constraints.',
};

export interface SupportEnv {
  window?: { isSecureContext: boolean } | null | undefined;
  navigator?: { mediaDevices?: unknown } | null | undefined;
  RTCPeerConnection?: unknown;
}

export type SupportResult = { ok: true; reason: null } | { ok: false; reason: string };

// Read at call time; tests and SSR-like environments may lack any of these globals.
const runtime: SupportEnv = globalThis;

function secureContextProblem(env: SupportEnv): string | null {
  const win = env.window ?? runtime.window;
  return win?.isSecureContext ? null : 'HTTPS is required.';
}

function mediaDevicesProblem(env: SupportEnv): string | null {
  const nav = env.navigator ?? runtime.navigator;
  return nav?.mediaDevices ? null : 'Media devices not available.';
}

function webRtcProblem(env: SupportEnv): string | null {
  const rtc = 'RTCPeerConnection' in env ? env.RTCPeerConnection : runtime.RTCPeerConnection;
  return rtc ? null : 'WebRTC not supported in this browser.';
}

const SUPPORT_CHECKS = [secureContextProblem, mediaDevicesProblem, webRtcProblem];

/**
Whether this browser can make a call; reports the first missing capability.
@param env Overrides for `window`, `navigator` and `RTCPeerConnection`; globals fill the gaps.
@returns `ok: true`, or `ok: false` with a user-facing reason.
*/
export function checkSupport(env: SupportEnv = {}): SupportResult {
  for (const check of SUPPORT_CHECKS) {
    const reason = check(env);
    if (reason !== null) {
      return { ok: false, reason };
    }
  }
  return { ok: true, reason: null };
}

/**
User-facing text for a `getUserMedia` failure.
@param error Whatever `getUserMedia` rejected with.
@returns A known message for standard error names, otherwise the raw message.
*/
export function mapMediaError(error: unknown): string {
  if (!error) {
    return 'Unknown media error.';
  }
  const mediaError = error as Partial<Error>;
  const name = mediaError.name ?? '';
  return ERROR_MAP[name] ?? `Media error: ${mediaError.message || name}`;
}
