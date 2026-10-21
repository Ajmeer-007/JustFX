import { describe, it, expect } from 'vitest';
import { Candle } from '@/types/market';
import { detectFvgAndIfvg } from '@/lib/ict-engine/fvg';
import { detectDisplacement } from '@/lib/ict-engine/displacement';
import { detectLiquiditySweeps, findSwingPoints } from '@/lib/ict-engine/liquidity';
import { detectCisd } from '@/lib/ict-engine/cisd';
import { calculateDealingRange, getZonePosition } from '@/lib/ict-engine/dealing-range';
import { checkSilverBullet, formatTimeInTimezones } from '@/lib/ict-engine/silver-bullet';
import { resampleCandles } from '@/lib/market-data/resampler';
import { validateAndCleanCandles } from '@/lib/market-data/validator';

describe('Market Data Validation & Resampling', () => {
  it('deduplicates and cleans out-of-order candles', () => {
    const raw: Candle[] = [
      { timestamp: 200, open: 10, high: 12, low: 9, close: 11, volume: 100, source: 'yahoo', isComplete: true },
      { timestamp: 100, open: 10, high: 11, low: 9, close: 10, volume: 50, source: 'yahoo', isComplete: true },
      { timestamp: 100, open: 10, high: 11, low: 9, close: 10, volume: 80, source: 'yahoo', isComplete: true } // Duplicate with higher volume
    ];

    const res = validateAndCleanCandles(raw, '1m', 300);
    expect(res.cleanCandles.length).toBe(2);
    expect(res.cleanCandles[0].timestamp).toBe(100);
    expect(res.cleanCandles[0].volume).toBe(80);
    expect(res.duplicatesRemoved).toBe(1);
    expect(res.outOfOrderFixed).toBe(1);
  });

  it('resamples 1m candles into 3m candles accurately', () => {
    const candles1m: Candle[] = [
      { timestamp: 0, open: 100, high: 105, low: 98, close: 102, volume: 10, source: 'yahoo', isComplete: true },
      { timestamp: 60, open: 102, high: 108, low: 101, close: 107, volume: 20, source: 'yahoo', isComplete: true },
      { timestamp: 120, open: 107, high: 107, low: 99, close: 104, volume: 15, source: 'yahoo', isComplete: true },
      { timestamp: 180, open: 104, high: 110, low: 103, close: 109, volume: 25, source: 'yahoo', isComplete: true }
    ];

    const res = resampleCandles(candles1m, '3m');
    expect(res.length).toBe(2);

    // First 3m bucket (0 to 179s)
    expect(res[0].timestamp).toBe(0);
    expect(res[0].open).toBe(100);
    expect(res[0].high).toBe(108);
    expect(res[0].low).toBe(98);
    expect(res[0].close).toBe(104);
    expect(res[0].volume).toBe(45); // 10 + 20 + 15
  });
});

describe('ICT Engine - FVG & Inversion', () => {
  it('detects a bullish FVG and tracks its mitigation', () => {
    const candles: Candle[] = [
      { timestamp: 100, open: 100, high: 102, low: 99, close: 101, volume: 10, source: 'yahoo', isComplete: true }, // C1: High 102
      { timestamp: 200, open: 101, high: 110, low: 101, close: 109, volume: 50, source: 'yahoo', isComplete: true }, // C2: Displacement
      { timestamp: 300, open: 109, high: 112, low: 105, close: 111, volume: 20, source: 'yahoo', isComplete: true }, // C3: Low 105. Gap 102-105!
      { timestamp: 400, open: 111, high: 111, low: 103, close: 106, volume: 15, source: 'yahoo', isComplete: true }  // C4: Dips to 103 (mitigates gap)
    ];

    const result = detectFvgAndIfvg(candles);
    expect(result.fvgs.length).toBe(1);
    expect(result.fvgs[0].type).toBe('bullish');
    expect(result.fvgs[0].top).toBe(105);
    expect(result.fvgs[0].bottom).toBe(102);
    expect(result.fvgs[0].mitigated).toBe(true);
  });

  it('detects an Inverse Fair Value Gap (IFVG) when price closes through the gap', () => {
    const candles: Candle[] = [
      { timestamp: 100, open: 100, high: 102, low: 99, close: 101, volume: 10, source: 'yahoo', isComplete: true },
      { timestamp: 200, open: 101, high: 110, low: 101, close: 109, volume: 50, source: 'yahoo', isComplete: true },
      { timestamp: 300, open: 109, high: 112, low: 105, close: 111, volume: 20, source: 'yahoo', isComplete: true }, // Bullish FVG [102, 105]
      { timestamp: 400, open: 111, high: 111, low: 98, close: 99, volume: 60, source: 'yahoo', isComplete: true }   // Closes below bottom 102!
    ];

    const result = detectFvgAndIfvg(candles);
    expect(result.fvgs[0].inverted).toBe(true);
    expect(result.ifvgs.length).toBe(1);
    expect(result.ifvgs[0].type).toBe('bearish'); // Bullish gap broken down becomes bearish resistance
    expect(result.ifvgs[0].top).toBe(105);
    expect(result.ifvgs[0].bottom).toBe(102);
  });
});

describe('ICT Engine - Liquidity Sweeps & CISD', () => {
  it('detects a confirmed buy-side liquidity sweep and bearish CISD', () => {
    const candles: Candle[] = [
      // Swing high formation around index 2
      { timestamp: 100, open: 100, high: 102, low: 99, close: 101, volume: 10, source: 'yahoo', isComplete: true },
      { timestamp: 200, open: 101, high: 104, low: 100, close: 103, volume: 10, source: 'yahoo', isComplete: true },
      { timestamp: 300, open: 103, high: 110, low: 102, close: 108, volume: 20, source: 'yahoo', isComplete: true }, // Swing High at 110
      { timestamp: 400, open: 108, high: 106, low: 102, close: 103, volume: 15, source: 'yahoo', isComplete: true },
      { timestamp: 500, open: 103, high: 105, low: 101, close: 104, volume: 10, source: 'yahoo', isComplete: true },
      // Sweep candle: spikes to 112 (> 110), but closes at 107 (< 110)
      { timestamp: 600, open: 104, high: 112, low: 103, close: 107, volume: 45, source: 'yahoo', isComplete: true },
      // Follow-through candle closing below reference
      { timestamp: 700, open: 107, high: 107, low: 98, close: 99, volume: 50, source: 'yahoo', isComplete: true }
    ];

    const swingPoints = findSwingPoints(candles, 2, 2);
    expect(swingPoints.some(p => p.type === 'high' && p.price === 110)).toBe(true);

    const sweeps = detectLiquiditySweeps(candles, swingPoints);
    expect(sweeps.length).toBeGreaterThan(0);
    const bslSweep = sweeps.find(s => s.direction === 'SELL');
    expect(bslSweep).toBeDefined();
    expect(bslSweep?.sweepPrice).toBe(112);
    expect(bslSweep?.rejectionClose).toBe(107);

    const cisdEvents = detectCisd(candles, sweeps);
    expect(cisdEvents.length).toBeGreaterThan(0);
    expect(cisdEvents[0].direction).toBe('SELL');
  });
});

describe('ICT Engine - Premium / Discount & Silver Bullet', () => {
  it('correctly calculates dealing range equilibrium and zone position', () => {
    const candles: Candle[] = [
      { timestamp: 1000, open: 2000, high: 2050, low: 1950, close: 2010, volume: 100, source: 'yahoo', isComplete: true }
    ];

    const dr = calculateDealingRange(candles, 'recent_bars', 10);
    expect(dr).not.toBeNull();
    expect(dr!.high).toBe(2050);
    expect(dr!.low).toBe(1950);
    expect(dr!.equilibrium).toBe(2000);

    expect(getZonePosition(2030, dr!)).toBe('PREMIUM');
    expect(getZonePosition(1970, dr!)).toBe('DISCOUNT');
  });

  it('accurately identifies Silver Bullet windows and formats time in NY & IST', () => {
    // 10:30 AM New York time on 2024-10-15 (EDT is UTC-4 => 14:30 UTC => 1728999000)
    // 14:30 UTC in seconds:
    const testUtcSec = Math.floor(new Date('2024-10-15T14:30:00Z').getTime() / 1000);
    const check = checkSilverBullet(testUtcSec);
    expect(check.isInWindow).toBe(true);
    expect(check.windowName).toContain('New York AM');

    const formatted = formatTimeInTimezones(testUtcSec);
    expect(formatted.nyTime).toContain('10:30:00');
    expect(formatted.istTime).toContain('20:00:00'); // 14:30 UTC + 5:30 = 20:00 IST
  });
});
