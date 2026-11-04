export interface StatsEntry {
  id: string;
  type: string;
  state?: string;
  currentRoundTripTime?: number;
  mediaType?: string;
  framesPerSecond?: number;
  bytesReceived?: number;
}

export type StatsReportLike = ReadonlyMap<string, StatsEntry>;

export interface Metrics {
  rtt: number | null;
  bitrate: number | null;
  frameRate: number | null;
}

export function deriveMetrics(report: StatsReportLike, prevReport: StatsReportLike | null = null, timeDeltaMs = 0): Metrics {
  let rtt: number | null = null;
  let bitrate: number | null = null;
  let frameRate: number | null = null;

  for (const entry of report.values()) {
    if (entry.type === 'candidate-pair' && entry.state === 'succeeded' && entry.currentRoundTripTime != null) {
        rtt = entry.currentRoundTripTime * 1000;
      }

    if (entry.type !== 'inbound-rtp' || entry.mediaType !== 'video') { continue; }

    if (entry.framesPerSecond != null) {
      frameRate = entry.framesPerSecond;
    }

    if (!prevReport || !(timeDeltaMs > 0)) { continue; }

    const prev = prevReport.get(entry.id);
    if (prev != null && entry.bytesReceived != null && prev.bytesReceived != null) {
      bitrate = ((entry.bytesReceived - prev.bytesReceived) * 8) / timeDeltaMs;
    }
  }

  return { rtt, bitrate, frameRate };
}
