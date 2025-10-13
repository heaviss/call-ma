import { getStunServers } from './shared/config/stun.js';
import { initPwa } from './pwa.js';

initPwa();

const app = document.getElementById('app');
if (app) {
  const pre = document.createElement('pre');
  pre.textContent = `STUN servers: ${getStunServers().join(', ')}`;
  app.appendChild(pre);
}
