import { registerSW } from 'virtual:pwa-register';

export function initPwa() {
  let sw;
  try {
    sw = registerSW({ immediate: true });
  } catch {}
  return sw;
}
