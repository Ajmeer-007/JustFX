import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  hashPassword,
  comparePassword,
  signUserToken,
  verifyUserToken,
  ensureDefaultUser
} from '@/lib/auth/auth-service';

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUser();
    const body = await req.json();
    const { action, email, password, name } = body;

    if (action === 'register') {
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
      }

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashPassword(password),
          name: name || email.split('@')[0],
          settings: {
            create: {}
          }
        },
        include: { settings: true }
      });

      const token = signUserToken({ userId: user.id, email: user.email });
      return NextResponse.json({
        success: true,
        token,
        user: { id: user.id, email: user.email, name: user.name, settings: user.settings }
      });
    }

    if (action === 'login') {
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { settings: true }
      });

      if (!user || !comparePassword(password, user.passwordHash)) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      const token = signUserToken({ userId: user.id, email: user.email });
      return NextResponse.json({
        success: true,
        token,
        user: { id: user.id, email: user.email, name: user.name, settings: user.settings }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Auth error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';

    await ensureDefaultUser();

    if (!token) {
      // Default to demo user for seamless first load
      const demoUser = await prisma.user.findFirst({
        where: { email: 'demo@justfx.com' },
        include: { settings: true }
      });
      if (demoUser) {
        const demoToken = signUserToken({ userId: demoUser.id, email: demoUser.email });
        return NextResponse.json({
          authenticated: true,
          token: demoToken,
          user: { id: demoUser.id, email: demoUser.email, name: demoUser.name, settings: demoUser.settings }
        });
      }
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = verifyUserToken(token);
    if (!payload) {
      return NextResponse.json({ authenticated: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { settings: true }
    });

    if (!user) {
      return NextResponse.json({ authenticated: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      authenticated: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, settings: user.settings }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
