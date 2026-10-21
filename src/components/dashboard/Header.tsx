'use client';

import React, { useEffect, useState } from 'react';
import { formatTimeInTimezones, checkSilverBullet } from '@/lib/ict-engine/silver-bullet';
import { SupportedInstrument } from '@/types/market';
import { Activity, ShieldCheck, Zap, User } from 'lucide-react';
import { useTheme } from '@/lib/theme/ThemeContext';

interface HeaderProps {
  overviewData: any[];
  enabledInstruments: SupportedInstrument[];
  onToggleInstrument: (inst: SupportedInstrument) => void;
  selectedInstrument: SupportedInstrument;
  onSelectInstrument: (inst: SupportedInstrument) => void;
  currentUser: any;
  onOpenAuthModal: () => void;
}

export default function Header({
  overviewData,
  enabledInstruments,
  onToggleInstrument,
  selectedInstrument,
  onSelectInstrument,
  currentUser,
  onOpenAuthModal
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  const [timeState, setTimeState] = useState<{ ny: string; ist: string; isInSb: boolean; sbName?: string }>({
    ny: '',
    ist: '',
    isInSb: false
  });

  // Track previous prices for flash animation
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [flashClass, setFlashClass] = useState<Record<string, string>>({});

  useEffect(() => {
    const updateTime = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const times = formatTimeInTimezones(nowSec);
      const sbCheck = checkSilverBullet(nowSec);
      setTimeState({
        ny: times.nyTime.split(' ')[1],
        ist: times.istTime.split(' ')[1],
        isInSb: sbCheck.isInWindow,
        sbName: sbCheck.windowName
      });
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Flash price changes in the ticker
  useEffect(() => {
    if (!overviewData || overviewData.length === 0) return;

    const newFlash: Record<string, string> = {};
    const newPrev: Record<string, number> = { ...prevPrices };

    for (const item of overviewData) {
      const prev = prevPrices[item.symbol];
      if (prev !== undefined && item.lastPrice !== prev) {
        newFlash[item.symbol] = item.lastPrice > prev ? 'price-flash-up' : 'price-flash-down';
      }
      newPrev[item.symbol] = item.lastPrice;
    }

    if (Object.keys(newFlash).length > 0) {
      setFlashClass(newFlash);
      setTimeout(() => setFlashClass({}), 700);
    }
    setPrevPrices(newPrev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewData]);

  const priceDecimals = (sym: string) => {
    if (sym === 'EURUSD') return 5;
    if (sym === 'XAUUSD' || sym === 'XAGUSD') return 2;
    return 2;
  };

  return (
    <header style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      padding: '8px 16px',
      gap: '8px'
    }}>
      {/* Top Bar: Brand, Dual Timezones, Theme Toggle, User */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo and Tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, var(--accent-cyan-glow), var(--bullish-glow, rgba(0,135,90,0.15)))',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-active)'
          }}>
            <Zap size={18} color="var(--accent-cyan)" />
            <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.5px' }}>
              Just<span style={{ color: 'var(--accent-cyan)' }}>FX</span>
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            ICT / SMC Intraday Scalping Engine
          </span>
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {timeState.isInSb && (
            <div className="badge badge-cyan" style={{ animation: 'pulse 2s infinite' }}>
              ⚡ {timeState.sbName || 'Silver Bullet Active'}
            </div>
          )}

          {/* Dual Clocks */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'var(--bg-surface)',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '0.78rem'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>NY: </span>
              <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{timeState.ny || '--:--:--'}</span>
            </div>
            <div style={{ width: 1, height: 14, background: 'var(--border-color)' }} />
            <div>
              <span style={{ color: 'var(--text-muted)' }}>IST: </span>
              <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{timeState.ist || '--:--:--'}</span>
            </div>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="btn-theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* User Account */}
          <button
            onClick={onOpenAuthModal}
            className="btn"
            style={{ fontSize: '0.78rem', padding: '4px 10px' }}
          >
            <User size={14} />
            <span>{currentUser?.name || 'Demo Trader'}</span>
          </button>
        </div>
      </div>

      {/* Market Overview Ticker Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        paddingTop: '4px'
      }}>
        {overviewData.map(item => {
          const isSelected = selectedInstrument === item.symbol;
          const isMonitored = enabledInstruments.includes(item.symbol);
          const isUp = item.dailyChange >= 0;
          const flash = flashClass[item.symbol] || '';

          return (
            <div
              key={item.symbol}
              onClick={() => onSelectInstrument(item.symbol)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '6px',
                background: isSelected ? 'var(--accent-cyan-glow)' : 'var(--bg-surface)',
                border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                cursor: 'pointer',
                boxShadow: isSelected ? 'var(--shadow-glow)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: item.status === 'connected' ? 'var(--bullish)' : 'var(--warning)',
                    boxShadow: item.status === 'connected' ? '0 0 6px var(--bullish)' : 'none'
                  }}
                  title={item.status === 'connected' ? 'Live feed connected' : 'Stale or delayed feed'}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{item.symbol}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.source}</div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className={`mono ${flash}`} style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {item.lastPrice > 0 ? item.lastPrice.toFixed(priceDecimals(item.symbol)) : '---'}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: isUp ? 'var(--bullish)' : 'var(--bearish)'
                  }}
                >
                  {isUp ? '+' : ''}{item.dailyChangePercent ? item.dailyChangePercent.toFixed(2) : '0.00'}%
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleInstrument(item.symbol);
                }}
                className={`btn ${isMonitored ? 'btn-active' : ''}`}
                style={{ padding: '2px 6px', fontSize: '0.65rem', height: '22px' }}
                title={isMonitored ? 'Background Monitoring Active' : 'Monitoring Paused'}
              >
                {isMonitored ? 'Active' : 'Paused'}
              </button>
            </div>
          );
        })}
      </div>
    </header>
  );
}
