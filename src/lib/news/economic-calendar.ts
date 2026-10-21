import { formatTimeInTimezones } from '../ict-engine/silver-bullet';

export interface EconomicNewsEvent {
  id: string;
  title: string;
  country: string;
  currency: string;
  impact: 'High' | 'Medium' | 'Low' | 'Holiday';
  eventTimeUtc: string;
  timestampSec: number;
  timeNy: string;
  timeIst: string;
  forecast?: string;
  previous?: string;
  countdownMinutes: number;
  isUpcoming: boolean;
  warningLevel: '30m' | '15m' | '5m' | 'active' | null;
}

let cachedEvents: EconomicNewsEvent[] = [];
let lastCacheTime = 0;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes cache

/**
 * Fetches and filters high/medium impact economic news events affecting USD, EUR, XAU, XAG, and BTC.
 */
export async function getEconomicNewsEvents(): Promise<EconomicNewsEvent[]> {
  const nowMs = Date.now();
  if (cachedEvents.length > 0 && nowMs - lastCacheTime < CACHE_DURATION_MS) {
    return updateCountdowns(cachedEvents);
  }

  try {
    const url = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 900 }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch economic calendar: ${res.statusText}`);
    }

    const rawData = await res.json();
    const relevantCurrencies = new Set(['USD', 'EUR', 'GBP', 'ALL']);

    const events: EconomicNewsEvent[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      const currency = item.country?.toUpperCase() || 'USD';

      // Keep Medium and High impact events for relevant currencies
      if (
        (item.impact === 'High' || item.impact === 'Medium') &&
        (relevantCurrencies.has(currency) || item.impact === 'High')
      ) {
        const dateObj = new Date(item.date);
        const timestampSec = Math.floor(dateObj.getTime() / 1000);
        if (isNaN(timestampSec)) continue;

        const { nyTime, istTime } = formatTimeInTimezones(timestampSec);
        const countdownMinutes = Math.floor((timestampSec * 1000 - nowMs) / (60 * 1000));

        events.push({
          id: `news_${timestampSec}_${item.title.replace(/\s+/g, '_').toLowerCase()}`,
          title: item.title,
          country: item.country,
          currency: item.country === 'USD' ? 'USD' : (item.country === 'EUR' ? 'EUR' : item.country),
          impact: item.impact,
          eventTimeUtc: item.date,
          timestampSec,
          timeNy: nyTime,
          timeIst: istTime,
          forecast: item.forecast || '-',
          previous: item.previous || '-',
          countdownMinutes,
          isUpcoming: countdownMinutes > -60, // Keep visible for 1 hour after event
          warningLevel: null
        });
      }
    }

    // Sort chronologically
    events.sort((a, b) => a.timestampSec - b.timestampSec);
    cachedEvents = events;
    lastCacheTime = nowMs;

    return updateCountdowns(events);
  } catch (err: any) {
    console.error('Economic calendar fetch error:', err.message);
    return cachedEvents.length > 0 ? updateCountdowns(cachedEvents) : [];
  }
}

function updateCountdowns(events: EconomicNewsEvent[]): EconomicNewsEvent[] {
  const nowMs = Date.now();
  return events.map(evt => {
    const diffMin = Math.floor((evt.timestampSec * 1000 - nowMs) / (60 * 1000));
    let warningLevel: EconomicNewsEvent['warningLevel'] = null;

    if (diffMin <= 5 && diffMin >= 0) {
      warningLevel = '5m';
    } else if (diffMin <= 15 && diffMin > 5) {
      warningLevel = '15m';
    } else if (diffMin <= 30 && diffMin > 15) {
      warningLevel = '30m';
    } else if (diffMin < 0 && diffMin >= -30) {
      warningLevel = 'active';
    }

    return {
      ...evt,
      countdownMinutes: diffMin,
      isUpcoming: diffMin > -60,
      warningLevel
    };
  });
}
