import { Candle, SupportedTimeframe } from '@/types/market';

const TIMEFRAME_SECONDS: Record<SupportedTimeframe, number> = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400
};

export function getTimeframeSeconds(tf: SupportedTimeframe): number {
  return TIMEFRAME_SECONDS[tf] || 60;
}

/**
 * Resamples a sequence of smaller timeframe candles into a target timeframe.
 * E.g., resamples 1m candles into 3m candles or 1h candles into 4h candles.
 */
export function resampleCandles(candles: Candle[], targetTf: SupportedTimeframe): Candle[] {
  if (candles.length === 0) return [];
  const targetSeconds = getTimeframeSeconds(targetTf);

  // Group candles by bucket
  const buckets = new Map<number, Candle[]>();

  for (const c of candles) {
    const bucketTime = Math.floor(c.timestamp / targetSeconds) * targetSeconds;
    const existing = buckets.get(bucketTime);
    if (existing) {
      existing.push(c);
    } else {
      buckets.set(bucketTime, [c]);
    }
  }

  const resampled: Candle[] = [];
  const sortedBucketTimes = Array.from(buckets.keys()).sort((a, b) => a - b);

  for (const bucketTime of sortedBucketTimes) {
    const group = buckets.get(bucketTime)!;
    // Sort group by timestamp ascending
    group.sort((a, b) => a.timestamp - b.timestamp);

    let high = -Infinity;
    let low = Infinity;
    let volume = 0;

    for (const c of group) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume;
    }

    const open = group[0].open;
    const close = group[group.length - 1].close;
    const source = group[0].source;
    const isComplete = group.length * 60 >= targetSeconds || group[group.length - 1].isComplete;

    resampled.push({
      timestamp: bucketTime,
      open,
      high,
      low,
      close,
      volume,
      source,
      isComplete
    });
  }

  return resampled;
}
