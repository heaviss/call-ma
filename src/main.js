import { joinRoom } from 'trystero/nostr';
import { initPwa } from './pwa.js';
import { initApp } from './app/controller.js';

initPwa();

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    initApp({ document, window, navigator, joinRoom });
  } catch {}
}
