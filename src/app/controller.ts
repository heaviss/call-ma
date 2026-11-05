import { TrysteroAdapter, type TransportOptions } from '../connection/trysteroAdapter.ts';
import { buildRoomUrl, getRoomIdFromUrl, copyToClipboard, buildDirectUrl, parseDirectUrl } from '../shared/link.ts';
import { createLogger, type Logger } from './logger.ts';
import { checkSupport, mapMediaError } from '../shared/browserSupport.ts';
import QRCode from 'qrcode';
import { DirectAdapter, type PeerConnectionLike } from '../connection/directAdapter.ts';

interface AppWindow {
  location: Location;
  isSecureContext: boolean;
  RTCPeerConnection?: new (config: RTCConfiguration) => PeerConnectionLike;
}

interface AppNavigator {
  mediaDevices?: { getUserMedia?: MediaDevices['getUserMedia'] };
  clipboard?: Pick<Clipboard, 'writeText'>;
}

export type AppDeps = TransportOptions & {
  document: Document;
  window: AppWindow;
  navigator: AppNavigator;
  iceServers?: RTCIceServer[] | undefined;
};

export interface AppController {
  state: { link: string | null };
  onCreate: (roomId?: string) => Promise<void>;
}

function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * 36)]).join('');
}

export function initApp(deps: AppDeps): AppController {
  const { document, window, navigator, iceServers } = deps;
  const state: AppController['state'] = { link: null };

  const createBtn   = document.querySelector<HTMLButtonElement>('#createBtn');
  const copyBtn     = document.querySelector<HTMLButtonElement>('#copyBtn');
  const localVideo  = document.querySelector<HTMLVideoElement>('#localVideo');
  const remoteVideo = document.querySelector<HTMLVideoElement>('#remoteVideo');
  const logsEl      = document.querySelector('#logs');
  const logsSection = document.querySelector<HTMLElement>('#logsSection');
  const directBtn         = document.querySelector<HTMLButtonElement>('#directBtn');
  const directPanel       = document.querySelector<HTMLElement>('#directPanel');
  const directQr          = document.querySelector<HTMLCanvasElement>('#directQr');
  const directCopyBtn     = document.querySelector<HTMLButtonElement>('#directCopyBtn');
  const directStatus      = document.querySelector<HTMLElement>('#directStatus');
  const directAnswerInput = document.querySelector<HTMLInputElement>('#directAnswerInput');
  const directConnectBtn  = document.querySelector<HTMLButtonElement>('#directConnectBtn');

  if (typeof CompressionStream === 'undefined' && directBtn) {
    directBtn.hidden = true;
  }

  if (logsSection && new URLSearchParams(window.location.search).get('debug') === 'true') {
    logsSection.hidden = false;
  }

  const logger: Logger = logsEl ? createLogger(logsEl) : { log() {}, clear() {} };

  const support = checkSupport({ window, navigator, RTCPeerConnection: window.RTCPeerConnection });
  if (!support.ok) logger.log(`Warning: ${support.reason}`);

  async function getMedia(): Promise<MediaStream> {
    try {
      return navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ? await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        : Promise.reject(new Error('mediaDevices not available'));
    } catch (error) {
      logger.log(mapMediaError(error));
      throw error;
    }
  }

  async function startDirectMode(offerEncoded: string | null = null): Promise<void> {
    if (directPanel) directPanel.hidden = false;

    const directAdapter = new DirectAdapter({
      iceServers,
      // RTCPeerConnection is absent only in browsers checkSupport already warned about; `new` then throws as before.
      PeerConnection: (cfg) => new window.RTCPeerConnection!(cfg),
    });

    directAdapter
      .onStream((remote) => { if (remoteVideo) remoteVideo.srcObject = remote; })
      .onConnect(()       => { logger.log('Direct connection established!'); })
      .onError((err)      => { logger.log(`Direct connection error: ${err.message}`); });

    let encodedSdp: string;
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
    } catch (error) {
      logger.log(`Direct mode error: ${(error as Error).message}`);
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
          logger.log(`Direct connect error: ${(error as Error).message}`);
        }
      });
    }
  }

  async function onCreate(roomId = generateRoomId()): Promise<void> {
    logger.log('Getting camera/microphone...');
    const stream = await getMedia();
    if (localVideo) localVideo.srcObject = stream;

    const url = buildRoomUrl(window.location, roomId);
    state.link = url;

    const adapter = new TrysteroAdapter(deps);
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
    let isDirectStarted = false;
    directBtn.addEventListener('click', () => {
      if (isDirectStarted) return;
      isDirectStarted = true;
      void startDirectMode().catch(
        /* v8 ignore next */
        (error: unknown) => logger.log(`Direct mode error: ${(error as Error).message}`)
      );
    });
  }

  const hashRoomId = getRoomIdFromUrl(window.location.href);
  if (hashRoomId) onCreate(hashRoomId);

  const directParsed = parseDirectUrl(window.location.href);
  if (directParsed?.type === 'offer') {
    void startDirectMode(directParsed.encoded).catch(
      /* v8 ignore next */
      (error: unknown) => logger.log(`Direct mode error: ${(error as Error).message}`)
    );
  } else if (directParsed?.type === 'answer') {
    if (directPanel) directPanel.hidden = false;
    if (directStatus) directStatus.textContent = 'Paste this link where the call was created.';
  }

  return { state, onCreate };
}
