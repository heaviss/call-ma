export function deriveMetrics(report, prevReport = null, timeDeltaMs = 0) {
  let rtt = null;
  let bitrate = null;
  let frameRate = null;

  for (const entry of report.values()) {
    if (entry.type === 'candidate-pair' && entry.state === 'succeeded' && entry.currentRoundTripTime != null) {
        rtt = entry.currentRoundTripTime * 1000;
      }

    if (entry.type === 'inbound-rtp' && entry.mediaType === 'video') {
      if (entry.framesPerSecond != null) {
        frameRate = entry.framesPerSecond;
      }

      if (prevReport && timeDeltaMs > 0) {
        const prev = prevReport.get(entry.id);
        if (prev != null && entry.bytesReceived != null && prev.bytesReceived != null) {
          bitrate = ((entry.bytesReceived - prev.bytesReceived) * 8) / timeDeltaMs;
        }
      }
    }
  }

  return { rtt, bitrate, frameRate };
}
