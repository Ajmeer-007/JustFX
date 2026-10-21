import { Candle, SupportedInstrument, SupportedTimeframe } from '@/types/market';
import {
  ConfirmedSignal,
  EntryModelType,
  HtfBias,
  SignalDirection,
  StrictnessMode
} from '@/types/ict';
import { detectFvgAndIfvg } from './fvg';
import { detectDisplacement } from './displacement';
import { detectLiquiditySweeps, findSwingPoints } from './liquidity';
import { detectOrderBlocks } from './order-blocks';
import { calculateDealingRange, getZonePosition } from './dealing-range';
import { checkSilverBullet, formatTimeInTimezones } from './silver-bullet';
import { getInstrumentMetadata } from '../market-data/symbols';

export interface SignalGeneratorOptions {
  instrument: SupportedInstrument;
  timeframe: SupportedTimeframe;
  entryModel: EntryModelType;
  strictnessMode: StrictnessMode;
  htfBias?: HtfBias;
  minRiskReward?: number;
}

/**
 * Deterministically analyzes candle history and generates confirmed ICT/SMC signals.
 * Evaluates entry models, strictness criteria, structural stop-loss, and liquidity take-profit.
 */
export function generateSignals(
  candles: Candle[],
  options: SignalGeneratorOptions
): ConfirmedSignal[] {
  const { instrument, timeframe, entryModel, strictnessMode, htfBias, minRiskReward = 1.5 } = options;
  const signals: ConfirmedSignal[] = [];

  if (candles.length < 20) return signals;

  const meta = getInstrumentMetadata(instrument);

  // 1. Run all ICT core algorithms
  const swingPoints = findSwingPoints(candles, 2, 2);
  const sweeps = detectLiquiditySweeps(candles, swingPoints);
  const displacements = detectDisplacement(candles, {
    minAtrRatio: strictnessMode === 'strict' ? 1.8 : 1.35,
    minBodyToRangeRatio: strictnessMode === 'strict' ? 0.68 : 0.52
  });
  const { fvgs, ifvgs } = detectFvgAndIfvg(candles);
  const orderBlocks = detectOrderBlocks(candles, displacements, fvgs);
  const dealingRange = calculateDealingRange(candles, 'ny_session');

  // Map sweeps and displacements by timestamp
  const sweepMap = new Map<number, typeof sweeps[0]>();
  for (const s of sweeps) {
    sweepMap.set(s.sweepTimestamp, s);
  }

  const barSeconds = candles.length > 1 ? (candles[1].timestamp - candles[0].timestamp) : 300;

  // Iterate over candles from recent history
  // For intraday scalping, examine candles that have closed
  for (let i = 15; i < candles.length - 1; i++) {
    const currentCandle = candles[i];
    const timestampSec = currentCandle.timestamp;

    // Check Silver Bullet window for current candle
    const sbCheck = checkSilverBullet(timestampSec);

    // If entryModel is 'silver_bullet', signal must occur within or adjacent to the window
    if (entryModel === 'silver_bullet' && !sbCheck.isInWindow) {
      continue;
    }

    // Look for setups in both directions
    for (const direction of ['BUY', 'SELL'] as SignalDirection[]) {
      // Find relevant recent sweep (within last 15 bars)
      const recentSweep = sweeps.find(
        s => s.direction === direction &&
        s.sweepTimestamp <= timestampSec &&
        s.sweepTimestamp >= timestampSec - (15 * barSeconds)
      );

      // Find displacement in direction within last 4 bars
      let recentDisp = undefined;
      for (let offset = 0; offset <= 4; offset++) {
        if (i - offset >= 0) {
          const d = displacements.get(candles[i - offset].timestamp);
          if (d && d.direction === direction) {
            recentDisp = d;
            break;
          }
        }
      }

      if (!recentDisp) {
        continue;
      }

      // Find active FVG or OB formed within last 20 bars
      const activeFvg = fvgs.find(
        f => f.type === (direction === 'BUY' ? 'bullish' : 'bearish') &&
        f.timestamp <= timestampSec &&
        f.timestamp >= timestampSec - (20 * barSeconds)
      );

      const activeOb = orderBlocks.find(
        ob => ob.type === (direction === 'BUY' ? 'bullish' : 'bearish') &&
        ob.timestamp <= timestampSec &&
        ob.timestamp >= timestampSec - (20 * barSeconds)
      );

      // If entryModel is 'ifvg_inversion', must have inverted FVG
      const activeIfvg = ifvgs.find(
        inv => inv.type === (direction === 'BUY' ? 'bullish' : 'bearish') &&
        inv.timestamp <= timestampSec
      );

      if (entryModel === 'ifvg_inversion' && !activeIfvg) {
        continue;
      }

      // Check Dealing Range Equilibrium (Premium / Discount)
      let inOptimalZone = false;
      if (dealingRange) {
        const zonePos = getZonePosition(currentCandle.close, dealingRange);
        inOptimalZone = (direction === 'BUY' && zonePos === 'DISCOUNT') ||
                        (direction === 'SELL' && zonePos === 'PREMIUM');
      }

      // Compute confirmation score (0 - 100)
      let score = 0;
      const passedConditions: string[] = [];
      const failedConditions: string[] = [];

      // Factor 1: Liquidity Sweep
      if (recentSweep) {
        score += 25;
        passedConditions.push(`Confirmed ${recentSweep.levelType} sweep at ${recentSweep.sweepPrice.toFixed(meta.priceDecimals)}`);
      } else {
        failedConditions.push('No recent liquidity sweep detected');
      }

      // Factor 2: Strong Displacement
      if (recentDisp) {
        score += 20;
        passedConditions.push(`Displacement confirmed: ${recentDisp.atrRatio.toFixed(1)}x ATR, ${(recentDisp.bodyRatio * 100).toFixed(0)}% body`);
      } else {
        failedConditions.push('Lack of decisive displacement');
      }

      // Factor 3: FVG / Order Block Confluence
      if (activeFvg || activeOb || activeIfvg) {
        score += 20;
        passedConditions.push(`Imbalance zone confluence: ${activeFvg ? 'FVG' : ''} ${activeOb ? 'Order Block' : ''} ${activeIfvg ? 'IFVG' : ''}`.trim());
      } else {
        failedConditions.push('No unmitigated FVG or Order Block confluence');
      }

      // Factor 4: Premium / Discount Dealing Range
      if (inOptimalZone) {
        score += 15;
        passedConditions.push(`Price is in favorable ${direction === 'BUY' ? 'Discount' : 'Premium'} dealing range`);
      } else {
        failedConditions.push(`Price not in optimal ${direction === 'BUY' ? 'Discount' : 'Premium'} zone`);
      }

      // Factor 5: Silver Bullet Time Window
      if (sbCheck.isInWindow) {
        score += 10;
        passedConditions.push(`Active inside ${sbCheck.windowName}`);
      } else {
        failedConditions.push('Outside primary Silver Bullet window');
      }

      // Factor 6: Higher Timeframe Bias
      if (htfBias) {
        if (htfBias === (direction === 'BUY' ? 'BULLISH' : 'BEARISH')) {
          score += 10;
          passedConditions.push(`HTF bias aligned: ${htfBias}`);
        } else if (htfBias !== 'NEUTRAL') {
          failedConditions.push(`HTF bias conflicting: ${htfBias}`);
          if (strictnessMode === 'strict') {
            // Strict mode rejects signals conflicting with HTF trend
            continue;
          }
        }
      }

      // Strictness threshold evaluation
      const minScoreThreshold = strictnessMode === 'strict' ? 65 : 45;
      if (score < minScoreThreshold) {
        continue;
      }

      // Entry, Stop-Loss and Take-Profit Calculation
      const entryPrice = currentCandle.close;
      let stopLoss: number;

      if (direction === 'BUY') {
        // SL at sweep low extreme or OB bottom with small buffer
        const lowRef = recentSweep ? recentSweep.sweepPrice : (activeOb ? activeOb.bottom : currentCandle.low);
        stopLoss = lowRef - (meta.pipSize * 3);
      } else {
        // Bearish SL at sweep high extreme or OB top with small buffer
        const highRef = recentSweep ? recentSweep.sweepPrice : (activeOb ? activeOb.top : currentCandle.high);
        stopLoss = highRef + (meta.pipSize * 3);
      }

      const risk = Math.abs(entryPrice - stopLoss);
      if (risk <= 0) continue;

      // Find nearest opposing liquidity target
      let targetPrice: number;
      if (direction === 'BUY') {
        const opposingHigh = swingPoints
          .filter(sp => sp.type === 'high' && sp.price > entryPrice)
          .sort((a, b) => a.price - b.price)[0];
        targetPrice = opposingHigh ? opposingHigh.price : entryPrice + (risk * 2.5);
      } else {
        const opposingLow = swingPoints
          .filter(sp => sp.type === 'low' && sp.price < entryPrice)
          .sort((a, b) => b.price - a.price)[0];
        targetPrice = opposingLow ? opposingLow.price : entryPrice - (risk * 2.5);
      }

      // Validate Risk-to-Reward
      const reward = Math.abs(targetPrice - entryPrice);
      const rr = reward / risk;

      if (rr < (strictnessMode === 'strict' ? Math.max(2.0, minRiskReward) : minRiskReward)) {
        continue;
      }

      const formattedTimes = formatTimeInTimezones(timestampSec);
      const signalId = `${instrument}_${timeframe}_${timestampSec}_${direction}`;

      const explanation = `${direction} signal confirmed under ${entryModel.replace('_', ' ').toUpperCase()} model (${strictnessMode} mode). ` +
        `Entry at ${entryPrice.toFixed(meta.priceDecimals)}, SL at ${stopLoss.toFixed(meta.priceDecimals)}, TP at ${targetPrice.toFixed(meta.priceDecimals)} (R:R ${rr.toFixed(2)}). ` +
        `Conditions met: ${passedConditions.join('; ')}.`;

      signals.push({
        id: signalId,
        signalId,
        instrument,
        timeframe,
        direction,
        entryPrice,
        stopLoss,
        takeProfit: targetPrice,
        riskReward: parseFloat(rr.toFixed(2)),
        confirmationScore: score,
        entryModel,
        strictnessMode,
        htfDirection: htfBias,
        timestampNy: formattedTimes.nyTime,
        timestampIst: formattedTimes.istTime,
        candleTimestamp: timestampSec,
        fvg: activeFvg,
        ifvg: activeIfvg,
        orderBlock: activeOb,
        sweep: recentSweep,
        displacement: recentDisp,
        isInSilverBullet: sbCheck.isInWindow,
        silverBulletSession: sbCheck.windowName,
        isInOptimalZone: inOptimalZone,
        explanation,
        passedConditions,
        failedConditions,
        dataQuality: 'live_confirmed',
        simulatedStatus: 'PENDING'
      });
    }
  }

  return signals;
}
