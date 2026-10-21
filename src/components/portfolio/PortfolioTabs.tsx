'use client';

import React, { useState } from 'react';
import { ConfirmedSignal } from '@/types/ict';
import { BacktestResult } from '@/lib/backtesting/engine';
import { ParsedMt5Trade, RevengeAnalysisResult } from '@/lib/mt5/importer';
import {
  TrendingUp,
  Briefcase,
  History,
  BookOpen,
  Upload,
  AlertTriangle,
  Play,
  CheckCircle,
  XCircle,
  HelpCircle
} from 'lucide-react';

interface PortfolioTabsProps {
  signals: ConfirmedSignal[];
  mt5Trades: any[];
  revengeAnalysis: RevengeAnalysisResult | null;
  onUploadMt5Csv: (content: string) => void;
  onRunBacktest: (config: any) => Promise<BacktestResult | null>;
  currentInstrument: string;
  currentTimeframe: string;
}

export default function PortfolioTabs({
  signals,
  mt5Trades,
  revengeAnalysis,
  onUploadMt5Csv,
  onRunBacktest,
  currentInstrument,
  currentTimeframe
}: PortfolioTabsProps) {
  const [activeTab, setActiveTab] = useState<'signals' | 'mt5' | 'backtest' | 'guide'>('signals');

  // Backtest state
  const [backtestModel, setBacktestModel] = useState('silver_bullet');
  const [backtestStrictness, setBacktestStrictness] = useState('standard');
  const [includeCosts, setIncludeCosts] = useState(true);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

  // Simulated Portfolio Metrics
  const wins = signals.filter(s => s.simulatedStatus === 'WIN');
  const losses = signals.filter(s => s.simulatedStatus === 'LOSS');
  const ambiguous = signals.filter(s => s.simulatedStatus === 'AMBIGUOUS');
  const active = signals.filter(s => s.simulatedStatus === 'ACTIVE' || s.simulatedStatus === 'PENDING');
  const totalClosed = wins.length + losses.length + ambiguous.length;
  const winRate = totalClosed > 0 ? (wins.length / totalClosed) * 100 : 0;
  const netR = (wins.reduce((sum, s) => sum + s.riskReward, 0) - losses.length * 1.0).toFixed(1);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) onUploadMt5Csv(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteBacktest = async () => {
    setBacktestLoading(true);
    try {
      const res = await onRunBacktest({
        instrument: currentInstrument,
        timeframe: currentTimeframe,
        entryModel: backtestModel,
        strictnessMode: backtestStrictness,
        includeCosts
      });
      if (res) setBacktestResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setBacktestLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tabs Navigation Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        padding: '0 12px'
      }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            onClick={() => setActiveTab('signals')}
            className={`btn ${activeTab === 'signals' ? 'btn-active' : ''}`}
            style={{ borderRadius: '0', borderBottom: 'none', borderTop: 'none', padding: '10px 14px' }}
          >
            <TrendingUp size={14} />
            <span>Simulated Signal Portfolio ({signals.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('mt5')}
            className={`btn ${activeTab === 'mt5' ? 'btn-active' : ''}`}
            style={{ borderRadius: '0', borderBottom: 'none', borderTop: 'none', padding: '10px 14px' }}
          >
            <Briefcase size={14} />
            <span>Actual MT5 Portfolio ({mt5Trades.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('backtest')}
            className={`btn ${activeTab === 'backtest' ? 'btn-active' : ''}`}
            style={{ borderRadius: '0', borderBottom: 'none', borderTop: 'none', padding: '10px 14px' }}
          >
            <History size={14} />
            <span>Historical Backtesting</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`btn ${activeTab === 'guide' ? 'btn-active' : ''}`}
            style={{ borderRadius: '0', borderBottom: 'none', borderTop: 'none', padding: '10px 14px' }}
          >
            <BookOpen size={14} />
            <span>ICT / SMC Rulebook</span>
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {/* TAB 1: SIMULATED SIGNAL PORTFOLIO */}
        {activeTab === 'signals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Metrics Ribbon */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Win Rate</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--bullish)' }}>{winRate.toFixed(1)}%</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{wins.length} W / {losses.length} L</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Net Realized R</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: parseFloat(netR) >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>
                  {parseFloat(netR) >= 0 ? `+${netR}R` : `${netR}R`}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Simulated Outcome</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active Setups</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{active.length}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Monitoring Live SL/TP</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ambiguous Hits</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>{ambiguous.length}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Same-Bar SL & TP Touch</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Tracked</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{signals.length}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Intraday Setups</div>
              </div>
            </div>

            {/* Setups Table */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Time (NY / IST)</th>
                    <th style={{ padding: '8px 12px' }}>Instrument</th>
                    <th style={{ padding: '8px 12px' }}>Type</th>
                    <th style={{ padding: '8px 12px' }}>Entry</th>
                    <th style={{ padding: '8px 12px' }}>Stop Loss</th>
                    <th style={{ padding: '8px 12px' }}>Take Profit</th>
                    <th style={{ padding: '8px 12px' }}>R:R</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px' }} className="mono">{s.timestampNy.split(' ')[1]}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.instrument} ({s.timeframe})</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span className={`badge ${s.direction === 'BUY' ? 'badge-bullish' : 'badge-bearish'}`}>{s.direction}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }} className="mono">{s.entryPrice.toFixed(4)}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--bearish)' }} className="mono">{s.stopLoss.toFixed(4)}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--bullish)' }} className="mono">{s.takeProfit.toFixed(4)}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }} className="mono">{s.riskReward}R</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span className={`badge ${
                          s.simulatedStatus === 'WIN' ? 'badge-bullish' :
                          s.simulatedStatus === 'LOSS' ? 'badge-bearish' :
                          s.simulatedStatus === 'ACTIVE' ? 'badge-cyan' : 'badge-neutral'
                        }`}>
                          {s.simulatedStatus}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }} className="mono">
                        {s.simulatedStatus === 'WIN' ? `+${s.riskReward}R` : (s.simulatedStatus === 'LOSS' ? '-1.0R' : '---')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ACTUAL MT5 PORTFOLIO & REVENGE TRADING */}
        {activeTab === 'mt5' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Top Bar with Statement Upload */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>MetaTrader 5 Executed History</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Read-only integration. Separated completely from simulated signals.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    const demoCsv = `Ticket,Open Time,Type,Volume,Item,Price,S/L,T/P,Time,Price,Commission,Swap,Profit\n` +
                      `1001,2024.10.15 10:15:00,buy,0.10,XAUUSD,2020.50,2015.00,2035.00,2024.10.15 10:45:00,2015.00,0,0,-55.00\n` +
                      `1002,2024.10.15 10:47:30,buy,0.25,XAUUSD,2014.80,2010.00,2030.00,2024.10.15 11:10:00,2010.00,0,0,-120.00\n` +
                      `1003,2024.10.15 11:12:00,buy,0.50,XAUUSD,2009.50,2000.00,2030.00,2024.10.15 11:35:00,2025.00,0,0,+775.00\n` +
                      `1004,2024.10.16 03:15:00,sell,0.15,EURUSD,1.08500,1.08800,1.08000,2024.10.16 04:30:00,1.08000,0,0,+75.00`;
                    onUploadMt5Csv(demoCsv);
                  }}
                  className="btn"
                  style={{ background: 'var(--bg-surface-hover)' }}
                >
                  Load Demo Statement
                </button>
                <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                  <Upload size={14} />
                  <span>Upload MT5 Statement (CSV/HTML)</span>
                  <input type="file" accept=".csv,.txt,.html" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {/* Revenge Trading Warnings Banner */}
            {revengeAnalysis && revengeAnalysis.warningSummary.length > 0 && (
              <div style={{
                background: 'rgba(255, 171, 0, 0.08)',
                border: '1px solid rgba(255, 171, 0, 0.4)',
                borderRadius: '6px',
                padding: '12px 16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontWeight: 700, marginBottom: '6px' }}>
                  <AlertTriangle size={18} />
                  <span>Revenge Trading Behavioral Warnings Detected</span>
                </div>
                <ul style={{ paddingLeft: '20px', fontSize: '0.78rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {revengeAnalysis.warningSummary.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* MT5 Trades Table */}
            {mt5Trades.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No MT5 trades loaded yet. Upload your MetaTrader 5 trade history report above, or run the local Python companion bridge script (scripts/mt5_bridge.py).
              </div>
            ) : (
              <div style={{ background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Ticket</th>
                      <th style={{ padding: '8px 12px' }}>Symbol</th>
                      <th style={{ padding: '8px 12px' }}>Type</th>
                      <th style={{ padding: '8px 12px' }}>Volume</th>
                      <th style={{ padding: '8px 12px' }}>Open Time</th>
                      <th style={{ padding: '8px 12px' }}>Open Price</th>
                      <th style={{ padding: '8px 12px' }}>Profit ($)</th>
                      <th style={{ padding: '8px 12px' }}>Behavior Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mt5Trades.map(t => (
                      <tr key={t.ticket} style={{ borderBottom: '1px solid var(--border-color)', background: t.revengeFlag ? 'rgba(255, 171, 0, 0.05)' : 'transparent' }}>
                        <td style={{ padding: '8px 12px' }} className="mono">{t.ticket}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t.symbol}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className={`badge ${t.tradeType === 'BUY' ? 'badge-bullish' : 'badge-bearish'}`}>{t.tradeType}</span>
                        </td>
                        <td style={{ padding: '8px 12px' }} className="mono">{t.volume}</td>
                        <td style={{ padding: '8px 12px' }} className="mono">{new Date(t.openTime).toLocaleString()}</td>
                        <td style={{ padding: '8px 12px' }} className="mono">{t.openPrice.toFixed(4)}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: t.profit >= 0 ? 'var(--bullish)' : 'var(--bearish)' }} className="mono">
                          {t.profit >= 0 ? `+$${t.profit.toFixed(2)}` : `-$${Math.abs(t.profit).toFixed(2)}`}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {t.revengeFlag ? (
                            <span className="badge badge-warning" title={t.revengeReason}>⚠️ Potential Tilt</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Normal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HISTORICAL BACKTESTING */}
        {activeTab === 'backtest' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Backtest Configuration Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Strategy Model:</span>
                <select value={backtestModel} onChange={(e) => setBacktestModel(e.target.value)} className="btn">
                  <option value="silver_bullet">Silver Bullet Scalp</option>
                  <option value="sweep_mss">Sweep + MSS + OB</option>
                  <option value="ifvg_inversion">IFVG Inversion</option>
                </select>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Strictness:</span>
                <select value={backtestStrictness} onChange={(e) => setBacktestStrictness(e.target.value)} className="btn">
                  <option value="standard">Standard Mode</option>
                  <option value="strict">Strict Mode (High Confluence)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '16px' }}>
                <input type="checkbox" id="costs" checked={includeCosts} onChange={(e) => setIncludeCosts(e.target.checked)} />
                <label htmlFor="costs" style={{ fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>Include Spread & Cost Deduction</label>
              </div>

              <div style={{ marginLeft: 'auto', paddingTop: '10px' }}>
                <button onClick={handleExecuteBacktest} disabled={backtestLoading} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                  <Play size={14} />
                  <span>{backtestLoading ? 'Simulating...' : 'Run Historical Backtest'}</span>
                </button>
              </div>
            </div>

            {/* Backtest Output */}
            {backtestResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Result Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Win Rate</div>
                    <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--bullish)' }}>{backtestResult.winRate}%</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{backtestResult.winningTrades} W / {backtestResult.losingTrades} L</div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Profit Factor</div>
                    <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{backtestResult.profitFactor}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Gross Win / Gross Loss</div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Max Drawdown</div>
                    <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--bearish)' }}>-{backtestResult.maxDrawdownR}R</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Peak to Trough</div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Net Realized R</div>
                    <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: backtestResult.netResultR >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>
                      +{backtestResult.netResultR}R
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>After Realistic Costs</div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Executions</div>
                    <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{backtestResult.totalTrades}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Across {backtestResult.totalCandles} Candles</div>
                  </div>
                </div>

                {/* Equity Curve SVG Representation */}
                <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>Simulated Equity Curve (Cumulative R)</div>
                  <div style={{ height: '140px', width: '100%', display: 'flex', alignItems: 'flex-end', gap: '3px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    {backtestResult.equityCurve.slice(-50).map((pt, i) => {
                      const maxR = Math.max(...backtestResult.equityCurve.map(p => p.equityR), 5);
                      const heightPct = Math.max(5, (Math.max(0, pt.equityR) / maxR) * 100);
                      return (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: `${heightPct}%`,
                            background: pt.equityR >= 0 ? 'var(--bullish)' : 'var(--bearish)',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.8
                          }}
                          title={`Trade ${i + 1}: ${pt.equityR}R`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ICT / SMC RULEBOOK */}
        {activeTab === 'guide' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.8rem', lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '6px' }}>1. Fair Value Gap (FVG) & Inversion (IFVG)</h4>
              <p><strong>Bullish FVG:</strong> Created across a 3-candle sequence when Candle 1 High &lt; Candle 3 Low, leaving an unmitigated price void in Candle 2.</p>
              <p><strong>Bearish FVG:</strong> Candle 1 Low &gt; Candle 3 High.</p>
              <p><strong>IFVG:</strong> When an unmitigated FVG is aggressively violated and a candle closes beyond its boundary, the zone flips into opposing support or resistance.</p>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '6px' }}>2. Liquidity Sweeps & Rejection</h4>
              <p><strong>Buy-Side Sweep (BSL):</strong> Price spikes above a key swing high / session high taking out buy stop liquidity, but aggressively rejects and closes back below the level.</p>
              <p><strong>Sell-Side Sweep (SSL):</strong> Price spikes below a key swing low / session low taking out sell stops, then rejects and closes back above.</p>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '6px' }}>3. Order Block (OB) & Strong Displacement</h4>
              <p><strong>Displacement:</strong> Quantitative rule requiring candle body &ge; 1.8x ATR(14) with body-to-range ratio &ge; 70%.</p>
              <p><strong>Order Block:</strong> The last opposing candle immediately preceding this displacement run that broke market structure.</p>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '6px' }}>4. Silver Bullet Windows & Dealing Range</h4>
              <p><strong>Windows (NY Time):</strong> 03:00 - 04:00 (London/NY Overlap) &amp; 10:00 - 11:00 (NY AM).</p>
              <p><strong>Equilibrium:</strong> Midpoint between Dealing Range High and Low. Only buy in Discount (below 50%) and sell in Premium (above 50%).</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
