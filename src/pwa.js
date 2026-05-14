import { registerSW } from 'virtual:pwa-register';

export function initPwa() {
  try {
    return registerSW({ immediate: true });
  } catch {
    return undefined;
  }
}
