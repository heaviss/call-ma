import { vi } from 'vitest';

export const registerSW = vi.fn(() => ({
  update: vi.fn(),
  needRefresh: false,
  offlineReady: false,
}));
