import { vi } from 'vitest';

// querySelector for elements a test relies on: fails loudly instead of returning null.
export function getEl<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

// A stand-in MediaStream: tests only check identity and iterate tracks.
export function fakeStream(id = 'stream', tracks: readonly unknown[] = []): MediaStream {
  return { id, getTracks: () => tracks } as unknown as MediaStream;
}

export function makeNavigator(stream: MediaStream = fakeStream('local-stream')) {
  return {
    mediaDevices: { getUserMedia: vi.fn<MediaDevices['getUserMedia']>().mockResolvedValue(stream) },
    clipboard: { writeText: vi.fn<Clipboard['writeText']>() },
  };
}

export type FakeNavigator = ReturnType<typeof makeNavigator>;
