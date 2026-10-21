import { Candle } from '@/types/market';
import { FvgZone, IfvgZone } from '@/types/ict';

export interface FvgDetectionResult {
  fvgs: FvgZone[];
  ifvgs: IfvgZone[];
  activeFvgs: FvgZone[];
  activeIfvgs: IfvgZone[];
}

/**
 * Detects Fair Value Gaps (FVG) and Inverse Fair Value Gaps (IFVG) across candles.
 * 
 * Rules:
 * Bullish FVG: Candle[i-2].high < Candle[i].low
 * Bearish FVG: Candle[i-2].low > Candle[i].high
 * Mitigation: Tracked when subsequent price enters the zone.
 * Inversion (IFVG): When price closes through the boundary of an unmitigated or partially mitigated FVG.
 */
export function detectFvgAndIfvg(candles: Candle[], minGapSize: number = 0): FvgDetectionResult {
  const fvgs: FvgZone[] = [];
  const ifvgs: IfvgZone[] = [];

  if (candles.length < 3) {
    return { fvgs: [], ifvgs: [], activeFvgs: [], activeIfvgs: [] };
  }

  // Step 1: Detect all FVGs across the series
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1]; // Middle displacement bar
    const c3 = candles[i];

    // Bullish FVG check
    if (c3.low > c1.high && (c3.low - c1.high) > minGapSize) {
      const top = c3.low;
      const bottom = c1.high;
      fvgs.push({
        id: `fvg_bull_${c2.timestamp}`,
        type: 'bullish',
        top,
        bottom,
        midpoint: (top + bottom) / 2,
        candleIndex: i - 1,
        timestamp: c2.timestamp,
        mitigated: false,
        inverted: false
      });
    }

    // Bearish FVG check
    if (c1.low > c3.high && (c1.low - c3.high) > minGapSize) {
      const top = c1.low;
      const bottom = c3.high;
      fvgs.push({
        id: `fvg_bear_${c2.timestamp}`,
        type: 'bearish',
        top,
        bottom,
        midpoint: (top + bottom) / 2,
        candleIndex: i - 1,
        timestamp: c2.timestamp,
        mitigated: false,
        inverted: false
      });
    }
  }

  // Step 2: Track mitigation and inversion across subsequent candles
  for (const fvg of fvgs) {
    // Find index of candle following the 3-bar formation
    const startIndex = fvg.candleIndex + 2;

    for (let k = startIndex; k < candles.length; k++) {
      const c = candles[k];

      if (fvg.type === 'bullish') {
        // Mitigation check: low touches into the gap
        if (c.low <= fvg.top && !fvg.mitigated) {
          fvg.mitigated = true;
          fvg.mitigatedAtTimestamp = c.timestamp;
        }

        // Inversion check (IFVG): candle closes below the bottom of the bullish FVG
        if (c.close < fvg.bottom && !fvg.inverted) {
          fvg.inverted = true;
          fvg.invertedAtTimestamp = c.timestamp;

          // Creates Bearish IFVG (broken bullish gap becomes resistance)
          ifvgs.push({
            id: `ifvg_bear_${fvg.id}`,
            originalFvgId: fvg.id,
            type: 'bearish',
            top: fvg.top,
            bottom: fvg.bottom,
            timestamp: c.timestamp,
            mitigated: false
          });
          break; // Stop tracking original FVG once inverted
        }
      } else {
        // Bearish FVG
        // Mitigation check: high touches into the gap
        if (c.high >= fvg.bottom && !fvg.mitigated) {
          fvg.mitigated = true;
          fvg.mitigatedAtTimestamp = c.timestamp;
        }

        // Inversion check (IFVG): candle closes above top of the bearish FVG
        if (c.close > fvg.top && !fvg.inverted) {
          fvg.inverted = true;
          fvg.invertedAtTimestamp = c.timestamp;

          // Creates Bullish IFVG (broken bearish gap becomes support)
          ifvgs.push({
            id: `ifvg_bull_${fvg.id}`,
            originalFvgId: fvg.id,
            type: 'bullish',
            top: fvg.top,
            bottom: fvg.bottom,
            timestamp: c.timestamp,
            mitigated: false
          });
          break;
        }
      }
    }
  }

  // Step 3: Track mitigation of created IFVGs
  for (const ifvg of ifvgs) {
    const startIndex = candles.findIndex(c => c.timestamp === ifvg.timestamp);
    if (startIndex !== -1) {
      for (let k = startIndex + 1; k < candles.length; k++) {
        const c = candles[k];
        if (ifvg.type === 'bearish' && c.high >= ifvg.bottom) {
          ifvg.mitigated = true;
          break;
        } else if (ifvg.type === 'bullish' && c.low <= ifvg.top) {
          ifvg.mitigated = true;
          break;
        }
      }
    }
  }

  const activeFvgs = fvgs.filter(f => !f.inverted);
  const activeIfvgs = ifvgs.filter(f => !f.mitigated);

  return {
    fvgs,
    ifvgs,
    activeFvgs,
    activeIfvgs
  };
}
