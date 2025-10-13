import { registerSW } from 'virtual:pwa-register';

export function initPwa() {
  try {
    return registerSW({ immediate: true });
  } catch (_) {
    // prefer silent failure in non-browser/test environments
    return undefined;
  }
}
