import { Candle, SupportedInstrument, SupportedTimeframe } from '@/types/market';
import { getInstrumentMetadata } from './symbols';
import { resampleCandles } from './resampler';
import { validateAndCleanCandles } from './validator';

export interface FetchCandlesOptions {
  instrument: SupportedInstrument;
  timeframe: SupportedTimeframe;
  range?: string; // e.g. '1d', '5d', '1mo', '3mo'
  limit?: number;
}

/**
 * Fetches historical and recent candles from Binance for BTCUSD.
 */
async function fetchBinanceCandles(timeframe: SupportedTimeframe, limit: number = 500): Promise<Candle[]> {
  // Map timeframes to Binance interval
  const intervalMap: Record<SupportedTimeframe, string> = {
    '1m': '1m',
    '3m': '3m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d'
  };

  const interval = intervalMap[timeframe] || '5m';
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Binance API error: ${res.statusText}`);
  }

  const raw = await res.json();
  const candles: Candle[] = raw.map((item: any[]) => ({
    timestamp: Math.floor(item[0] / 1000),
    open: parseFloat(item[1]),
    high: parseFloat(item[2]),
    low: parseFloat(item[3]),
    close: parseFloat(item[4]),
    volume: parseFloat(item[5]),
    source: 'binance',
    isComplete: Number(item[6]) < Date.now()
  }));

  return candles;
}

/**
 * Fetches candles from Yahoo Finance with fallback and resampling.
 */
async function fetchYahooCandles(
  symbol: string,
  timeframe: SupportedTimeframe,
  range: string = '5d'
): Promise<Candle[]> {
  // Yahoo intervals supported: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo
  let interval = '5m';
  let needsResampling = false;

  switch (timeframe) {
    case '1m':
      interval = '1m';
      range = '1d';
      break;
    case '3m':
      interval = '1m'; // Resample 1m to 3m
      range = '1d';
      needsResampling = true;
      break;
    case '5m':
      interval = '5m';
      range = range || '5d';
      break;
    case '15m':
      interval = '15m';
      range = range || '10d';
      break;
    case '1h':
      interval = '1h';
      range = range || '1mo';
      break;
    case '4h':
      interval = '1h'; // Resample 1h to 4h
      range = range || '3mo';
      needsResampling = true;
      break;
    case '1d':
      interval = '1d';
      range = range || '6mo';
      break;
    default:
      interval = '5m';
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance error: HTTP ${res.status}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    return [];
  }

  const timestamps: number[] = result.timestamp;
  const quote = result.indicators.quote[0];
  const candles: Candle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open[i];
    const h = quote.high[i];
    const l = quote.low[i];
    const c = quote.close[i];
    const v = quote.volume ? quote.volume[i] || 0 : 0;

    // Filter null or unformed quotes
    if (o !== null && h !== null && l !== null && c !== null && !isNaN(o)) {
      candles.push({
        timestamp: timestamps[i],
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
        source: 'yahoo',
        isComplete: i < timestamps.length - 1
      });
    }
  }

  if (needsResampling) {
    return resampleCandles(candles, timeframe);
  }

  return candles;
}

/**
 * Universal Market Data Fetcher.
 * Automatically chooses the optimal feed, normalizes symbols and timestamps, cleans data, and reports health.
 */
export async function getMarketCandles(options: FetchCandlesOptions): Promise<{
  candles: Candle[];
  feedStatus: {
    source: string;
    isStale: boolean;
    lastPrice: number;
    bid: number;
    ask: number;
    dailyChange: number;
    dailyChangePercent: number;
    candleCount: number;
    error?: string;
  };
}> {
  const { instrument, timeframe, range } = options;
  const meta = getInstrumentMetadata(instrument);
  let rawCandles: Candle[] = [];
  let source = 'yahoo';
  let feedError: string | undefined;

  try {
    if (instrument === 'BTCUSD') {
      rawCandles = await fetchBinanceCandles(timeframe, 500);
      source = 'binance';
    } else {
      rawCandles = await fetchYahooCandles(meta.yahooSymbol, timeframe, range);
      source = 'yahoo';
    }
  } catch (err: any) {
    feedError = err?.message || 'Market data request failed';
    console.error(`Failed to fetch from primary feed for ${instrument}:`, err.message);
    // In case primary Binance fails, fallback to Yahoo for BTC-USD
    if (instrument === 'BTCUSD') {
      try {
        rawCandles = await fetchYahooCandles('BTC-USD', timeframe, range);
        source = 'yahoo_fallback';
      } catch (fallbackErr) {
        const fallbackMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        feedError = `${feedError}; Yahoo fallback failed: ${fallbackMessage}`;
        console.error('Fallback also failed:', fallbackErr);
      }
    }
  }

  // Validate, deduplicate, and sort
  const validated = validateAndCleanCandles(rawCandles, timeframe);
  const cleanCandles = validated.cleanCandles;

  const latestCandle = cleanCandles.length > 0 ? cleanCandles[cleanCandles.length - 1] : null;
  const prevCandle = cleanCandles.length > 1 ? cleanCandles[cleanCandles.length - 2] : null;

  const lastPrice = latestCandle ? latestCandle.close : 0;
  const halfSpread = meta.defaultSpread / 2;
  const bid = lastPrice > 0 ? parseFloat((lastPrice - halfSpread).toFixed(meta.priceDecimals)) : 0;
  const ask = lastPrice > 0 ? parseFloat((lastPrice + halfSpread).toFixed(meta.priceDecimals)) : 0;

  const firstCandleOfDay = cleanCandles[0];
  const dayOpen = firstCandleOfDay ? firstCandleOfDay.open : lastPrice;
  const dailyChange = lastPrice - dayOpen;
  const dailyChangePercent = dayOpen > 0 ? (dailyChange / dayOpen) * 100 : 0;

  return {
    candles: cleanCandles,
    feedStatus: {
      source,
      isStale: validated.isStale,
      lastPrice,
      bid,
      ask,
      dailyChange: parseFloat(dailyChange.toFixed(meta.priceDecimals)),
      dailyChangePercent: parseFloat(dailyChangePercent.toFixed(2)),
      candleCount: cleanCandles.length,
      ...(cleanCandles.length === 0 ? { error: feedError || `No candles returned by ${source}` } : {})
    }
  };
}
