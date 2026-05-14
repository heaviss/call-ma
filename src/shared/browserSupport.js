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
  const win = env.window || (typeof window !== 'undefined' ? window : null);
  const nav = env.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  const RTC = 'RTCPeerConnection' in env ? env.RTCPeerConnection : (typeof RTCPeerConnection !== 'undefined' ? RTCPeerConnection : undefined);

  if (!win || !win.isSecureContext) return { ok: false, reason: 'HTTPS is required.' };
  if (!nav || !nav.mediaDevices) return { ok: false, reason: 'Media devices not available.' };
  if (!RTC) return { ok: false, reason: 'WebRTC not supported in this browser.' };
  return { ok: true, reason: null };
}

export function mapMediaError(error) {
  if (!error) return 'Unknown media error.';
  const name = error.name || '';
  return ERROR_MAP[name] || `Media error: ${error.message || name}`;
}
