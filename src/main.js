import Peer from 'simple-peer';
import { getIceServers } from './shared/config/stun.js';
import { initPwa } from './pwa.js';
import { initApp } from './app/controller.js';

initPwa();

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const peerConfig = { iceServers: getIceServers() };
  try {
    initApp({ document, window, navigator, PeerCtor: Peer, peerConfig });
  } catch {}
}
