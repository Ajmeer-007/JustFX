import { Candle } from '@/types/market';
import { CisdEvent, SignalDirection } from '@/types/ict';
import { LiquiditySweep } from '@/types/ict';

/**
 * Detects Change in State of Delivery (CISD).
 * 
 * Condition:
 * Following a confirmed liquidity sweep:
 * - Bullish CISD: Price aggressively closes above the opening price / high of the last 
 *   down-close candle prior to the sweep rejection.
 * - Bearish CISD: Price aggressively closes below the opening price / low of the last
 *   up-close candle prior to the sweep rejection.
 */
export function detectCisd(candles: Candle[], sweeps: LiquiditySweep[]): CisdEvent[] {
  const events: CisdEvent[] = [];
  if (candles.length < 5 || sweeps.length === 0) return events;

  for (const sweep of sweeps) {
    const sweepIndex = candles.findIndex(c => c.timestamp === sweep.sweepTimestamp);
    if (sweepIndex < 2) continue;

    if (sweep.direction === 'BUY') {
      // Bullish delivery change: find last down-close candle before/at sweep
      let refCandle = candles[sweepIndex];
      for (let j = sweepIndex; j >= Math.max(0, sweepIndex - 3); j--) {
        if (candles[j].close < candles[j].open) {
          refCandle = candles[j];
          break;
        }
      }

      const thresholdPrice = Math.max(refCandle.open, refCandle.high);

      // Look at subsequent candles for a decisive close above threshold
      for (let k = sweepIndex + 1; k < Math.min(candles.length, sweepIndex + 6); k++) {
        const trigger = candles[k];
        if (trigger.close > thresholdPrice) {
          events.push({
            id: `cisd_bull_${trigger.timestamp}`,
            direction: 'BUY',
            referenceCandleTimestamp: refCandle.timestamp,
            triggerCandleTimestamp: trigger.timestamp,
            thresholdPrice,
            explanation: `Bullish CISD confirmed at ${trigger.close.toFixed(4)}: Closed above reference delivery level ${thresholdPrice.toFixed(4)}`
          });
          break; // First confirmed CISD for this sweep
        }
      }
    } else {
      // Bearish delivery change: find last up-close candle before/at sweep
      let refCandle = candles[sweepIndex];
      for (let j = sweepIndex; j >= Math.max(0, sweepIndex - 3); j--) {
        if (candles[j].close > candles[j].open) {
          refCandle = candles[j];
          break;
        }
      }

      const thresholdPrice = Math.min(refCandle.open, refCandle.low);

      for (let k = sweepIndex + 1; k < Math.min(candles.length, sweepIndex + 6); k++) {
        const trigger = candles[k];
        if (trigger.close < thresholdPrice) {
          events.push({
            id: `cisd_bear_${trigger.timestamp}`,
            direction: 'SELL',
            referenceCandleTimestamp: refCandle.timestamp,
            triggerCandleTimestamp: trigger.timestamp,
            thresholdPrice,
            explanation: `Bearish CISD confirmed at ${trigger.close.toFixed(4)}: Closed below reference delivery level ${thresholdPrice.toFixed(4)}`
          });
          break;
        }
      }
    }
  }

  return events;
}
