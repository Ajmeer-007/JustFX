import { NextRequest, NextResponse } from 'next/server';
import { getMarketCandles } from '@/lib/market-data/provider';
import { generateSignals } from '@/lib/ict-engine/signal-generator';
import { detectFvgAndIfvg } from '@/lib/ict-engine/fvg';
import { detectDisplacement } from '@/lib/ict-engine/displacement';
import { detectLiquiditySweeps, findSwingPoints } from '@/lib/ict-engine/liquidity';
import { detectOrderBlocks } from '@/lib/ict-engine/order-blocks';
import { detectCisd } from '@/lib/ict-engine/cisd';
import { calculateDealingRange } from '@/lib/ict-engine/dealing-range';
import { getSilverBulletWindowsForDay } from '@/lib/ict-engine/silver-bullet';
import { evaluateSetupOutcome } from '@/lib/portfolio/paper-trading';
import { prisma } from '@/lib/db/prisma';
import { SupportedInstrument, SupportedTimeframe } from '@/types/market';
import { EntryModelType, StrictnessMode, HtfBias } from '@/types/ict';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const instrument = (searchParams.get('instrument') || 'XAUUSD') as SupportedInstrument;
    const timeframe = (searchParams.get('timeframe') || '5m') as SupportedTimeframe;
    const entryModel = (searchParams.get('entryModel') || 'silver_bullet') as EntryModelType;
    const strictnessMode = (searchParams.get('strictnessMode') || 'standard') as StrictnessMode;
    const htfBias = (searchParams.get('htfBias') || undefined) as HtfBias | undefined;

    // Fetch candles
    const { candles, feedStatus } = await getMarketCandles({ instrument, timeframe, range: '5d' });

    if (candles.length === 0) {
      return NextResponse.json({
        success: true,
        signals: [],
        overlays: {
          fvgs: [],
          ifvgs: [],
          orderBlocks: [],
          sweeps: [],
          cisdEvents: [],
          displacements: [],
          dealingRange: null,
          sessionExtremes: null,
          silverBulletWindows: [],
          htfContext: htfBias || 'NEUTRAL'
        }
      });
    }

    // Run core ICT structures
    const swingPoints = findSwingPoints(candles, 2, 2);
    const sweeps = detectLiquiditySweeps(candles, swingPoints);
    const displacements = detectDisplacement(candles);
    const cisdEvents = detectCisd(candles, sweeps);
    const { fvgs, ifvgs, activeFvgs, activeIfvgs } = detectFvgAndIfvg(candles);
    const orderBlocks = detectOrderBlocks(candles, displacements, fvgs);
    const dealingRange = calculateDealingRange(candles, 'ny_session');
    const latestTimestamp = candles[candles.length - 1].timestamp;
    const silverBulletWindows = getSilverBulletWindowsForDay(latestTimestamp);

    // Generate confirmed signals
    const signals = generateSignals(candles, {
      instrument,
      timeframe,
      entryModel,
      strictnessMode,
      htfBias
    });

    // Evaluate simulated trade outcome for each signal
    for (const sig of signals) {
      const candleIdx = candles.findIndex(c => c.timestamp === sig.candleTimestamp);
      if (candleIdx !== -1 && candleIdx < candles.length - 1) {
        const subsequent = candles.slice(candleIdx + 1);
        const outcome = evaluateSetupOutcome(sig, subsequent);
        sig.simulatedStatus = outcome.status;

        // Persist to database asynchronously
        try {
          await prisma.signalRecord.upsert({
            where: { signalId: sig.signalId },
            update: {
              status: outcome.status,
              outcomeR: outcome.outcomeR,
              exitTimestamp: outcome.exitTimestamp
            },
            create: {
              signalId: sig.signalId,
              instrument: sig.instrument,
              timeframe: sig.timeframe,
              direction: sig.direction,
              entryPrice: sig.entryPrice,
              stopLoss: sig.stopLoss,
              takeProfit: sig.takeProfit,
              riskReward: sig.riskReward,
              confirmationScore: sig.confirmationScore,
              entryModel: sig.entryModel,
              strictnessMode: sig.strictnessMode,
              htfDirection: sig.htfDirection,
              indicators: JSON.stringify({
                hasFvg: !!sig.fvg,
                hasOb: !!sig.orderBlock,
                hasSweep: !!sig.sweep,
                inOptimalZone: sig.isInOptimalZone,
                inSilverBullet: sig.isInSilverBullet
              }),
              explanation: sig.explanation,
              status: outcome.status,
              timestampNy: sig.timestampNy,
              timestampIst: sig.timestampIst,
              candleTimestamp: sig.candleTimestamp,
              exitTimestamp: outcome.exitTimestamp,
              outcomeR: outcome.outcomeR,
              dataSource: feedStatus.source
            }
          });
        } catch (dbErr) {
          // Ignore unique collision or transient errors
        }
      }
    }

    return NextResponse.json({
      success: true,
      instrument,
      timeframe,
      signals,
      overlays: {
        activeFvgs: activeFvgs.slice(-20),
        activeIfvgs: activeIfvgs.slice(-10),
        orderBlocks: orderBlocks.filter(ob => !ob.mitigated).slice(-10),
        sweeps: sweeps.slice(-15),
        cisdEvents: cisdEvents.slice(-15),
        displacements: Array.from(displacements.values()).slice(-30),
        dealingRange,
        sessionExtremes: dealingRange ? { high: dealingRange.high, low: dealingRange.low } : null,
        silverBulletWindows,
        htfContext: htfBias || 'NEUTRAL'
      }
    });
  } catch (err: any) {
    console.error('Signals API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
