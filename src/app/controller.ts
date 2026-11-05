import { TrysteroAdapter } from '../connection/trysteroAdapter.ts';
import { checkSupport } from '../shared/browserSupport.ts';
import { buildRoomUrl, copyToClipboard, getRoomIdFromUrl, parseDirectUrl } from '../shared/link.ts';
import {
  type AppContext,
  type AppDeps,
  type AppElements,
  type AppWindow,
  getMedia,
  showStream,
} from './context.ts';
import { showDirectPanel, startDirectMode } from './directMode.ts';
import { createLogger, type Logger } from './logger.ts';

export type { AppDeps, AppNavigator, AppWindow } from './context.ts';

export interface AppController {
  state: { link: string | null };
  onCreate: (roomId?: string) => Promise<void>;
}

type StartRoomCall = (roomId?: string) => Promise<void>;

function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function queryElements(document: Document): AppElements {
  return {
    newCallBtn: document.querySelector<HTMLButtonElement>('#createBtn'),
    copyBtn: document.querySelector<HTMLButtonElement>('#copyBtn'),
    localVideo: document.querySelector<HTMLVideoElement>('#localVideo'),
    remoteVideo: document.querySelector<HTMLVideoElement>('#remoteVideo'),
    logsEl: document.querySelector('#logs'),
    logsSection: document.querySelector<HTMLElement>('#logsSection'),
    directBtn: document.querySelector<HTMLButtonElement>('#directBtn'),
    directPanel: document.querySelector<HTMLElement>('#directPanel'),
    directQr: document.querySelector<HTMLCanvasElement>('#directQr'),
    directCopyBtn: document.querySelector<HTMLButtonElement>('#directCopyBtn'),
    directStatus: document.querySelector<HTMLElement>('#directStatus'),
    directAnswerInput: document.querySelector<HTMLInputElement>('#directAnswerInput'),
    directConnectBtn: document.querySelector<HTMLButtonElement>('#directConnectBtn'),
  };
}

function applyInitialVisibility(els: AppElements, window: AppWindow): void {
  const { directBtn, logsSection } = els;
  if (typeof CompressionStream === 'undefined' && directBtn) {
    directBtn.hidden = true;
  }
  if (logsSection && new URLSearchParams(window.location.search).get('debug') === 'true') {
    logsSection.hidden = false;
  }
}

function createPageLogger(logsEl: Element | null): Logger {
  return logsEl
    ? createLogger(logsEl)
    : {
        log() {
          // No log on this page.
        },
        clear() {
          // Nothing to clear.
        },
      };
}

function createContext(deps: AppDeps): AppContext {
  const { window, navigator } = deps;
  const els = queryElements(deps.document);
  applyInitialVisibility(els, window);
  const logger = createPageLogger(els.logsEl);

  const support = checkSupport({ window, navigator, RTCPeerConnection: window.RTCPeerConnection });
  if (!support.ok) {
    logger.log(`Warning: ${support.reason}`);
  }
  return { deps, els, logger, state: { link: null } };
}

function joinRoom({ deps, els, logger }: AppContext, roomId: string, stream: MediaStream): void {
  new TrysteroAdapter(deps)
    .onStream((remote) => {
      showStream(els, 'remoteVideo', remote);
    })
    .onConnect(() => {
      logger.log('Peer joined — connected!');
    })
    .onError((err) => {
      logger.log(`Connection error: ${err.message}`);
    })
    .onPeerLeave(() => {
      logger.log('Peer left.');
    })
    .join(roomId, stream);
}

function shareRoomLink({ els, logger, state }: AppContext, url: string): void {
  const { copyBtn } = els;
  const room = state;
  room.link = url;
  if (copyBtn) {
    copyBtn.disabled = false;
  }
  logger.log(`Connecting… Share this link: ${url}`);
}

async function startRoomCall(ctx: AppContext, roomId: string): Promise<void> {
  const { deps, els, logger } = ctx;
  logger.log('Getting camera/microphone...');
  const stream = await getMedia(deps.navigator, logger);
  showStream(els, 'localVideo', stream);

  const url = buildRoomUrl(deps.window.location, roomId);
  joinRoom(ctx, roomId, stream);
  shareRoomLink(ctx, url);
}

async function copyRoomLink({ deps, logger, state }: AppContext): Promise<void> {
  if (!state.link) {
    return;
  }
  try {
    const isOk = await copyToClipboard(deps.navigator, state.link);
    logger.log(
      isOk
        ? 'Link copied to clipboard.'
        : 'Could not copy — copy the link manually from the address bar.',
    );
  } catch {}
}

function runDirectMode(ctx: AppContext, offerEncoded: string | null): void {
  void startDirectMode(ctx, offerEncoded).catch(
    /* v8 ignore next */
    (error: unknown) => {
      ctx.logger.log(`Direct mode error: ${(error as Error).message}`);
    },
  );
}

function bindDirectButton(ctx: AppContext): void {
  let isDirectStarted = false;
  ctx.els.directBtn?.addEventListener('click', () => {
    if (isDirectStarted) {
      return;
    }
    isDirectStarted = true;
    runDirectMode(ctx, null);
  });
}

function bindControls(ctx: AppContext, onCreate: StartRoomCall): void {
  ctx.els.newCallBtn?.addEventListener('click', () => {
    void onCreate();
  });
  ctx.els.copyBtn?.addEventListener('click', () => {
    void copyRoomLink(ctx);
  });
  bindDirectButton(ctx);
}

function showAnswerHint(els: AppElements): void {
  const { directStatus } = els;
  showDirectPanel(els);
  if (directStatus) {
    directStatus.textContent = 'Paste this link where the call was created.';
  }
}

// A room link joins the call; a direct offer link answers it; a direct answer link belongs on the caller's page.
function resumeFromUrl(ctx: AppContext, onCreate: StartRoomCall): void {
  const { href } = ctx.deps.window.location;
  const hashRoomId = getRoomIdFromUrl(href);
  if (hashRoomId) {
    void onCreate(hashRoomId);
  }

  const directParsed = parseDirectUrl(href);
  if (directParsed?.type === 'offer') {
    runDirectMode(ctx, directParsed.encoded);
  } else if (directParsed?.type === 'answer') {
    showAnswerHint(ctx.els);
  }
}

/**
Wires the page: create and copy buttons, direct mode, and joining from a shared link.
@param deps Injected document, window, navigator, transports and ICE servers.
@returns Room link state and `onCreate`, which starts or joins a room.
*/
export function initApp(deps: AppDeps): AppController {
  const ctx = createContext(deps);
  const onCreate: StartRoomCall = (roomId = generateRoomId()) => startRoomCall(ctx, roomId);
  bindControls(ctx, onCreate);
  resumeFromUrl(ctx, onCreate);
  return { state: ctx.state, onCreate };
}
