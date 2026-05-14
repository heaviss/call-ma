import { joinRoom } from 'trystero/nostr';
import { initPwa } from './pwa.js';
import { initApp } from './app/controller.js';

initPwa();

if (globalThis.window !== undefined && globalThis.document !== undefined) {
  try {
    initApp({ document: globalThis.document, window: globalThis.window, navigator: globalThis.navigator, joinRoom });
  } catch {}
}
