import { Candle } from '@/types/market';
import { DisplacementEvent, SignalDirection } from '@/types/ict';

/**
 * Calculates Average True Range (ATR) over a rolling window.
 */
export function calculateAtr(candles: Candle[], period: number = 14): number[] {
  if (candles.length === 0) return [];
  const tr: number[] = new Array(candles.length);
  tr[0] = candles[0].high - candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    const hl = current.high - current.low;
    const hpc = Math.abs(current.high - prev.close);
    const lpc = Math.abs(current.low - prev.close);
    tr[i] = Math.max(hl, hpc, lpc);
  }

  const atr: number[] = new Array(candles.length);
  // Initial simple moving average for ATR
  let sum = 0;
  for (let i = 0; i < Math.min(period, candles.length); i++) {
    sum += tr[i];
    atr[i] = sum / (i + 1);
  }

  // Wilder's smoothing
  for (let i = period; i < candles.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }

  return atr;
}

export interface DisplacementConfig {
  minAtrRatio?: number; // Default 1.8x ATR
  minBodyToRangeRatio?: number; // Default 0.65 (65%)
  atrPeriod?: number; // Default 14
}

/**
 * Identifies Strong Displacement candles.
 * Explicit quantitative rule:
 * 1. Candle body size >= minAtrRatio * ATR(14)
 * 2. Candle body / total range >= minBodyToRangeRatio (body represents majority of candle)
 */
export function detectDisplacement(
  candles: Candle[],
  config: DisplacementConfig = {}
): Map<number, DisplacementEvent> {
  const minAtrRatio = config.minAtrRatio ?? 1.8;
  const minBodyToRangeRatio = config.minBodyToRangeRatio ?? 0.65;
  const atrPeriod = config.atrPeriod ?? 14;

  const results = new Map<number, DisplacementEvent>();
  if (candles.length < atrPeriod + 1) return results;

  const atr = calculateAtr(candles, atrPeriod);

  for (let i = atrPeriod; i < candles.length; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    if (range <= 0) continue;

    const body = Math.abs(c.close - c.open);
    const bodyRatio = body / range;
    const currentAtr = atr[i - 1] || atr[i]; // Compare against ATR before this candle
    const atrRatio = currentAtr > 0 ? body / currentAtr : 0;

    if (bodyRatio >= minBodyToRangeRatio && atrRatio >= minAtrRatio) {
      const direction: SignalDirection = c.close > c.open ? 'BUY' : 'SELL';
      results.set(c.timestamp, {
        id: `disp_${c.timestamp}_${direction}`,
        direction,
        timestamp: c.timestamp,
        bodyRatio,
        atrRatio,
        volumeScore: c.volume
      });
    }
  }

  return results;
}
