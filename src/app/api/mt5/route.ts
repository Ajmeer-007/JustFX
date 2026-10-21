import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { parseMt5Report, analyzeRevengeTrading, ParsedMt5Trade } from '@/lib/mt5/importer';
import { verifyUserToken } from '@/lib/auth/auth-service';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const payload = token ? verifyUserToken(token) : null;

    if (!payload) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      return NextResponse.json({ trades: [], summary: null });
    }

    const dbTrades = await prisma.mt5Trade.findMany({
      where: { userId: user.id },
      orderBy: { openTime: 'desc' }
    });

    const parsedForAnalysis: ParsedMt5Trade[] = dbTrades.map(t => ({
      ticket: t.ticket,
      symbol: t.symbol,
      tradeType: t.tradeType as 'BUY' | 'SELL',
      volume: t.volume,
      openTime: t.openTime,
      openPrice: t.openPrice,
      closeTime: t.closeTime || undefined,
      closePrice: t.closePrice || undefined,
      sl: t.sl || undefined,
      tp: t.tp || undefined,
      commission: t.commission || 0,
      swap: t.swap || 0,
      profit: t.profit,
      revengeFlag: t.revengeFlag,
      revengeReason: t.revengeReason || undefined
    }));

    const revengeAnalysis = analyzeRevengeTrading(parsedForAnalysis);

    return NextResponse.json({
      success: true,
      totalTrades: dbTrades.length,
      trades: dbTrades,
      revengeAnalysis
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const payload = token ? verifyUserToken(token) : null;

    if (!payload) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { csvContent, directTrades } = body;

    let tradesToSave: ParsedMt5Trade[] = [];

    if (csvContent) {
      tradesToSave = parseMt5Report(csvContent);
    } else if (Array.isArray(directTrades)) {
      tradesToSave = directTrades.map(t => ({
        ...t,
        openTime: new Date(t.openTime),
        closeTime: t.closeTime ? new Date(t.closeTime) : undefined,
        revengeFlag: false
      }));
      analyzeRevengeTrading(tradesToSave);
    }

    if (tradesToSave.length === 0) {
      return NextResponse.json({ error: 'No valid trades could be extracted' }, { status: 400 });
    }

    // Save trades
    let savedCount = 0;
    for (const t of tradesToSave) {
      try {
        await prisma.mt5Trade.upsert({
          where: {
            userId_ticket: {
              userId: user.id,
              ticket: t.ticket
            }
          },
          update: {
            profit: t.profit,
            revengeFlag: t.revengeFlag,
            revengeReason: t.revengeReason
          },
          create: {
            userId: user.id,
            ticket: t.ticket,
            symbol: t.symbol,
            tradeType: t.tradeType,
            volume: t.volume,
            openTime: t.openTime,
            openPrice: t.openPrice,
            closePrice: t.closePrice,
            profit: t.profit,
            commission: t.commission,
            swap: t.swap,
            revengeFlag: t.revengeFlag,
            revengeReason: t.revengeReason
          }
        });
        savedCount++;
      } catch (saveErr) {
        // Continue with next trade
      }
    }

    const revengeAnalysis = analyzeRevengeTrading(tradesToSave);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${savedCount} actual MT5 trades.`,
      savedCount,
      revengeAnalysis
    });
  } catch (err: any) {
    console.error('MT5 import error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
