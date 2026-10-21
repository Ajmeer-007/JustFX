import { NextResponse } from 'next/server';
import { getMarketCandles } from '@/lib/market-data/provider';
import { SupportedInstrument } from '@/types/market';

export const dynamic = 'force-dynamic';

export async function GET() {
  const instruments: SupportedInstrument[] = ['XAUUSD', 'XAGUSD', 'EURUSD', 'BTCUSD'];

  try {
    const results = await Promise.allSettled(
      instruments.map(inst => getMarketCandles({ instrument: inst, timeframe: '5m', range: '1d' }))
    );

    const overview = instruments.map((inst, idx) => {
      const res = results[idx];
      if (res.status === 'fulfilled') {
        const { feedStatus } = res.value;
        return {
          symbol: inst,
          lastPrice: feedStatus.lastPrice,
          bid: feedStatus.bid,
          ask: feedStatus.ask,
          dailyChange: feedStatus.dailyChange,
          dailyChangePercent: feedStatus.dailyChangePercent,
          source: feedStatus.source,
          status: feedStatus.isStale ? 'stale' : 'connected',
          isLive: !feedStatus.isStale,
          lastUpdate: Date.now()
        };
      } else {
        return {
          symbol: inst,
          lastPrice: 0,
          bid: 0,
          ask: 0,
          dailyChange: 0,
          dailyChangePercent: 0,
          source: 'unknown',
          status: 'disconnected',
          isLive: false,
          lastUpdate: Date.now(),
          error: res.reason?.message
        };
      }
    });

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      instruments: overview
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
