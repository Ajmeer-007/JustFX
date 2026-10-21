import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyUserToken } from '@/lib/auth/auth-service';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const payload = token ? verifyUserToken(token) : null;

    if (!payload) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { settings: true } });

    if (!user || !user.settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    const drawings = await prisma.userDrawing.findMany({
      where: { userId: user.id }
    });

    return NextResponse.json({
      success: true,
      settings: user.settings,
      drawings
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
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { settings: true } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { settings, drawing, deleteDrawingId } = body;

    if (deleteDrawingId) {
      await prisma.userDrawing.deleteMany({
        where: { id: deleteDrawingId, userId: user.id }
      });
      return NextResponse.json({ success: true, message: 'Drawing deleted' });
    }

    if (drawing) {
      const savedDrawing = await prisma.userDrawing.create({
        data: {
          userId: user.id,
          instrument: drawing.instrument,
          timeframe: drawing.timeframe,
          toolType: drawing.toolType,
          points: JSON.stringify(drawing.points),
          properties: JSON.stringify(drawing.properties || {})
        }
      });
      return NextResponse.json({ success: true, drawing: savedDrawing });
    }

    if (settings) {
      const updated = await prisma.userSettings.update({
        where: { userId: user.id },
        data: {
          selectedInstrument: settings.selectedInstrument,
          selectedTimeframe: settings.selectedTimeframe,
          enabledInstruments: typeof settings.enabledInstruments === 'string'
            ? settings.enabledInstruments
            : JSON.stringify(settings.enabledInstruments),
          overlaySettings: typeof settings.overlaySettings === 'string'
            ? settings.overlaySettings
            : JSON.stringify(settings.overlaySettings),
          signalMarkerStyle: settings.signalMarkerStyle,
          entryModel: settings.entryModel,
          strictnessMode: settings.strictnessMode,
          slTpSettings: typeof settings.slTpSettings === 'string'
            ? settings.slTpSettings
            : JSON.stringify(settings.slTpSettings),
          htfTimeframe: settings.htfTimeframe,
          marketDirectionMethod: settings.marketDirectionMethod
        }
      });
      return NextResponse.json({ success: true, settings: updated });
    }

    return NextResponse.json({ error: 'No data provided' }, { status: 400 });
  } catch (err: any) {
    console.error('Settings save error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
