import { Candle } from '@/types/market';
import { ConfirmedSignal } from '@/types/ict';

export interface EvaluatedSetupOutcome {
  status: 'PENDING' | 'ACTIVE' | 'WIN' | 'LOSS' | 'AMBIGUOUS';
  exitPrice?: number;
  exitTimestamp?: number;
  outcomeR?: number;
  notes: string;
}

/**
 * Evaluates the outcome of a simulated setup against subsequent candle price action.
 * 
 * Rules:
 * - A setup starts PENDING.
 * - When price touches the entry price (or FVG zone), status becomes ACTIVE.
 * - For BUY:
 *   - If High >= TP and Low > SL -> WIN (+R).
 *   - If Low <= SL and High < TP -> LOSS (-1R).
 *   - If High >= TP AND Low <= SL on the same candle -> AMBIGUOUS (never guess!).
 * - For SELL:
 *   - If Low <= TP and High < SL -> WIN (+R).
 *   - If High >= SL and Low > TP -> LOSS (-1R).
 *   - If Low <= TP AND High >= SL on the same candle -> AMBIGUOUS.
 * - Continues tracking until resolved. Does not auto-close on session end.
 */
export function evaluateSetupOutcome(
  signal: ConfirmedSignal,
  subsequentCandles: Candle[],
  spreadAdjustment: number = 0
): EvaluatedSetupOutcome {
  if (!subsequentCandles || subsequentCandles.length === 0) {
    return {
      status: 'PENDING',
      notes: 'Awaiting incoming price action for entry.'
    };
  }

  let isActive = signal.simulatedStatus === 'ACTIVE';
  let entryTimestamp: number | undefined = undefined;

  const entry = signal.entryPrice;
  const sl = signal.stopLoss;
  const tp = signal.takeProfit;
  const isBuy = signal.direction === 'BUY';

  for (let i = 0; i < subsequentCandles.length; i++) {
    const c = subsequentCandles[i];

    // Check entry activation if not already active
    if (!isActive) {
      if (isBuy) {
        // For BUY, entry is filled if low <= entry
        if (c.low <= entry) {
          isActive = true;
          entryTimestamp = c.timestamp;
        }
      } else {
        // For SELL, entry is filled if high >= entry
        if (c.high >= entry) {
          isActive = true;
          entryTimestamp = c.timestamp;
        }
      }
    }

    if (!isActive) continue;

    // Price action evaluation for active trade
    if (isBuy) {
      const hitTp = c.high >= tp;
      const hitSl = (c.low - spreadAdjustment) <= sl;

      if (hitTp && hitSl) {
        return {
          status: 'AMBIGUOUS',
          exitPrice: entry,
          exitTimestamp: c.timestamp,
          outcomeR: 0,
          notes: 'Both SL and TP touched within the same candle. Marked as Ambiguous per strict quantitative rule.'
        };
      } else if (hitTp) {
        return {
          status: 'WIN',
          exitPrice: tp,
          exitTimestamp: c.timestamp,
          outcomeR: signal.riskReward,
          notes: `Take Profit hit at ${tp.toFixed(4)} (+${signal.riskReward}R).`
        };
      } else if (hitSl) {
        return {
          status: 'LOSS',
          exitPrice: sl,
          exitTimestamp: c.timestamp,
          outcomeR: -1.0,
          notes: `Structural Stop Loss hit at ${sl.toFixed(4)} (-1.0R).`
        };
      }
    } else {
      // SELL trade
      const hitTp = (c.low + spreadAdjustment) <= tp;
      const hitSl = c.high >= sl;

      if (hitTp && hitSl) {
        return {
          status: 'AMBIGUOUS',
          exitPrice: entry,
          exitTimestamp: c.timestamp,
          outcomeR: 0,
          notes: 'Both SL and TP touched within the same candle. Marked as Ambiguous per strict quantitative rule.'
        };
      } else if (hitTp) {
        return {
          status: 'WIN',
          exitPrice: tp,
          exitTimestamp: c.timestamp,
          outcomeR: signal.riskReward,
          notes: `Take Profit hit at ${tp.toFixed(4)} (+${signal.riskReward}R).`
        };
      } else if (hitSl) {
        return {
          status: 'LOSS',
          exitPrice: sl,
          exitTimestamp: c.timestamp,
          outcomeR: -1.0,
          notes: `Structural Stop Loss hit at ${sl.toFixed(4)} (-1.0R).`
        };
      }
    }
  }

  return {
    status: isActive ? 'ACTIVE' : 'PENDING',
    notes: isActive ? 'Simulated position currently active in market.' : 'Order pending limit fill.'
  };
}
