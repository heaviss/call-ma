import { TrysteroAdapter } from '../connection/trysteroAdapter.js';
import { buildRoomUrl, getRoomIdFromUrl, copyToClipboard, buildDirectUrl, parseDirectUrl } from '../shared/link.js';
import { createLogger } from './logger.js';
import { checkSupport, mapMediaError } from '../shared/browserSupport.js';
import { getTurnConfig, getIceServers } from '../shared/config/stun.js';
import QRCode from 'qrcode';
import { DirectAdapter } from '../connection/directAdapter.js';

function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * 36)]).join('');
}

export function initApp({ document, window, navigator, joinRoom, transports }) {
  const state = { link: null };

  const createBtn   = document.querySelector('#createBtn');
  const copyBtn     = document.querySelector('#copyBtn');
  const localVideo  = document.querySelector('#localVideo');
  const remoteVideo = document.querySelector('#remoteVideo');
  const logsEl      = document.querySelector('#logs');
  const logsSection = document.querySelector('#logsSection');
  const directBtn         = document.querySelector('#directBtn');
  const directPanel       = document.querySelector('#directPanel');
  const directQr          = document.querySelector('#directQr');
  const directCopyBtn     = document.querySelector('#directCopyBtn');
  const directStatus      = document.querySelector('#directStatus');
  const directAnswerInput = document.querySelector('#directAnswerInput');
  const directConnectBtn  = document.querySelector('#directConnectBtn');

  if (typeof CompressionStream === 'undefined' && directBtn) {
    directBtn.hidden = true;
  }

  if (logsSection && new URLSearchParams(window.location.search).get('debug') === 'true') {
    logsSection.hidden = false;
  }

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

  async function startDirectMode(offerEncoded = null) {
    if (directPanel) directPanel.hidden = false;

    const iceServers = getIceServers();
    const turnConfig = getTurnConfig();
    const directAdapter = new DirectAdapter({
      iceServers,
      turnConfig,
      PeerConnection: (cfg) => new window.RTCPeerConnection(cfg),
    });

    directAdapter
      .onStream((remote) => { if (remoteVideo) remoteVideo.srcObject = remote; })
      .onConnect(()       => { logger.log('Direct connection established!'); })
      .onError((err)      => { logger.log(`Direct connection error: ${err.message}`); });

    let encodedSdp;
    try {
      const stream = await getMedia();
      if (localVideo) localVideo.srcObject = stream;

      if (offerEncoded) {
        encodedSdp = await directAdapter.createAnswer(offerEncoded, stream);
        if (directStatus) directStatus.textContent = 'Share your answer with the caller:';
      } else {
        encodedSdp = await directAdapter.createOffer(stream);
        if (directStatus) directStatus.textContent = 'Share this with the other person:';
        if (directConnectBtn) directConnectBtn.disabled = false;
      }
    } catch {
      return;
    }

    const directUrl = buildDirectUrl(
      window.location,
      offerEncoded ? 'answer' : 'offer',
      encodedSdp,
    );

    if (directQr) {
      try {
        await QRCode.toCanvas(directQr, directUrl, { width: 256, margin: 2 });
      } catch {
        logger.log('QR rendering failed. Use the copy button instead.');
      }
    }
    if (directCopyBtn) {
      directCopyBtn.disabled = false;
      directCopyBtn.addEventListener('click', async () => {
        await copyToClipboard(navigator, directUrl);
        logger.log('Direct link copied.');
      });
    }

    if (directConnectBtn && !offerEncoded) {
      directConnectBtn.addEventListener('click', async () => {
        const inputUrl = directAnswerInput?.value ?? '';
        const parsed = parseDirectUrl(inputUrl);
        if (!parsed || parsed.type !== 'answer') {
          logger.log('Invalid answer link — paste the link from the other person.');
          return;
        }
        try {
          await directAdapter.applyAnswer(parsed.encoded);
        } catch (error) {
          logger.log(`Direct connect error: ${error.message}`);
        }
      });
    }
  }

  async function onCreate(roomId = generateRoomId()) {
    logger.log('Getting camera/microphone...');
    const stream = await getMedia();
    if (localVideo) localVideo.srcObject = stream;

    const url = buildRoomUrl(window.location, roomId);
    state.link = url;

    const turnConfig = getTurnConfig();
    const adapter = new TrysteroAdapter({ joinRoom, transports, turnConfig });
    adapter
      .onStream((remote) => { if (remoteVideo) remoteVideo.srcObject = remote; })
      .onConnect(()      => { logger.log('Peer joined — connected!'); })
      .onError((err)     => { logger.log(`Connection error: ${err.message}`); })
      .onPeerLeave(()    => { logger.log('Peer left.'); })
      .join(roomId, stream);

    if (copyBtn) copyBtn.disabled = false;
    logger.log(`Connecting… Share this link: ${url}`);
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

  if (directBtn) {
    let directStarted = false;
    directBtn.addEventListener('click', () => {
      if (directStarted) return;
      directStarted = true;
      startDirectMode().catch(
        /* v8 ignore next */
        (error) => logger.log(`Direct mode error: ${error.message}`)
      );
    });
  }

  const hashRoomId = getRoomIdFromUrl(window.location.href);
  if (hashRoomId) onCreate(hashRoomId);

  const directParsed = parseDirectUrl(window.location.href);
  if (directParsed?.type === 'offer') {
    startDirectMode(directParsed.encoded).catch(
      /* v8 ignore next */
      (error) => logger.log(`Direct mode error: ${error.message}`)
    );
  } else if (directParsed?.type === 'answer') {
    if (directPanel) directPanel.hidden = false;
    if (directStatus) directStatus.textContent = 'Paste this link where the call was created.';
  }

  return { state, onCreate };
}
