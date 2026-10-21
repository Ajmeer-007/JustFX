import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database = 'healthy';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'unhealthy';
  }

  return NextResponse.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'JustFX ICT/SMC Trading Analysis Dashboard',
    version: '1.0.0',
    database,
    instrumentsSupported: ['XAUUSD', 'XAGUSD', 'EURUSD', 'BTCUSD'],
    timeframesSupported: ['1m', '3m', '5m', '15m', '1h', '4h', '1d'],
    primaryProviders: {
      crypto: 'Binance REST & WebSocket (BTCUSDT)',
      metalsAndForex: 'Yahoo Finance Market Engine (GC=F, SI=F, EURUSD=X)'
    }
  });
}
