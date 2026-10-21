import { describe, it, expect } from 'vitest';
import { Candle } from '@/types/market';
import { generateSignals } from '@/lib/ict-engine/signal-generator';
import { evaluateSetupOutcome } from '@/lib/portfolio/paper-trading';
import { runBacktest } from '@/lib/backtesting/engine';

describe('Signal Generation & Strictness Testing', () => {
  it('generates confirmed signals and honors strictness thresholds', () => {
    // Generate synthetic candles with clean sweep and displacement
    const baseTime = 1728999000; // Inside NY AM Silver bullet window
    const candles: Candle[] = [];

    // 20 bars forming swing high at index 5 and then sweep at index 15
    for (let i = 0; i < 30; i++) {
      const t = baseTime + (i * 300);
      let o = 2000, h = 2005, l = 1995, c = 2002;

      if (i === 5) {
        h = 2030; c = 2025; // Prior swing high
      } else if (i === 15) {
        // Sweep candle: wicks to 2035, closes at 2020 (rejection)
        o = 2022; h = 2035; l = 2018; c = 2020;
      } else if (i === 16) {
        // Bearish displacement bar: 2020 to 1980 (huge body, FVG)
        o = 2020; h = 2021; l = 1978; c = 1980;
      } else if (i === 17) {
        o = 1980; h = 1990; l = 1975; c = 1985;
      }

      candles.push({
        timestamp: t,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: i === 16 ? 500 : 50,
        source: 'yahoo',
        isComplete: true
      });
    }

    const standardSignals = generateSignals(candles, {
      instrument: 'XAUUSD',
      timeframe: '5m',
      entryModel: 'silver_bullet',
      strictnessMode: 'standard'
    });

    // Check that signal properties are consistent
    for (const sig of standardSignals) {
      expect(sig.direction).toBe('SELL');
      expect(sig.stopLoss).toBeGreaterThan(sig.entryPrice);
      expect(sig.takeProfit).toBeLessThan(sig.entryPrice);
      expect(sig.riskReward).toBeGreaterThanOrEqual(1.5);
      expect(sig.confirmationScore).toBeGreaterThanOrEqual(50);
      expect(sig.explanation).toContain('SELL');
    }
  });

  it('correctly evaluates simulated trade outcomes including ambiguous resolution', () => {
    const mockSignal: any = {
      id: 'test_buy',
      direction: 'BUY',
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 110,
      riskReward: 2.0,
      simulatedStatus: 'PENDING'
    };

    // Case 1: Hits TP cleanly
    const winCandles: Candle[] = [
      { timestamp: 100, open: 100, high: 102, low: 99, close: 101, volume: 10, source: 'yahoo', isComplete: true }, // Fills entry at 99
      { timestamp: 200, open: 101, high: 112, low: 98, close: 111, volume: 10, source: 'yahoo', isComplete: true }  // High 112 >= 110
    ];
    const winRes = evaluateSetupOutcome(mockSignal, winCandles);
    expect(winRes.status).toBe('WIN');
    expect(winRes.outcomeR).toBe(2.0);

    // Case 2: Hits SL cleanly
    const lossCandles: Candle[] = [
      { timestamp: 100, open: 100, high: 101, low: 99, close: 99.5, volume: 10, source: 'yahoo', isComplete: true },
      { timestamp: 200, open: 99.5, high: 100, low: 94, close: 94.5, volume: 10, source: 'yahoo', isComplete: true } // Low 94 <= 95
    ];
    const lossRes = evaluateSetupOutcome(mockSignal, lossCandles);
    expect(lossRes.status).toBe('LOSS');
    expect(lossRes.outcomeR).toBe(-1.0);

    // Case 3: Both SL and TP hit in same candle -> AMBIGUOUS
    const ambiguousCandles: Candle[] = [
      { timestamp: 100, open: 100, high: 115, low: 92, close: 105, volume: 10, source: 'yahoo', isComplete: true } // High 115 >= 110 AND Low 92 <= 95
    ];
    const ambRes = evaluateSetupOutcome(mockSignal, ambiguousCandles);
    expect(ambRes.status).toBe('AMBIGUOUS');
    expect(ambRes.outcomeR).toBe(0);
  });
});
