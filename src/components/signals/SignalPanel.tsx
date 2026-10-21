'use client';

import React, { useState } from 'react';
import { ConfirmedSignal } from '@/types/ict';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';

interface SignalPanelProps {
  signals: ConfirmedSignal[];
  selectedSignalId?: string;
  onSelectSignal?: (sig: ConfirmedSignal) => void;
}

export default function SignalPanel({ signals, selectedSignalId, onSelectSignal }: SignalPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(signals.length > 0 ? signals[0].id : null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

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
          <Sparkles size={16} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Confirmed ICT Signals</span>
        </div>
        <span className="badge badge-cyan">{signals.length} Active</span>
      </div>

      {/* Signal Cards List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {signals.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '36px 16px',
            color: 'var(--text-muted)',
            fontSize: '0.82rem',
            lineHeight: 1.6
          }}>
            <AlertCircle size={28} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
            <div>No confirmed setups meet the current model and strictness threshold.</div>
            <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Monitoring market candles continuously...</div>
          </div>
        ) : (
          signals.map(sig => {
            const isExpanded = expandedId === sig.id;
            const isBuy = sig.direction === 'BUY';

            return (
              <div
                key={sig.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${isExpanded ? (isBuy ? 'var(--bullish)' : 'var(--bearish)') : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Summary Row */}
                <div
                  onClick={() => toggleExpand(sig.id)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${isBuy ? 'badge-bullish' : 'badge-bearish'}`}>
                      {sig.direction}
                    </span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{sig.instrument}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>{sig.timeframe}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Confirmation Score Meter */}
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: sig.confirmationScore >= 75 ? 'var(--bullish)' : 'var(--accent-cyan)' }}>
                        {sig.confirmationScore}%
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Score</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sig.riskReward}R
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>R:R</div>
                    </div>

                    {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{
                    padding: '10px 12px',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    fontSize: '0.76rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {/* Timestamp in NY and IST */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: 'var(--text-secondary)' }}>
                      <div>NY Time: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{sig.timestampNy}</strong></div>
                      <div>IST: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{sig.timestampIst}</strong></div>
                    </div>

                    {/* Levels: Entry, Stop-Loss, Take-Profit */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '6px',
                      background: 'var(--bg-surface)',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Entry Price</div>
                        <div className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sig.entryPrice.toFixed(4)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Stop Loss</div>
                        <div className="mono" style={{ fontWeight: 600, color: 'var(--bearish)' }}>{sig.stopLoss.toFixed(4)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Take Profit</div>
                        <div className="mono" style={{ fontWeight: 600, color: 'var(--bullish)' }}>{sig.takeProfit.toFixed(4)}</div>
                      </div>
                    </div>

                    {/* Full Text Explanation */}
                    <div style={{ lineHeight: 1.4, color: 'var(--text-primary)' }}>
                      <strong>Setup Context:</strong> {sig.explanation}
                    </div>

                    {/* Passed Conditions Checklist */}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Passed Confirmations:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {sig.passedConditions.map((cond, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--bullish)' }}>
                            <CheckCircle2 size={12} />
                            <span>{cond}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Failed or Missing Conditions */}
                    {sig.failedConditions.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Missing Confluences:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {sig.failedConditions.map((cond, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                              <XCircle size={12} />
                              <span>{cond}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trade Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Simulated Status:</span>
                      <span className={`badge ${
                        sig.simulatedStatus === 'WIN' ? 'badge-bullish' :
                        sig.simulatedStatus === 'LOSS' ? 'badge-bearish' :
                        sig.simulatedStatus === 'ACTIVE' ? 'badge-cyan' : 'badge-neutral'
                      }`}>
                        {sig.simulatedStatus}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
