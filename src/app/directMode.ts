import { toCanvas } from 'qrcode';

import { DirectAdapter, type PeerConnectionLike } from '../connection/directAdapter.ts';
import { buildDirectUrl, copyToClipboard, parseDirectUrl } from '../shared/link.ts';
import {
  type AppContext,
  type AppElements,
  type AppWindow,
  getMedia,
  showStream,
} from './context.ts';

function setStatus(els: AppElements, text: string): void {
  const { directStatus } = els;
  if (directStatus) {
    directStatus.textContent = text;
  }
}

// RTCPeerConnection is absent only in browsers checkSupport already warned about.
function createPeerConnection(
  { RTCPeerConnection }: AppWindow,
  config: RTCConfiguration,
): PeerConnectionLike {
  if (!RTCPeerConnection) {
    throw new TypeError('window.RTCPeerConnection is not a constructor');
  }
  return new RTCPeerConnection(config);
}

function createDirectAdapter({ deps, els, logger }: AppContext): DirectAdapter {
  return new DirectAdapter({
    iceServers: deps.iceServers,
    PeerConnection: (config) => createPeerConnection(deps.window, config),
  })
    .onStream((remote) => {
      showStream(els, 'remoteVideo', remote);
    })
    .onConnect(() => {
      logger.log('Direct connection established!');
    })
    .onError((err) => {
      logger.log(`Direct connection error: ${err.message}`);
    });
}

async function createAnswer(
  els: AppElements,
  adapter: DirectAdapter,
  offerEncoded: string,
  stream: MediaStream,
): Promise<string> {
  const encodedSdp = await adapter.createAnswer(offerEncoded, stream);
  setStatus(els, 'Share your answer with the caller:');
  return encodedSdp;
}

async function createOffer(
  els: AppElements,
  adapter: DirectAdapter,
  stream: MediaStream,
): Promise<string> {
  const encodedSdp = await adapter.createOffer(stream);
  setStatus(els, 'Share this with the other person:');
  const { directConnectBtn } = els;
  if (directConnectBtn) {
    directConnectBtn.disabled = false;
  }
  return encodedSdp;
}

// Encoded SDP to share, or null when media or negotiation failed (already logged).
async function negotiate(
  ctx: AppContext,
  adapter: DirectAdapter,
  offerEncoded: string | null,
): Promise<string | null> {
  try {
    const stream = await getMedia(ctx.deps.navigator, ctx.logger);
    showStream(ctx.els, 'localVideo', stream);
    return await (offerEncoded
      ? createAnswer(ctx.els, adapter, offerEncoded, stream)
      : createOffer(ctx.els, adapter, stream));
  } catch (error) {
    ctx.logger.log(`Direct mode error: ${(error as Error).message}`);
    return null;
  }
}

async function renderQr({ els, logger }: AppContext, directUrl: string): Promise<void> {
  if (!els.directQr) {
    return;
  }
  try {
    await toCanvas(els.directQr, directUrl, { width: 256, margin: 2 });
  } catch {
    logger.log('QR rendering failed. Use the copy button instead.');
  }
}

async function copyDirectLink({ deps, logger }: AppContext, directUrl: string): Promise<void> {
  await copyToClipboard(deps.navigator, directUrl);
  logger.log('Direct link copied.');
}

function enableDirectCopy(ctx: AppContext, directUrl: string): void {
  const { directCopyBtn } = ctx.els;
  if (directCopyBtn) {
    directCopyBtn.disabled = false;
  }
  directCopyBtn?.addEventListener('click', () => {
    void copyDirectLink(ctx, directUrl);
  });
}

async function applyAnswerFromInput(
  { els, logger }: AppContext,
  adapter: DirectAdapter,
): Promise<void> {
  const parsed = parseDirectUrl(els.directAnswerInput?.value ?? '');
  if (parsed?.type !== 'answer') {
    logger.log('Invalid answer link — paste the link from the other person.');
    return;
  }
  try {
    await adapter.applyAnswer(parsed.encoded);
  } catch (error) {
    logger.log(`Direct connect error: ${(error as Error).message}`);
  }
}

function bindAnswerInput(ctx: AppContext, adapter: DirectAdapter): void {
  ctx.els.directConnectBtn?.addEventListener('click', () => {
    void applyAnswerFromInput(ctx, adapter);
  });
}

// The caller shares an offer and waits for the answer link; the callee only shares its answer.
async function shareDirectLink(
  ctx: AppContext,
  adapter: DirectAdapter,
  offerEncoded: string | null,
  encodedSdp: string,
): Promise<void> {
  const directUrl = buildDirectUrl(
    ctx.deps.window.location,
    offerEncoded ? 'answer' : 'offer',
    encodedSdp,
  );
  await renderQr(ctx, directUrl);
  enableDirectCopy(ctx, directUrl);
  if (!offerEncoded) {
    bindAnswerInput(ctx, adapter);
  }
}

/**
Shows the direct-mode panel, if the page has one.
@param els Page elements.
*/
export function showDirectPanel(els: AppElements): void {
  const { directPanel } = els;
  if (directPanel) {
    directPanel.hidden = false;
  }
}

/**
Serverless call: the caller shares an offer link (QR or copy), then pastes back the answer link.
With `offerEncoded` this side is the callee and only produces the answer link.
@param ctx Shared controller context.
@param offerEncoded Offer from the URL, or null to start as the caller.
*/
export async function startDirectMode(
  ctx: AppContext,
  offerEncoded: string | null = null,
): Promise<void> {
  showDirectPanel(ctx.els);
  const adapter = createDirectAdapter(ctx);
  const encodedSdp = await negotiate(ctx, adapter, offerEncoded);
  if (encodedSdp !== null) {
    await shareDirectLink(ctx, adapter, offerEncoded, encodedSdp);
  }
}
