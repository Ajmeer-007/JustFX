import { SupportedInstrument, SupportedTimeframe } from './market';

export type SignalDirection = 'BUY' | 'SELL';

export type EntryModelType = 'silver_bullet' | 'sweep_mss' | 'ifvg_inversion';

export type StrictnessMode = 'standard' | 'strict';

export type HtfBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface FvgZone {
  id: string;
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  midpoint: number;
  candleIndex: number;
  timestamp: number;
  mitigated: boolean;
  mitigatedAtTimestamp?: number;
  inverted: boolean;
  invertedAtTimestamp?: number;
}

export interface IfvgZone {
  id: string;
  originalFvgId: string;
  type: 'bullish' | 'bearish'; // Inverted from original: Bullish FVG broken downwards becomes Bearish IFVG
  top: number;
  bottom: number;
  timestamp: number;
  mitigated: boolean;
}

export interface CisdEvent {
  id: string;
  direction: SignalDirection; // BUY = shift to bullish delivery, SELL = shift to bearish delivery
  referenceCandleTimestamp: number;
  triggerCandleTimestamp: number;
  thresholdPrice: number;
  explanation: string;
}

export interface LiquiditySweep {
  id: string;
  direction: SignalDirection; // BUY signal (sell-side liquidity swept), SELL signal (buy-side liquidity swept)
  levelType: 'swing_high' | 'swing_low' | 'session_high' | 'session_low';
  levelPrice: number;
  sweepPrice: number;
  sweepTimestamp: number;
  rejectionClose: number;
  confirmed: boolean;
}

export interface OrderBlockZone {
  id: string;
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  timestamp: number;
  candleIndex: number;
  displacementAtrRatio: number;
  hasFvgConfluence: boolean;
  mitigated: boolean;
}

export interface DisplacementEvent {
  id: string;
  direction: SignalDirection;
  timestamp: number;
  bodyRatio: number; // body / range
  atrRatio: number; // body / ATR
  volumeScore: number;
}

export interface DealingRange {
  high: number;
  low: number;
  equilibrium: number;
  premiumZone: { top: number; bottom: number }; // Above equilibrium
  discountZone: { top: number; bottom: number }; // Below equilibrium
  sessionName: string;
  sessionStart: number;
}

export interface SilverBulletWindow {
  name: string;
  startHourNy: number;
  startMinuteNy: number;
  endHourNy: number;
  endMinuteNy: number;
  isActive: boolean;
  startTimestampNy: string;
  endTimestampNy: string;
  startTimestampIst: string;
  endTimestampIst: string;
}

export interface ConfirmedSignal {
  id: string;
  signalId: string;
  instrument: SupportedInstrument;
  timeframe: SupportedTimeframe;
  direction: SignalDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confirmationScore: number; // 0 - 100
  entryModel: EntryModelType;
  strictnessMode: StrictnessMode;
  htfDirection?: HtfBias;
  timestampNy: string;
  timestampIst: string;
  candleTimestamp: number;
  fvg?: FvgZone;
  ifvg?: IfvgZone;
  orderBlock?: OrderBlockZone;
  sweep?: LiquiditySweep;
  displacement?: DisplacementEvent;
  isInSilverBullet: boolean;
  silverBulletSession?: string;
  isInOptimalZone: boolean; // Discount for BUY, Premium for SELL
  explanation: string;
  passedConditions: string[];
  failedConditions: string[];
  dataQuality: 'live_confirmed' | 'recovered_historical';
  simulatedStatus: 'PENDING' | 'ACTIVE' | 'WIN' | 'LOSS' | 'AMBIGUOUS' | 'CANCELLED';
}

export interface OverlayVisibilitySettings {
  fvg: boolean;
  ifvg: boolean;
  cisd: boolean;
  sweeps: boolean;
  sessionExtremes: boolean;
  orderBlocks: boolean;
  displacement: boolean;
  premiumDiscount: boolean;
  silverBullet: boolean;
  htfContext: boolean;
}
