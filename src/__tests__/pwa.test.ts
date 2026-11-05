import { registerSW } from 'virtual:pwa-register';
import { describe, expect, it } from 'vitest';

describe('SW registration', () => {
  it('calls registerSW on init', async () => {
    // Arrange / Act
    const { initPwa } = await import('../pwa.ts');
    initPwa();

    // Assert
    expect(registerSW).toHaveBeenCalledWith({ immediate: true });
  });
});
