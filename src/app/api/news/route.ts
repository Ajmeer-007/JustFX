import { NextResponse } from 'next/server';
import { getEconomicNewsEvents } from '@/lib/news/economic-calendar';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = await getEconomicNewsEvents();
    const activeWarnings = events.filter(e => e.warningLevel !== null);

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      activeWarningsCount: activeWarnings.length,
      events
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
