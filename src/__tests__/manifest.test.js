// @vitest-environment node
import { manifest } from '../../vite.config.js';

describe('PWA manifest config', () => {
  it('defines required manifest fields and icons', async () => {
    // Arrange

    // Act

    // Assert
    expect(manifest).toBeTruthy();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url || manifest.startUrl).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();

    expect(manifest.icons).toHaveLength(1);
    expect(manifest.icons[0].type).toBe('image/webp');
    expect(manifest.icons[0].sizes).toBe('any');
  });
});
