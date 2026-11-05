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

const MS_PER_SECOND = 1000;
const BITS_PER_BYTE = 8;

function rttMs(entry: StatsEntry): number | null {
  if (entry.type !== 'candidate-pair' || entry.state !== 'succeeded') {
    return null;
  }
  return entry.currentRoundTripTime == null ? null : entry.currentRoundTripTime * MS_PER_SECOND;
}

function isInboundVideo(entry: StatsEntry): boolean {
  return entry.type === 'inbound-rtp' && entry.mediaType === 'video';
}

function bitrateKbps(
  entry: StatsEntry,
  prevReport: StatsReportLike,
  timeDeltaMs: number,
): number | null {
  const prevBytes = prevReport.get(entry.id)?.bytesReceived;
  return prevBytes == null || entry.bytesReceived == null
    ? null
    : ((entry.bytesReceived - prevBytes) * BITS_PER_BYTE) / timeDeltaMs;
}

function lastNonNull(numbers: readonly (number | null)[]): number | null {
  return numbers.findLast((num) => num !== null) ?? null;
}

/**
Live call metrics from a WebRTC stats report; the last matching entry wins.
Bitrate needs the previous report and a positive time delta, otherwise it is null.
@param report Current `getStats()` report.
@param prevReport Report from the previous poll, for the byte delta.
@param timeDeltaMs Milliseconds between the two reports.
@returns RTT in ms, bitrate in kbit/s and frame rate; null where the report has no data.
*/
export function deriveMetrics(
  report: StatsReportLike,
  prevReport: StatsReportLike | null = null,
  timeDeltaMs = 0,
): Metrics {
  const entries = Array.from(report, ([, entry]) => entry);
  const videoEntries = entries.filter(isInboundVideo);
  const bitrates =
    prevReport !== null && timeDeltaMs > 0
      ? videoEntries.map((entry) => bitrateKbps(entry, prevReport, timeDeltaMs))
      : [];

  return {
    rtt: lastNonNull(entries.map(rttMs)),
    bitrate: lastNonNull(bitrates),
    frameRate: lastNonNull(videoEntries.map((entry) => entry.framesPerSecond ?? null)),
  };
}
