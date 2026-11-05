// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

import { getEl } from './fakes/dom.ts';

function loadIndexIntoDom() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const indexPath = path.resolve(__dirname, '../../index.html');
  const html = readFileSync(indexPath, 'utf8');
  // jsdom defaults to an empty document; replace with our index
  document.open();
  document.write(html);
  document.close();
}

describe('UI Skeleton', () => {
  beforeEach(() => {
    loadIndexIntoDom();
  });

  it('renders required controls and areas', async () => {
    // Arrange

    // Act

    // Assert
    const required = ['#createBtn', '#copyBtn', '#localVideo', '#remoteVideo', '#logs'].map(
      (selector) => document.querySelector(selector),
    );

    expect(required).not.toContain(null);
    expect(document.querySelector('#inviteInput')).toBeNull();
  });

  it('has accessible labels and initial states', async () => {
    // Arrange

    // Act

    // Assert
    const localVideo = getEl(document, '#localVideo');
    const remoteVideo = getEl(document, '#remoteVideo');
    expect(localVideo.getAttribute('autoplay')).not.toBeNull();
    expect(remoteVideo.getAttribute('autoplay')).not.toBeNull();
    expect(remoteVideo.getAttribute('playsinline')).not.toBeNull();

    const copyBtn = getEl<HTMLButtonElement>(document, '#copyBtn');
    expect(copyBtn.disabled).toBe(true);
  });
});
