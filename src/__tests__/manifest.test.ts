// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { manifest } from '../../vite.config.ts';

describe('PWA manifest config', () => {
  it('defines required manifest fields and icons', async () => {
    // Arrange

    // Act

    // Assert
    const requiredFields = [
      manifest.name,
      manifest.short_name,
      manifest.start_url,
      manifest.theme_color,
      manifest.background_color,
    ];

    expect(manifest).toMatchObject({
      display: 'standalone',
      icons: [{ type: 'image/webp', sizes: 'any' }],
    });
    expect(requiredFields).not.toContain(undefined);
    expect(requiredFields).not.toContain('');
  });
});
