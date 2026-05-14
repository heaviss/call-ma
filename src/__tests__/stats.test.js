import { describe, it, expect } from 'vitest';
import { deriveMetrics } from '../shared/stats.js';

function makeReport(entries) {
  return new Map(entries.map((e) => [e.id, e]));
}

describe('deriveMetrics', () => {
  it('returns all nulls for an empty report', () => {
    expect(deriveMetrics(new Map())).toEqual({ rtt: null, bitrate: null, frameRate: null });
  });

  it('extracts RTT in ms from a succeeded candidate-pair', () => {
    const report = makeReport([
      { id: 'p1', type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.042 },
    ]);

    const { rtt } = deriveMetrics(report);

    expect(rtt).toBeCloseTo(42, 0);
  });

  it('ignores candidate-pair entries that are not succeeded', () => {
    const report = makeReport([
      { id: 'p1', type: 'candidate-pair', state: 'waiting', currentRoundTripTime: 0.1 },
    ]);

    expect(deriveMetrics(report).rtt).toBeNull();
  });

  it('returns null rtt when succeeded pair has no currentRoundTripTime', () => {
    const report = makeReport([
      { id: 'p1', type: 'candidate-pair', state: 'succeeded' },
    ]);

    expect(deriveMetrics(report).rtt).toBeNull();
  });

  it('extracts frameRate from inbound-rtp video entry', () => {
    const report = makeReport([
      { id: 'r1', type: 'inbound-rtp', mediaType: 'video', framesPerSecond: 30 },
    ]);

    expect(deriveMetrics(report).frameRate).toBe(30);
  });

  it('ignores inbound-rtp entries with mediaType audio for frameRate', () => {
    const report = makeReport([
      { id: 'r1', type: 'inbound-rtp', mediaType: 'audio', framesPerSecond: 30 },
    ]);

    expect(deriveMetrics(report).frameRate).toBeNull();
  });

  it('computes bitrate in kbps from two consecutive reports', () => {
    const prev = makeReport([
      { id: 'r1', type: 'inbound-rtp', mediaType: 'video', bytesReceived: 1000 },
    ]);
    const curr = makeReport([
      { id: 'r1', type: 'inbound-rtp', mediaType: 'video', bytesReceived: 2000 },
    ]);

    const { bitrate } = deriveMetrics(curr, prev, 1000);

    expect(bitrate).toBe(8);
  });

  it('returns null bitrate when no prevReport is provided', () => {
    const report = makeReport([
      { id: 'r1', type: 'inbound-rtp', mediaType: 'video', bytesReceived: 500 },
    ]);

    expect(deriveMetrics(report).bitrate).toBeNull();
  });

  it('returns null bitrate when timeDeltaMs is zero', () => {
    const prev = makeReport([
      { id: 'r1', type: 'inbound-rtp', mediaType: 'video', bytesReceived: 1000 },
    ]);
    const curr = makeReport([
      { id: 'r1', type: 'inbound-rtp', mediaType: 'video', bytesReceived: 2000 },
    ]);

    expect(deriveMetrics(curr, prev, 0).bitrate).toBeNull();
  });
});
