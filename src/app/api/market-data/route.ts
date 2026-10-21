import { NextRequest, NextResponse } from 'next/server';
import { getMarketCandles } from '@/lib/market-data/provider';
import { SupportedInstrument, SupportedTimeframe } from '@/types/market';
import { SUPPORTED_INSTRUMENTS, SUPPORTED_TIMEFRAMES } from '@/lib/market-data/symbols';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const instrument = (searchParams.get('instrument') || 'XAUUSD') as SupportedInstrument;
    const timeframe = (searchParams.get('timeframe') || '5m') as SupportedTimeframe;
    const range = searchParams.get('range') || undefined;

    if (!SUPPORTED_INSTRUMENTS[instrument]) {
      return NextResponse.json({ error: `Unsupported instrument: ${instrument}` }, { status: 400 });
    }

    if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) {
      return NextResponse.json({ error: `Unsupported timeframe: ${timeframe}` }, { status: 400 });
    }

    const data = await getMarketCandles({ instrument, timeframe, range });

    if (data.candles.length === 0) {
      return NextResponse.json({
        success: false,
        instrument,
        timeframe,
        feedStatus: data.feedStatus,
        candleCount: 0,
        candles: [],
        error: data.feedStatus.error || 'No market candles are currently available'
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      instrument,
      timeframe,
      feedStatus: data.feedStatus,
      candleCount: data.candles.length,
      candles: data.candles
    });
  } catch (err: any) {
    console.error('Market data route error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch market data' }, { status: 500 });
  }
}
