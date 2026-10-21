import { Candle, SupportedInstrument, SupportedTimeframe } from '@/types/market';
import { EntryModelType, StrictnessMode } from '@/types/ict';
import { generateSignals } from '../ict-engine/signal-generator';
import { evaluateSetupOutcome } from '../portfolio/paper-trading';
import { getInstrumentMetadata } from '../market-data/symbols';

export interface BacktestConfig {
  instrument: SupportedInstrument;
  timeframe: SupportedTimeframe;
  entryModel: EntryModelType;
  strictnessMode: StrictnessMode;
  includeCosts?: boolean;
  minRiskReward?: number;
}

export interface BacktestTrade {
  id: string;
  entryTime: number;
  exitTime?: number;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  outcome: 'WIN' | 'LOSS' | 'AMBIGUOUS' | 'UNRESOLVED';
  outcomeR: number;
  netPnlR: number; // After spread & commission deduction
  explanation: string;
}

export interface EquityPoint {
  time: number;
  equityR: number;
  drawdownPercent: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  totalCandles: number;
  dataStartDate: string;
  dataEndDate: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  ambiguousTrades: number;
  unresolvedTrades: number;
  winRate: number; // percentage
  profitFactor: number;
  maxDrawdownR: number;
  maxDrawdownPercent: number;
  netResultR: number;
  averageRiskReward: number;
  averageWinR: number;
  averageLossR: number;
  rDistribution: Record<string, number>;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
}

/**
 * Runs a deterministic historical backtest without look-ahead bias.
 */
export function runBacktest(candles: Candle[], config: BacktestConfig): BacktestResult {
  const { instrument, timeframe, entryModel, strictnessMode, includeCosts = true, minRiskReward = 1.5 } = config;
  const meta = getInstrumentMetadata(instrument);

  if (candles.length < 50) {
    return {
      config,
      totalCandles: candles.length,
      dataStartDate: '',
      dataEndDate: '',
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      ambiguousTrades: 0,
      unresolvedTrades: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdownR: 0,
      maxDrawdownPercent: 0,
      netResultR: 0,
      averageRiskReward: 0,
      averageWinR: 0,
      averageLossR: 0,
      rDistribution: {},
      trades: [],
      equityCurve: []
    };
  }

  const startDate = new Date(candles[0].timestamp * 1000).toISOString().split('T')[0];
  const endDate = new Date(candles[candles.length - 1].timestamp * 1000).toISOString().split('T')[0];

  // Generate signals deterministically across candle history
  const signals = generateSignals(candles, {
    instrument,
    timeframe,
    entryModel,
    strictnessMode,
    minRiskReward
  });

  const trades: BacktestTrade[] = [];
  const costDeductionR = includeCosts ? 0.08 : 0; // ~0.08R equivalent for realistic spread + commission

  for (const sig of signals) {
    const candleIndex = candles.findIndex(c => c.timestamp === sig.candleTimestamp);
    if (candleIndex === -1 || candleIndex >= candles.length - 1) continue;

    // Subsequent price action strictly starting from NEXT candle (no look-ahead bias!)
    const subsequent = candles.slice(candleIndex + 1);
    const evalResult = evaluateSetupOutcome(sig, subsequent, includeCosts ? meta.defaultSpread : 0);

    let netR = 0;
    if (evalResult.status === 'WIN') {
      netR = (evalResult.outcomeR || sig.riskReward) - costDeductionR;
    } else if (evalResult.status === 'LOSS') {
      netR = -1.0 - costDeductionR;
    } else if (evalResult.status === 'AMBIGUOUS') {
      netR = -0.5; // Conservative penalty for ambiguous resolution
    }

    trades.push({
      id: sig.id,
      entryTime: sig.candleTimestamp,
      exitTime: evalResult.exitTimestamp,
      direction: sig.direction,
      entryPrice: sig.entryPrice,
      stopLoss: sig.stopLoss,
      takeProfit: sig.takeProfit,
      riskReward: sig.riskReward,
      outcome: evalResult.status === 'PENDING' || evalResult.status === 'ACTIVE' ? 'UNRESOLVED' : evalResult.status,
      outcomeR: evalResult.outcomeR || 0,
      netPnlR: parseFloat(netR.toFixed(2)),
      explanation: sig.explanation
    });
  }

  // Calculate statistics
  let winningTrades = 0;
  let losingTrades = 0;
  let ambiguousTrades = 0;
  let unresolvedTrades = 0;
  let grossWinR = 0;
  let grossLossR = 0;
  let totalRrSum = 0;

  const rDistribution: Record<string, number> = {
    'Loss (-1R)': 0,
    'Ambiguous': 0,
    'Win (1R to 2R)': 0,
    'Win (2R to 3R)': 0,
    'Win (3R+)': 0
  };

  const equityCurve: EquityPoint[] = [{ time: candles[0].timestamp, equityR: 0, drawdownPercent: 0 }];
  let runningEquity = 0;
  let peakEquity = 0;
  let maxDrawdownR = 0;

  for (const t of trades) {
    totalRrSum += t.riskReward;

    if (t.outcome === 'WIN') {
      winningTrades++;
      grossWinR += t.netPnlR;
      if (t.netPnlR >= 3.0) rDistribution['Win (3R+)']++;
      else if (t.netPnlR >= 2.0) rDistribution['Win (2R to 3R)']++;
      else rDistribution['Win (1R to 2R)']++;
    } else if (t.outcome === 'LOSS') {
      losingTrades++;
      grossLossR += Math.abs(t.netPnlR);
      rDistribution['Loss (-1R)']++;
    } else if (t.outcome === 'AMBIGUOUS') {
      ambiguousTrades++;
      rDistribution['Ambiguous']++;
    } else {
      unresolvedTrades++;
    }

    runningEquity += t.netPnlR;
    if (runningEquity > peakEquity) peakEquity = runningEquity;
    const dd = peakEquity - runningEquity;
    if (dd > maxDrawdownR) maxDrawdownR = dd;

    const ddPercent = peakEquity > 0 ? (dd / (100 + peakEquity)) * 100 : 0;

    equityCurve.push({
      time: t.exitTime || t.entryTime,
      equityR: parseFloat(runningEquity.toFixed(2)),
      drawdownPercent: parseFloat(ddPercent.toFixed(2))
    });
  }

  const closedTradesCount = winningTrades + losingTrades + ambiguousTrades;
  const winRate = closedTradesCount > 0 ? (winningTrades / closedTradesCount) * 100 : 0;
  const profitFactor = grossLossR > 0 ? grossWinR / grossLossR : (grossWinR > 0 ? 99.0 : 0);
  const averageWinR = winningTrades > 0 ? grossWinR / winningTrades : 0;
  const averageLossR = losingTrades > 0 ? grossLossR / losingTrades : 0;
  const averageRiskReward = trades.length > 0 ? totalRrSum / trades.length : 0;

  return {
    config,
    totalCandles: candles.length,
    dataStartDate: startDate,
    dataEndDate: endDate,
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    ambiguousTrades,
    unresolvedTrades,
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    maxDrawdownR: parseFloat(maxDrawdownR.toFixed(2)),
    maxDrawdownPercent: parseFloat(((maxDrawdownR / 100) * 100).toFixed(2)),
    netResultR: parseFloat(runningEquity.toFixed(2)),
    averageRiskReward: parseFloat(averageRiskReward.toFixed(2)),
    averageWinR: parseFloat(averageWinR.toFixed(2)),
    averageLossR: parseFloat(averageLossR.toFixed(2)),
    rDistribution,
    trades,
    equityCurve
  };
}
