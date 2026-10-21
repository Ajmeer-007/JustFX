import { format, toZonedTime } from 'date-fns-tz';
import { SilverBulletWindow } from '@/types/ict';

export const NY_TIMEZONE = 'America/New_York';
export const IST_TIMEZONE = 'Asia/Kolkata';

export interface SilverBulletDefinition {
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export const DEFAULT_SILVER_BULLET_WINDOWS: SilverBulletDefinition[] = [
  {
    name: 'London / NY Overlap Silver Bullet',
    startHour: 3,
    startMinute: 0,
    endHour: 4,
    endMinute: 0
  },
  {
    name: 'New York AM Silver Bullet',
    startHour: 10,
    startMinute: 0,
    endHour: 11,
    endMinute: 0
  }
];

/**
 * Checks if a given timestamp (in seconds) falls within any configured Silver Bullet window.
 */
export function checkSilverBullet(
  timestampSec: number,
  definitions: SilverBulletDefinition[] = DEFAULT_SILVER_BULLET_WINDOWS
): { isInWindow: boolean; windowName?: string; activeDefinition?: SilverBulletDefinition } {
  const date = new Date(timestampSec * 1000);
  const nyDate = toZonedTime(date, NY_TIMEZONE);

  const hour = nyDate.getHours();
  const minute = nyDate.getMinutes();
  const currentMinuteOfDay = hour * 60 + minute;

  for (const def of definitions) {
    const startMinuteOfDay = def.startHour * 60 + def.startMinute;
    const endMinuteOfDay = def.endHour * 60 + def.endMinute;

    if (currentMinuteOfDay >= startMinuteOfDay && currentMinuteOfDay < endMinuteOfDay) {
      return {
        isInWindow: true,
        windowName: def.name,
        activeDefinition: def
      };
    }
  }

  return { isInWindow: false };
}

/**
 * Converts a Unix timestamp in seconds to formatted New York and IST strings with DST support.
 */
export function formatTimeInTimezones(timestampSec: number): {
  nyTime: string;
  istTime: string;
  iso: string;
} {
  const date = new Date(timestampSec * 1000);
  const nyDate = toZonedTime(date, NY_TIMEZONE);
  const istDate = toZonedTime(date, IST_TIMEZONE);

  return {
    nyTime: format(nyDate, 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: NY_TIMEZONE }),
    istTime: format(istDate, 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: IST_TIMEZONE }),
    iso: date.toISOString()
  };
}

/**
 * Returns current status of all Silver Bullet windows for a given base timestamp.
 */
export function getSilverBulletWindowsForDay(
  timestampSec: number,
  definitions: SilverBulletDefinition[] = DEFAULT_SILVER_BULLET_WINDOWS
): SilverBulletWindow[] {
  const baseDate = new Date(timestampSec * 1000);
  const nyBase = toZonedTime(baseDate, NY_TIMEZONE);

  return definitions.map(def => {
    // Construct window start and end on the same day in NY
    const startNy = new Date(nyBase);
    startNy.setHours(def.startHour, def.startMinute, 0, 0);

    const endNy = new Date(nyBase);
    endNy.setHours(def.endHour, def.endMinute, 0, 0);

    const startIst = toZonedTime(startNy, IST_TIMEZONE);
    const endIst = toZonedTime(endNy, IST_TIMEZONE);

    const check = checkSilverBullet(timestampSec, [def]);

    return {
      name: def.name,
      startHourNy: def.startHour,
      startMinuteNy: def.startMinute,
      endHourNy: def.endHour,
      endMinuteNy: def.endMinute,
      isActive: check.isInWindow,
      startTimestampNy: format(startNy, 'HH:mm zzz', { timeZone: NY_TIMEZONE }),
      endTimestampNy: format(endNy, 'HH:mm zzz', { timeZone: NY_TIMEZONE }),
      startTimestampIst: format(startIst, 'HH:mm zzz', { timeZone: IST_TIMEZONE }),
      endTimestampIst: format(endIst, 'HH:mm zzz', { timeZone: IST_TIMEZONE })
    };
  });
}
