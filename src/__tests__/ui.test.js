// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

function loadIndexIntoDom() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const indexPath = resolve(__dirname, '../../index.html');
  const html = readFileSync(indexPath, 'utf-8');
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
    const createBtn = document.getElementById('createBtn');
    const copyBtn = document.getElementById('copyBtn');
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const logs = document.getElementById('logs');

    expect(createBtn).toBeTruthy();
    expect(copyBtn).toBeTruthy();
    expect(document.getElementById('inviteInput')).toBeNull();
    expect(localVideo).toBeTruthy();
    expect(remoteVideo).toBeTruthy();
    expect(logs).toBeTruthy();
  });

  it('has accessible labels and initial states', async () => {
    // Arrange

    // Act

    // Assert
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    expect(localVideo.getAttribute('autoplay')).not.toBeNull();
    expect(remoteVideo.getAttribute('autoplay')).not.toBeNull();
    expect(remoteVideo.getAttribute('playsinline')).not.toBeNull();

    const copyBtn = document.getElementById('copyBtn');
    expect(copyBtn.disabled).toBe(true);
  });
});
