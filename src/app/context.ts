import type { PeerConnectionLike } from '../connection/directAdapter.ts';
import type { TransportOptions } from '../connection/trysteroAdapter.ts';
import type { Logger } from './logger.ts';

import { mapMediaError } from '../shared/browserSupport.ts';

export interface AppWindow {
  location: Location;
  isSecureContext: boolean;
  RTCPeerConnection?: new (config: RTCConfiguration) => PeerConnectionLike;
}

export interface AppNavigator {
  mediaDevices?: { getUserMedia?: MediaDevices['getUserMedia'] };
  clipboard?: Pick<Clipboard, 'writeText'>;
}

export type AppDeps = TransportOptions & {
  document: Document;
  window: AppWindow;
  navigator: AppNavigator;
  iceServers?: RTCIceServer[] | undefined;
};

export interface AppElements {
  newCallBtn: HTMLButtonElement | null;
  copyBtn: HTMLButtonElement | null;
  localVideo: HTMLVideoElement | null;
  remoteVideo: HTMLVideoElement | null;
  logsEl: Element | null;
  logsSection: HTMLElement | null;
  directBtn: HTMLButtonElement | null;
  directPanel: HTMLElement | null;
  directQr: HTMLCanvasElement | null;
  directCopyBtn: HTMLButtonElement | null;
  directStatus: HTMLElement | null;
  directAnswerInput: HTMLInputElement | null;
  directConnectBtn: HTMLButtonElement | null;
}

// Everything the controller's flows share: injected deps, page elements, log, and the room link.
export interface AppContext {
  deps: AppDeps;
  els: AppElements;
  logger: Logger;
  state: { link: string | null };
}

/**
Shows a stream in one of the page's video elements, if the page has it.
@param els Page elements.
@param key Which video element.
@param stream Stream to show.
*/
export function showStream(
  els: AppElements,
  key: 'localVideo' | 'remoteVideo',
  stream: MediaStream | null,
): void {
  const video = els[key];
  if (video) {
    video.srcObject = stream;
  }
}

async function requestMedia(
  getUserMedia: MediaDevices['getUserMedia'],
  logger: Logger,
): Promise<MediaStream> {
  try {
    return await getUserMedia({ audio: true, video: true });
  } catch (error) {
    logger.log(mapMediaError(error));
    throw error;
  }
}

/**
Camera and microphone stream; a denied or failed request is logged in user terms and rethrown.
@param navigator Injected navigator.
@param logger Page log.
@returns The local stream.
*/
export async function getMedia(navigator: AppNavigator, logger: Logger): Promise<MediaStream> {
  const { mediaDevices } = navigator;
  // Missing mediaDevices rejects without a log line: checkSupport has already warned about it.
  if (!mediaDevices?.getUserMedia) {
    throw new Error('mediaDevices not available');
  }
  return requestMedia(mediaDevices.getUserMedia.bind(mediaDevices), logger);
}
