import { Candle, SupportedTimeframe } from '@/types/market';
import { getTimeframeSeconds } from './resampler';

export interface ValidationResult {
  isValid: boolean;
  cleanCandles: Candle[];
  duplicatesRemoved: number;
  outOfOrderFixed: number;
  detectedGaps: Array<{ start: number; end: number; missingCount: number }>;
  isStale: boolean;
  stalenessSeconds: number;
}

/**
 * Validates, deduplicates, and sorts candles. Identifies any missing gaps or stale feeds.
 */
export function validateAndCleanCandles(
  rawCandles: Candle[],
  timeframe: SupportedTimeframe,
  currentTimestampSec: number = Math.floor(Date.now() / 1000)
): ValidationResult {
  if (!rawCandles || rawCandles.length === 0) {
    return {
      isValid: false,
      cleanCandles: [],
      duplicatesRemoved: 0,
      outOfOrderFixed: 0,
      detectedGaps: [],
      isStale: true,
      stalenessSeconds: 0
    };
  }

  const tfSeconds = getTimeframeSeconds(timeframe);
  let duplicatesRemoved = 0;
  let outOfOrderFixed = 0;

  // Check if original sequence was out of order
  for (let i = 1; i < rawCandles.length; i++) {
    if (rawCandles[i].timestamp < rawCandles[i - 1].timestamp) {
      outOfOrderFixed++;
    }
  }

  // Deduplicate by timestamp, keeping the most complete or latest entry
  const candleMap = new Map<number, Candle>();
  for (const c of rawCandles) {
    if (candleMap.has(c.timestamp)) {
      duplicatesRemoved++;
      const existing = candleMap.get(c.timestamp)!;
      // Prefer complete candle or higher volume
      if (!existing.isComplete && c.isComplete) {
        candleMap.set(c.timestamp, c);
      } else if (c.volume > existing.volume) {
        candleMap.set(c.timestamp, c);
      }
    } else {
      candleMap.set(c.timestamp, c);
    }
  }

  // Sort ascending by timestamp
  const sorted = Array.from(candleMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  // Detect gaps
  const detectedGaps: Array<{ start: number; end: number; missingCount: number }> = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (diff > tfSeconds * 1.5) {
      const missingCount = Math.floor(diff / tfSeconds) - 1;
      detectedGaps.push({
        start: sorted[i - 1].timestamp,
        end: sorted[i].timestamp,
        missingCount
      });
    }
  }

  // Check staleness (if latest candle is older than 3 intervals during market hours)
  const latestCandle = sorted[sorted.length - 1];
  const stalenessSeconds = currentTimestampSec - latestCandle.timestamp;
  // Consider stale if more than 3 intervals old
  const isStale = stalenessSeconds > tfSeconds * 3;

  return {
    isValid: sorted.length > 0,
    cleanCandles: sorted,
    duplicatesRemoved,
    outOfOrderFixed,
    detectedGaps,
    isStale,
    stalenessSeconds
  };
}

/**
 * Validates price continuity between two different feeds (e.g. Primary and Backup).
 * Returns false if price divergence is greater than threshold percentage.
 */
export function validatePriceContinuity(
  primaryPrice: number,
  backupPrice: number,
  maxDivergencePercent: number = 1.0
): { isContinuous: boolean; divergencePercent: number } {
  if (!primaryPrice || !backupPrice) {
    return { isContinuous: false, divergencePercent: 100 };
  }
  const diff = Math.abs(primaryPrice - backupPrice);
  const avg = (primaryPrice + backupPrice) / 2;
  const divergencePercent = (diff / avg) * 100;
  return {
    isContinuous: divergencePercent <= maxDivergencePercent,
    divergencePercent
  };
}
