import { NextRequest, NextResponse } from 'next/server';
import { getMarketCandles } from '@/lib/market-data/provider';
import { runBacktest, BacktestConfig } from '@/lib/backtesting/engine';
import { SupportedInstrument, SupportedTimeframe } from '@/types/market';
import { EntryModelType, StrictnessMode } from '@/types/ict';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      instrument = 'XAUUSD',
      timeframe = '5m',
      entryModel = 'silver_bullet',
      strictnessMode = 'standard',
      includeCosts = true,
      minRiskReward = 1.5,
      range = '1mo'
    } = body;

    const config: BacktestConfig = {
      instrument: instrument as SupportedInstrument,
      timeframe: timeframe as SupportedTimeframe,
      entryModel: entryModel as EntryModelType,
      strictnessMode: strictnessMode as StrictnessMode,
      includeCosts: Boolean(includeCosts),
      minRiskReward: parseFloat(minRiskReward)
    };

    const { candles } = await getMarketCandles({
      instrument: config.instrument,
      timeframe: config.timeframe,
      range
    });

    if (candles.length < 30) {
      return NextResponse.json(
        { error: `Insufficient historical candles available for ${instrument} (${timeframe}). Received ${candles.length} candles.` },
        { status: 400 }
      );
    }

    const result = runBacktest(candles, config);

    return NextResponse.json({
      success: true,
      result
    });
  } catch (err: any) {
    console.error('Backtest error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
