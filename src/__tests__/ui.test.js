// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
    const createBtn = document.querySelector('#createBtn');
    const copyBtn = document.querySelector('#copyBtn');
    const localVideo = document.querySelector('#localVideo');
    const remoteVideo = document.querySelector('#remoteVideo');
    const logs = document.querySelector('#logs');

    expect(createBtn).toBeTruthy();
    expect(copyBtn).toBeTruthy();
    expect(document.querySelector('#inviteInput')).toBeNull();
    expect(localVideo).toBeTruthy();
    expect(remoteVideo).toBeTruthy();
    expect(logs).toBeTruthy();
  });

  it('has accessible labels and initial states', async () => {
    // Arrange

    // Act

    // Assert
    const localVideo = document.querySelector('#localVideo');
    const remoteVideo = document.querySelector('#remoteVideo');
    expect(localVideo.getAttribute('autoplay')).not.toBeNull();
    expect(remoteVideo.getAttribute('autoplay')).not.toBeNull();
    expect(remoteVideo.getAttribute('playsinline')).not.toBeNull();

    const copyBtn = document.querySelector('#copyBtn');
    expect(copyBtn.disabled).toBe(true);
  });
});
