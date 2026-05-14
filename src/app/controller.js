import { TrysteroAdapter } from '../connection/trysteroAdapter.js';
import { buildRoomUrl, getRoomIdFromUrl, copyToClipboard } from '../shared/link.js';
import { createLogger } from './logger.js';
import { checkSupport, mapMediaError } from '../shared/browserSupport.js';

function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * 36)]).join('');
}

export function initApp({ document, window, navigator, joinRoom }) {
  const state = { link: null };

  const createBtn   = document.querySelector('#createBtn');
  const copyBtn     = document.querySelector('#copyBtn');
  const localVideo  = document.querySelector('#localVideo');
  const remoteVideo = document.querySelector('#remoteVideo');
  const logsEl      = document.querySelector('#logs');

  const logger = logsEl ? createLogger(logsEl) : { log() {}, clear() {} };

  const support = checkSupport({ window, navigator, RTCPeerConnection: window.RTCPeerConnection });
  if (!support.ok) logger.log(`Warning: ${support.reason}`);

  async function getMedia() {
    try {
      return navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ? await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        : Promise.reject(new Error('mediaDevices not available'));
    } catch (error) {
      logger.log(mapMediaError(error));
      throw error;
    }
  }

  async function onCreate(roomId = generateRoomId()) {
    logger.log('Getting camera/microphone...');
    const stream = await getMedia();
    if (localVideo) localVideo.srcObject = stream;

    const url = buildRoomUrl(window.location, roomId);
    state.link = url;

    const adapter = new TrysteroAdapter({ joinRoom });
    adapter
      .onStream((remote) => { if (remoteVideo) remoteVideo.srcObject = remote; })
      .onConnect(()      => { logger.log('Peer joined — connected!'); })
      .onError((err)     => { logger.log(`Connection error: ${err.message}`); })
      .onPeerLeave(()    => { logger.log('Peer left.'); })
      .join(roomId, stream);

    if (copyBtn) copyBtn.disabled = false;
    logger.log(`Connecting via Nostr… Share this link: ${  url}`);
  }

  if (createBtn) createBtn.addEventListener('click', () => { onCreate(); });

  if (copyBtn) copyBtn.addEventListener('click', async () => {
    try {
      if (state.link) {
        const ok = await copyToClipboard(navigator, state.link);
        logger.log(ok ? 'Link copied to clipboard.' : 'Could not copy — copy the link manually from the address bar.');
      }
    } catch {}
  });

  const hashRoomId = getRoomIdFromUrl(window.location.href);
  if (hashRoomId) onCreate(hashRoomId);

  return { state, onCreate };
}
