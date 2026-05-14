import { SimplePeerAdapter } from '../connection/simplePeerAdapter.js';
import { CODEC_VERSION, encodeSignal, decodeSignal } from '../shared/codec.js';
import { buildSignalUrl, parseSignalFromUrl, copyToClipboard } from '../shared/link.js';
import { createLogger } from './logger.js';
import { checkSupport, mapMediaError } from '../shared/browserSupport.js';
import { deriveMetrics } from '../shared/stats.js';

export function initApp({ document, window, navigator, PeerCtor, peerConfig }) {
  const state = { role: null, link: null };

  const createBtn = document.getElementById('createBtn');
  const copyBtn = document.getElementById('copyBtn');
  const inviteInput = document.getElementById('inviteInput');
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const logsEl = document.getElementById('logs');

  const logger = logsEl ? createLogger(logsEl) : { log() {}, clear() {} };

  const support = checkSupport({ window, navigator, RTCPeerConnection: window.RTCPeerConnection });
  if (!support.ok) logger.log(`Warning: ${support.reason}`);

  const adapter = new SimplePeerAdapter({ PeerCtor, config: peerConfig });

  async function getMedia() {
    try {
      return navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ? await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        : Promise.reject(new Error('mediaDevices not available'));
    } catch (err) {
      logger.log(mapMediaError(err));
      throw err;
    }
  }

  function watchIceState() {
    const pc = adapter.getPeerConnection();
    if (!pc) return;
    pc.addEventListener('iceconnectionstatechange', () => {
      logger.log(`ICE: ${pc.iceConnectionState}`);
    });
    pc.addEventListener('icegatheringstatechange', () => {
      logger.log(`ICE gathering: ${pc.iceGatheringState}`);
    });
  }

  function startStatsPolling() {
    let prevReport = null;
    let prevTimestamp = null;
    const interval = setInterval(async () => {
      const pc = adapter.getPeerConnection();
      if (!pc) return;
      try {
        const report = await pc.getStats();
        const now = Date.now();
        const delta = prevTimestamp ? now - prevTimestamp : 0;
        const { rtt, bitrate, frameRate } = deriveMetrics(report, prevReport, delta);
        prevReport = report;
        prevTimestamp = now;
        logger.log(
          `RTT: ${rtt != null ? Math.round(rtt) + 'ms' : '?'}  ` +
          `Bitrate: ${bitrate != null ? bitrate.toFixed(1) + 'kbps' : '?'}  ` +
          `FPS: ${frameRate != null ? frameRate : '?'}`
        );
      } catch {}
    }, 2000);
    return interval;
  }

  function wireAdapter() {
    let statsInterval = null;
    adapter
      .onError((err) => {
        logger.log(`Connection error: ${err.message}. Try again.`);
        if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
      })
      .onClose(() => {
        logger.log('Connection closed.');
        if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
      })
      .onConnect(() => {
        logger.log('Connected!');
        statsInterval = startStatsPolling();
      });
  }

  async function onCreate() {
    logger.log('Getting camera/microphone...');
    const stream = await getMedia();
    if (localVideo) localVideo.srcObject = stream;

    wireAdapter();
    adapter
      .onSignal((sp) => {
        state.role = 'offer';
        const payload = { v: CODEC_VERSION, role: 'offer', sp };
        const encoded = encodeSignal(payload);
        const url = buildSignalUrl(window.location, encoded);
        state.link = url;
        if (copyBtn) copyBtn.disabled = false;
        logger.log('Offer ready. Copy the link and send it to the other person.');
      })
      .onStream((remote) => {
        if (remoteVideo) remoteVideo.srcObject = remote;
      })
      .createInitiator(stream);

    watchIceState();
    logger.log('Gathering ICE candidates...');
  }

  async function onLoadMaybeAnswer() {
    const encoded = parseSignalFromUrl(window.location.href);
    if (!encoded) return;
    let offer;
    try {
      offer = decodeSignal(encoded);
    } catch {
      return;
    }
    if (!offer || offer.role !== 'offer') return;

    logger.log('Offer detected. Getting camera/microphone...');
    const stream = await getMedia();
    if (localVideo) localVideo.srcObject = stream;

    wireAdapter();
    adapter
      .onSignal((sp) => {
        state.role = 'answer';
        const payload = { v: CODEC_VERSION, role: 'answer', sp };
        const encodedAns = encodeSignal(payload);
        const url = buildSignalUrl(window.location, encodedAns);
        state.link = url;
        if (copyBtn) copyBtn.disabled = false;
        logger.log('Answer ready. Copy the link and send it back to the other person.');
      })
      .onStream((remote) => {
        if (remoteVideo) remoteVideo.srcObject = remote;
      })
      .createResponder(stream);

    watchIceState();

    try {
      adapter.signal(offer.sp);
      logger.log('Processing offer, gathering ICE candidates...');
    } catch (err) {
      logger.log(`Failed to process offer: ${err.message}`);
    }
  }

  if (createBtn) createBtn.addEventListener('click', () => { onCreate(); });

  if (copyBtn) copyBtn.addEventListener('click', async () => {
    try {
      if (state.link) {
        const ok = await copyToClipboard(navigator, state.link);
        logger.log(ok ? 'Link copied to clipboard.' : 'Could not copy — select and copy the link manually from the address bar.');
      }
    } catch {}
  });

  if (inviteInput) {
    inviteInput.addEventListener('input', () => {
      const val = inviteInput.value.trim();
      if (!val) return;
      const encoded = parseSignalFromUrl(val);
      if (!encoded) return;
      let signal;
      try {
        signal = decodeSignal(encoded);
      } catch {
        logger.log('Could not parse pasted link — make sure you copied the full URL.');
        return;
      }
      if (!signal || signal.role !== 'answer') return;
      if (!adapter.peer) {
        logger.log('No active call — click "Create Conference" first, then paste the answer link.');
        return;
      }
      try {
        adapter.signal(signal.sp);
        logger.log('Answer received. Completing handshake...');
      } catch (err) {
        logger.log(`Failed to process answer: ${err.message}`);
      }
    });
  }

  onLoadMaybeAnswer();

  return { state, onCreate };
}
