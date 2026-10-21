import { Candle } from '@/types/market';
import { OrderBlockZone } from '@/types/ict';
import { DisplacementEvent } from '@/types/ict';
import { FvgZone } from '@/types/ict';

/**
 * Detects institutional Order Blocks (OB).
 * Rules:
 * - Bullish OB: Last down-close (bearish) candle immediately preceding a confirmed bullish displacement run and FVG.
 * - Bearish OB: Last up-close (bullish) candle immediately preceding a confirmed bearish displacement run and FVG.
 */
export function detectOrderBlocks(
  candles: Candle[],
  displacements: Map<number, DisplacementEvent>,
  fvgs: FvgZone[]
): OrderBlockZone[] {
  const orderBlocks: OrderBlockZone[] = [];
  if (candles.length < 4) return orderBlocks;

  // Index FVGs by candleIndex
  const fvgMap = new Set(fvgs.map(f => f.candleIndex));

  for (let i = 1; i < candles.length - 2; i++) {
    const c = candles[i];
    const nextCandle = candles[i + 1];

    // Check if the next candle or subsequent candle had strong displacement
    const disp = displacements.get(nextCandle.timestamp);
    if (!disp) continue;

    // Check FVG confluence around this displacement
    const hasFvgConfluence = fvgMap.has(i + 1) || fvgMap.has(i + 2);

    // Bullish OB: c was a down-close candle (bearish), followed by bullish displacement
    if (c.close < c.open && disp.direction === 'BUY') {
      orderBlocks.push({
        id: `ob_bull_${c.timestamp}`,
        type: 'bullish',
        top: Math.max(c.open, c.close),
        bottom: c.low,
        timestamp: c.timestamp,
        candleIndex: i,
        displacementAtrRatio: disp.atrRatio,
        hasFvgConfluence,
        mitigated: false
      });
    }

    // Bearish OB: c was an up-close candle (bullish), followed by bearish displacement
    if (c.close > c.open && disp.direction === 'SELL') {
      orderBlocks.push({
        id: `ob_bear_${c.timestamp}`,
        type: 'bearish',
        top: c.high,
        bottom: Math.min(c.open, c.close),
        timestamp: c.timestamp,
        candleIndex: i,
        displacementAtrRatio: disp.atrRatio,
        hasFvgConfluence,
        mitigated: false
      });
    }
  }

  // Track mitigation on subsequent candles
  for (const ob of orderBlocks) {
    for (let k = ob.candleIndex + 2; k < candles.length; k++) {
      const c = candles[k];
      if (ob.type === 'bullish') {
        if (c.low <= ob.top) {
          ob.mitigated = true;
          break;
        }
      } else {
        if (c.high >= ob.bottom) {
          ob.mitigated = true;
          break;
        }
      }
    }
  }

  return orderBlocks;
}
