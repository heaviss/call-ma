import Peer from 'simple-peer';
import { getStunServers } from './shared/config/stun.js';
import { initPwa } from './pwa.js';
import { initApp } from './app/controller.js';

initPwa();

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const peerConfig = { iceServers: getStunServers().map((u) => ({ urls: u })) };
  try {
    initApp({ document, window, navigator, PeerCtor: Peer, peerConfig });
  } catch {}
}
