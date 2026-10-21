import { InstrumentMetadata, SupportedInstrument } from '@/types/market';

export const SUPPORTED_INSTRUMENTS: Record<SupportedInstrument, InstrumentMetadata> = {
  XAUUSD: {
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar',
    category: 'metal',
    priceDecimals: 2,
    pipSize: 0.1,
    defaultSpread: 0.25,
    commissionPerLot: 3.5,
    yahooSymbol: 'GC=F' // Gold continuous futures / spot proxy
  },
  XAGUSD: {
    symbol: 'XAGUSD',
    name: 'Silver / US Dollar',
    category: 'metal',
    priceDecimals: 3,
    pipSize: 0.01,
    defaultSpread: 0.02,
    commissionPerLot: 3.5,
    yahooSymbol: 'SI=F' // Silver continuous futures / spot proxy
  },
  EURUSD: {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    category: 'forex',
    priceDecimals: 5,
    pipSize: 0.0001,
    defaultSpread: 0.00012,
    commissionPerLot: 3.0,
    yahooSymbol: 'EURUSD=X'
  },
  BTCUSD: {
    symbol: 'BTCUSD',
    name: 'Bitcoin / US Dollar',
    category: 'crypto',
    priceDecimals: 2,
    pipSize: 1.0,
    defaultSpread: 5.0,
    commissionPerLot: 0.0,
    yahooSymbol: 'BTC-USD',
    binanceSymbol: 'BTCUSDT'
  }
};

export const SUPPORTED_TIMEFRAMES = ['1m', '3m', '5m', '15m', '1h', '4h', '1d'] as const;

export function getInstrumentMetadata(symbol: SupportedInstrument): InstrumentMetadata {
  const meta = SUPPORTED_INSTRUMENTS[symbol];
  if (!meta) {
    throw new Error(`Unsupported instrument: ${symbol}`);
  }
  return meta;
}

export function formatPrice(price: number, symbol: SupportedInstrument): string {
  const meta = getInstrumentMetadata(symbol);
  return price.toFixed(meta.priceDecimals);
}
