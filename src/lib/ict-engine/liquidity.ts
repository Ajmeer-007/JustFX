import { Candle } from '@/types/market';
import { LiquiditySweep, SignalDirection } from '@/types/ict';

export interface SwingPoint {
  index: number;
  timestamp: number;
  price: number;
  type: 'high' | 'low';
}

/**
 * Finds swing highs and swing lows using fractal pivot lookback.
 */
export function findSwingPoints(candles: Candle[], leftBars: number = 2, rightBars: number = 2): SwingPoint[] {
  const points: SwingPoint[] = [];
  if (candles.length < leftBars + rightBars + 1) return points;

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const current = candles[i];
    let isHigh = true;
    let isLow = true;

    // Check left bars
    for (let l = 1; l <= leftBars; l++) {
      if (candles[i - l].high >= current.high) isHigh = false;
      if (candles[i - l].low <= current.low) isLow = false;
    }

    // Check right bars
    for (let r = 1; r <= rightBars; r++) {
      if (candles[i + r].high >= current.high) isHigh = false;
      if (candles[i + r].low <= current.low) isLow = false;
    }

    if (isHigh) {
      points.push({
        index: i,
        timestamp: current.timestamp,
        price: current.high,
        type: 'high'
      });
    }
    if (isLow) {
      points.push({
        index: i,
        timestamp: current.timestamp,
        price: current.low,
        type: 'low'
      });
    }
  }

  return points;
}

/**
 * Detects confirmed liquidity sweeps:
 * - Buy-side sweep (Bearish): Price wicks above previous swing high or session high, but closes back inside.
 * - Sell-side sweep (Bullish): Price wicks below previous swing low or session low, but closes back inside.
 */
export function detectLiquiditySweeps(candles: Candle[], swingPoints: SwingPoint[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  if (candles.length === 0 || swingPoints.length === 0) return sweeps;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Check against all previous swing points formed before candle i
    for (const sp of swingPoints) {
      // Must be formed at least 2 bars prior to prevent self-referencing
      if (sp.index >= i - 1) continue;

      if (sp.type === 'high') {
        // Bearish Sweep: Wick pierces swing high, but closed candle rejected back below it
        if (c.high > sp.price && c.close < sp.price) {
          sweeps.push({
            id: `sweep_bsl_${c.timestamp}_${sp.timestamp}`,
            direction: 'SELL',
            levelType: 'swing_high',
            levelPrice: sp.price,
            sweepPrice: c.high,
            sweepTimestamp: c.timestamp,
            rejectionClose: c.close,
            confirmed: true
          });
        }
      } else if (sp.type === 'low') {
        // Bullish Sweep: Wick pierces swing low, but closed candle rejected back above it
        if (c.low < sp.price && c.close > sp.price) {
          sweeps.push({
            id: `sweep_ssl_${c.timestamp}_${sp.timestamp}`,
            direction: 'BUY',
            levelType: 'swing_low',
            levelPrice: sp.price,
            sweepPrice: c.low,
            sweepTimestamp: c.timestamp,
            rejectionClose: c.close,
            confirmed: true
          });
        }
      }
    }
  }

  return sweeps;
}
