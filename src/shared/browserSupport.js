const ERROR_MAP = {
  NotAllowedError: 'Camera/mic permission denied.',
  PermissionDeniedError: 'Camera/mic permission denied.',
  NotFoundError: 'No camera or microphone found.',
  DevicesNotFoundError: 'No camera or microphone found.',
  NotReadableError: 'Camera or mic is already in use.',
  TrackStartError: 'Camera or mic is already in use.',
  OverconstrainedError: 'Camera/mic does not meet constraints.',
  TypeError: 'Invalid media constraints.',
};

export function checkSupport(env = {}) {
  const win = env.window || globalThis.window || null;
  if (!win || !win.isSecureContext) return { ok: false, reason: 'HTTPS is required.' };

  const nav = env.navigator || globalThis.navigator || null;
  if (!nav || !nav.mediaDevices) return { ok: false, reason: 'Media devices not available.' };

  // eslint-disable-next-line unicorn/no-unnecessary-global-this -- feature detection: bare RTCPeerConnection throws ReferenceError where WebRTC is absent
  const RTC = 'RTCPeerConnection' in env ? env.RTCPeerConnection : globalThis.RTCPeerConnection;
  return RTC ? { ok: true, reason: null } : { ok: false, reason: 'WebRTC not supported in this browser.' };
}

export function mapMediaError(error) {
  if (!error) return 'Unknown media error.';
  const name = error.name || '';
  return ERROR_MAP[name] || `Media error: ${error.message || name}`;
}
