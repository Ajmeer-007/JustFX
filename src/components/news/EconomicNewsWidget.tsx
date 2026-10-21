'use client';

import React from 'react';
import { EconomicNewsEvent } from '@/lib/news/economic-calendar';
import { BellRing, Clock, AlertTriangle, Info } from 'lucide-react';

interface EconomicNewsWidgetProps {
  events: EconomicNewsEvent[];
}

export default function EconomicNewsWidget({ events }: EconomicNewsWidgetProps) {
  const upcomingEvents = events.filter(e => e.isUpcoming).slice(0, 6);

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BellRing size={16} color="var(--warning)" />
          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Economic News Warnings</span>
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Informational Only</span>
      </div>

      {/* Events List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {upcomingEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            No high or medium impact events scheduled in the immediate horizon.
          </div>
        ) : (
          upcomingEvents.map(evt => {
            const isHigh = evt.impact === 'High';
            const isWarningActive = evt.warningLevel !== null;

            return (
              <div
                key={evt.id}
                style={{
                  background: isWarningActive ? 'rgba(255, 171, 0, 0.08)' : 'var(--bg-surface)',
                  border: `1px solid ${isWarningActive ? 'rgba(255, 171, 0, 0.4)' : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`badge ${isHigh ? 'badge-bearish' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                      {evt.currency} · {evt.impact}
                    </span>
                    {evt.warningLevel && (
                      <span className="badge badge-warning" style={{ fontSize: '0.65rem', animation: 'pulse 1.5s infinite' }}>
                        ⚠️ Warning ({evt.warningLevel})
                      </span>
                    )}
                  </div>

                  <div className="mono" style={{ fontSize: '0.75rem', fontWeight: 600, color: evt.countdownMinutes <= 30 && evt.countdownMinutes >= 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {evt.countdownMinutes > 0 ? `in ${evt.countdownMinutes}m` : (evt.countdownMinutes >= -30 ? 'ACTIVE NOW' : 'Released')}
                  </div>
                </div>

                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  {evt.title}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <div>NY: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{evt.timeNy.split(' ')[1]}</span></div>
                  <div>IST: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{evt.timeIst.split(' ')[1]}</span></div>
                  <div>Forecast: <span className="mono">{evt.forecast}</span></div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Notice */}
      <div style={{
        padding: '6px 12px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <Info size={12} />
        <span>Warnings fire at 30m, 15m & 5m before high-impact releases.</span>
      </div>
    </div>
  );
}
