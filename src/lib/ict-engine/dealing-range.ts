import { Candle } from '@/types/market';
import { DealingRange } from '@/types/ict';
import { toZonedTime } from 'date-fns-tz';

const NY_TIMEZONE = 'America/New_York';

/**
 * Calculates Dealing Range and Equilibrium for Premium/Discount analysis.
 * 
 * Rules:
 * - High: Highest price in active dealing range.
 * - Low: Lowest price in active dealing range.
 * - Equilibrium: Midpoint between High and Low ((High + Low) / 2).
 * - Premium: Above equilibrium.
 * - Discount: Below equilibrium.
 */
export function calculateDealingRange(
  candles: Candle[],
  mode: 'ny_session' | 'recent_bars' = 'ny_session',
  lookbackBars: number = 50
): DealingRange | null {
  if (candles.length === 0) return null;

  let rangeCandles: Candle[] = [];

  if (mode === 'ny_session') {
    // Find candles belonging to the current/latest New York trading day
    const latestCandle = candles[candles.length - 1];
    const latestDateNy = toZonedTime(new Date(latestCandle.timestamp * 1000), NY_TIMEZONE);
    const sessionDay = latestDateNy.getDate();
    const sessionMonth = latestDateNy.getMonth();
    const sessionYear = latestDateNy.getFullYear();

    rangeCandles = candles.filter(c => {
      const cDateNy = toZonedTime(new Date(c.timestamp * 1000), NY_TIMEZONE);
      return (
        cDateNy.getDate() === sessionDay &&
        cDateNy.getMonth() === sessionMonth &&
        cDateNy.getFullYear() === sessionYear
      );
    });

    // If session just started and fewer than 5 candles, fallback to recent bars
    if (rangeCandles.length < 5) {
      rangeCandles = candles.slice(-Math.min(lookbackBars, candles.length));
    }
  } else {
    rangeCandles = candles.slice(-Math.min(lookbackBars, candles.length));
  }

  let high = -Infinity;
  let low = Infinity;

  for (const c of rangeCandles) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }

  if (high === -Infinity || low === Infinity || high <= low) {
    return null;
  }

  const equilibrium = (high + low) / 2;

  return {
    high,
    low,
    equilibrium,
    premiumZone: { top: high, bottom: equilibrium },
    discountZone: { top: equilibrium, bottom: low },
    sessionName: 'New York Session Dealing Range',
    sessionStart: rangeCandles[0].timestamp
  };
}

/**
 * Checks whether a given price is in Premium or Discount relative to the dealing range.
 */
export function getZonePosition(price: number, dealingRange: DealingRange): 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' {
  const tolerance = (dealingRange.high - dealingRange.low) * 0.01; // 1% tolerance around EQ
  if (Math.abs(price - dealingRange.equilibrium) <= tolerance) {
    return 'EQUILIBRIUM';
  }
  return price > dealingRange.equilibrium ? 'PREMIUM' : 'DISCOUNT';
}
