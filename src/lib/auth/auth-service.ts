import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';

function getJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET;
  if (configuredSecret) return configuredSecret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production.');
  }
  return 'justfx_trading_jwt_secret_dev_fallback_key';
}

export interface UserTokenPayload {
  userId: string;
  email: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signUserToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as UserTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Initializes the default demo account if no users exist.
 */
export async function ensureDefaultUser() {
  try {
    const existing = await prisma.user.findFirst();
    if (!existing) {
      const email = 'demo@justfx.com';
      const passwordHash = hashPassword('DemoTrader2025!');
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: 'Demo Trader',
          settings: {
            create: {
              selectedInstrument: 'XAUUSD',
              selectedTimeframe: '5m',
              enabledInstruments: JSON.stringify(['XAUUSD', 'XAGUSD', 'EURUSD', 'BTCUSD']),
              overlaySettings: JSON.stringify({
                fvg: true,
                ifvg: true,
                cisd: true,
                sweeps: true,
                orderBlocks: true,
                displacement: true,
                premiumDiscount: true,
                silverBullet: true,
                htfContext: true
              }),
              signalMarkerStyle: 'detailed',
              entryModel: 'silver_bullet',
              strictnessMode: 'standard',
              slTpSettings: JSON.stringify({
                slType: 'structural',
                tpType: 'liquidity_or_rr',
                minRR: 2.0
              }),
              htfTimeframe: '1h',
              marketDirectionMethod: 'ict_structure'
            }
          }
        }
      });
      console.log('Created default user:', user.email);
      return user;
    }
    return existing;
  } catch (error) {
    console.error('ensureDefaultUser error:', error);
    return null;
  }
}
