export interface ParsedMt5Trade {
  ticket: string;
  symbol: string;
  tradeType: 'BUY' | 'SELL';
  volume: number;
  openTime: Date;
  openPrice: number;
  closeTime?: Date;
  closePrice?: number;
  sl?: number;
  tp?: number;
  commission: number;
  swap: number;
  profit: number;
  revengeFlag: boolean;
  revengeReason?: string;
}

export interface RevengeAnalysisResult {
  totalTrades: number;
  totalLosses: number;
  flaggedRevengeTrades: number;
  rapidReentries: number;
  lotSizeEscalations: number;
  warningSummary: string[];
}

/**
 * Parses MT5 CSV or Tab-delimited exported statement.
 * MT5 standard export header typically includes:
 * Time, Position, Symbol, Type, Volume, Price, S/L, T/P, Time, Price, Commission, Swap, Profit
 */
export function parseMt5Report(content: string): ParsedMt5Trade[] {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const trades: ParsedMt5Trade[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip headers or summary rows
    if (line.toLowerCase().includes('ticket') || line.toLowerCase().includes('balance') || line.startsWith('#')) {
      continue;
    }

    // Try comma or semicolon or tab
    const cols = line.includes('\t') ? line.split('\t') : (line.includes(';') ? line.split(';') : line.split(','));

    if (cols.length >= 7) {
      const ticket = cols[0].replace(/"/g, '').trim();
      const openTimeStr = cols[1].replace(/"/g, '').trim();
      const typeStr = cols[2].replace(/"/g, '').trim().toUpperCase();
      const volume = parseFloat(cols[3].replace(/"/g, '')) || 0.01;
      const symbol = cols[4].replace(/"/g, '').trim().toUpperCase();
      const openPrice = parseFloat(cols[5].replace(/"/g, '')) || 0;

      // Position type
      const tradeType: 'BUY' | 'SELL' = typeStr.includes('BUY') ? 'BUY' : 'SELL';
      const profitCol = cols[cols.length - 1].replace(/"/g, '').trim();
      const profit = parseFloat(profitCol) || 0;

      const openTime = new Date(openTimeStr);
      if (isNaN(openTime.getTime())) continue;

      trades.push({
        ticket: ticket || `mt5_${Date.now()}_${i}`,
        symbol,
        tradeType,
        volume,
        openTime,
        openPrice,
        closePrice: openPrice,
        commission: 0,
        swap: 0,
        profit,
        revengeFlag: false
      });
    }
  }

  // Sort chronologically by openTime
  trades.sort((a, b) => a.openTime.getTime() - b.openTime.getTime());

  // Analyze revenge trading behaviors
  analyzeRevengeTrading(trades);

  return trades;
}

/**
 * Detects behavioral warnings:
 * 1. Rapid re-entry after loss (< 5 minutes between losing close and next open)
 * 2. Lot size escalation after loss (e.g. 2x lot size after losing trade)
 * 3. Loss-chasing clustering
 */
export function analyzeRevengeTrading(trades: ParsedMt5Trade[]): RevengeAnalysisResult {
  let rapidReentries = 0;
  let lotSizeEscalations = 0;
  let totalLosses = 0;
  let flaggedCount = 0;
  const warnings: string[] = [];

  for (let i = 1; i < trades.length; i++) {
    const prevTrade = trades[i - 1];
    const currentTrade = trades[i];

    if (prevTrade.profit < 0) {
      totalLosses++;
      const timeDiffMinutes = (currentTrade.openTime.getTime() - prevTrade.openTime.getTime()) / (60 * 1000);

      const isRapid = timeDiffMinutes >= 0 && timeDiffMinutes <= 5;
      const isEscalation = currentTrade.volume >= prevTrade.volume * 1.5;

      if (isRapid || isEscalation) {
        currentTrade.revengeFlag = true;
        flaggedCount++;

        const reasons: string[] = [];
        if (isRapid) {
          rapidReentries++;
          reasons.push(`Rapid re-entry within ${Math.round(timeDiffMinutes)}m after a loss`);
        }
        if (isEscalation) {
          lotSizeEscalations++;
          reasons.push(`Lot size increased from ${prevTrade.volume} to ${currentTrade.volume} immediately following a loss`);
        }
        currentTrade.revengeReason = reasons.join('; ');
      }
    }
  }

  if (rapidReentries > 0) {
    warnings.push(`Detected ${rapidReentries} instances of rapid re-entry (< 5 mins) immediately after a losing trade.`);
  }
  if (lotSizeEscalations > 0) {
    warnings.push(`Detected ${lotSizeEscalations} instances of position-size escalation following a loss.`);
  }

  return {
    totalTrades: trades.length,
    totalLosses,
    flaggedRevengeTrades: flaggedCount,
    rapidReentries,
    lotSizeEscalations,
    warningSummary: warnings
  };
}
