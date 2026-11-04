import { registerSW } from 'virtual:pwa-register';

describe('SW registration', () => {
  it('calls registerSW on init', async () => {
    // Arrange / Act
    const { initPwa } = await import('../pwa.ts');
    initPwa();

    // Assert
    expect(registerSW).toHaveBeenCalled();
  });
});
