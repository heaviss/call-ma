import { getStunServers } from '@call-ma/shared';

const app = document.getElementById('app');
if (app) {
  const pre = document.createElement('pre');
  pre.textContent = `STUN servers: ${getStunServers().join(', ')}`;
  app.appendChild(pre);
}
