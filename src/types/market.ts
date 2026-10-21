export type SupportedInstrument = 'XAUUSD' | 'XAGUSD' | 'EURUSD' | 'BTCUSD';

export type SupportedTimeframe = '1m' | '3m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Candle {
  timestamp: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: 'binance' | 'yahoo' | 'deriv' | 'mock';
  isComplete: boolean;
}

export interface InstrumentMetadata {
  symbol: SupportedInstrument;
  name: string;
  category: 'metal' | 'forex' | 'crypto';
  priceDecimals: number;
  pipSize: number;
  defaultSpread: number;
  commissionPerLot: number;
  yahooSymbol: string;
  binanceSymbol?: string;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'stale';

export interface FeedHealth {
  instrument: SupportedInstrument;
  status: ConnectionStatus;
  lastUpdate: number; // ms
  lastPrice: number;
  bid?: number;
  ask?: number;
  dailyChange: number;
  dailyChangePercent: number;
  source: string;
  isLive: boolean;
  monitoringEnabled: boolean;
  message?: string;
}

export interface CandleQueryOptions {
  instrument: SupportedInstrument;
  timeframe: SupportedTimeframe;
  limit?: number;
  startTime?: number; // seconds
  endTime?: number; // seconds
}
