'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/dashboard/Header';
import Toolbar from '@/components/dashboard/Toolbar';
import TradingChart, { UserDrawingItem } from '@/components/chart/TradingChart';
import SignalPanel from '@/components/signals/SignalPanel';
import EconomicNewsWidget from '@/components/news/EconomicNewsWidget';
import PortfolioTabs from '@/components/portfolio/PortfolioTabs';
import { SupportedInstrument, SupportedTimeframe, Candle } from '@/types/market';
import { ConfirmedSignal, EntryModelType, StrictnessMode, HtfBias, OverlayVisibilitySettings } from '@/types/ict';
import { EconomicNewsEvent } from '@/lib/news/economic-calendar';
import { BacktestResult } from '@/lib/backtesting/engine';
import { Bell, Check, X, ShieldAlert } from 'lucide-react';

const MARKET_REFRESH_INTERVAL_MS = 2000;

export default function DashboardPage() {
  // Navigation & Instrument state
  const [selectedInstrument, setSelectedInstrument] = useState<SupportedInstrument>('XAUUSD');
  const [selectedTimeframe, setSelectedTimeframe] = useState<SupportedTimeframe>('5m');
  const [enabledInstruments, setEnabledInstruments] = useState<SupportedInstrument[]>([
    'XAUUSD',
    'XAGUSD',
    'EURUSD',
    'BTCUSD'
  ]);

  // Strategy & Strictness state
  const [entryModel, setEntryModel] = useState<EntryModelType>('silver_bullet');
  const [strictnessMode, setStrictnessMode] = useState<StrictnessMode>('standard');
  const [htfBias, setHtfBias] = useState<HtfBias>('NEUTRAL');

  // Overlay toggles
  const [overlaySettings, setOverlaySettings] = useState<OverlayVisibilitySettings>({
    fvg: true,
    ifvg: true,
    cisd: true,
    sweeps: true,
    sessionExtremes: true,
    orderBlocks: true,
    displacement: true,
    premiumDiscount: true,
    silverBullet: true,
    htfContext: true
  });

  // Drawing tools state
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);
  const [savedDrawings, setSavedDrawings] = useState<UserDrawingItem[]>([]);

  // Data states
  const [candles, setCandles] = useState<Candle[]>([]);
  const [marketFeed, setMarketFeed] = useState<{
    status: 'connecting' | 'connected' | 'stale' | 'disconnected';
    source: string;
    lastUpdated: number | null;
    message?: string;
  }>({ status: 'connecting', source: 'waiting for feed', lastUpdated: null });
  const [signals, setSignals] = useState<ConfirmedSignal[]>([]);
  const [overlays, setOverlays] = useState<any>({
    activeFvgs: [],
    activeIfvgs: [],
    orderBlocks: [],
    sweeps: [],
    cisdEvents: [],
    displacements: [],
    dealingRange: null,
    sessionExtremes: null,
    silverBulletWindows: [],
    htfContext: 'NEUTRAL'
  });
  const [overviewData, setOverviewData] = useState<any[]>([]);
  const [newsEvents, setNewsEvents] = useState<EconomicNewsEvent[]>([]);
  const [mt5Trades, setMt5Trades] = useState<any[]>([]);
  const [revengeAnalysis, setRevengeAnalysis] = useState<any>(null);

  // User & Auth
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Notification Toast state
  const [liveNotification, setLiveNotification] = useState<{
    id: string;
    instrument: string;
    direction: string;
    timeframe: string;
    entry: number;
    explanation: string;
  } | null>(null);

  const seenSignalIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const settingsLoadedRef = useRef(false);
  const primaryFetchSequenceRef = useRef(0);
  const primaryFetchInFlightRef = useRef<{ key: string; sequence: number } | null>(null);

  // 1. Fetch Auth Profile & Saved Settings
  useEffect(() => {
    async function loadAuthAndSettings() {
      try {
        const token = localStorage.getItem('justfx_token') || '';
        const res = await fetch('/api/auth', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          if (data.token) localStorage.setItem('justfx_token', data.token);

          // Restore preferences
          if (data.user.settings) {
            const s = data.user.settings;
            if (s.selectedInstrument) setSelectedInstrument(s.selectedInstrument);
            if (s.selectedTimeframe) setSelectedTimeframe(s.selectedTimeframe);
            if (s.entryModel) setEntryModel(s.entryModel);
            if (s.strictnessMode) setStrictnessMode(s.strictnessMode);
            if (s.overlaySettings) {
              try {
                setOverlaySettings(JSON.parse(s.overlaySettings));
              } catch {}
            }
            if (s.enabledInstruments) {
              try {
                setEnabledInstruments(JSON.parse(s.enabledInstruments));
              } catch {}
            }
          }
        // Auth restoration may happen after the initial default-symbol fetch; discard that data
        // before the saved symbol/timeframe request so candles from two markets cannot mix.
        primaryFetchSequenceRef.current++;
        setCandles([]);
        setSignals([]);
        setOverlays({
          activeFvgs: [], activeIfvgs: [], orderBlocks: [], sweeps: [],
          cisdEvents: [], displacements: [], dealingRange: null,
          sessionExtremes: null, silverBulletWindows: [], htfContext: 'NEUTRAL'
        });
        setMarketFeed({ status: 'connecting', source: 'loading saved market', lastUpdated: null });
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        settingsLoadedRef.current = true;
      }
    }
    loadAuthAndSettings();
  }, []);

  // Persist dashboard preferences after the saved settings have been restored.
  useEffect(() => {
    if (!settingsLoadedRef.current || !currentUser) return;

    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('justfx_token') || '';
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            settings: {
              selectedInstrument,
              selectedTimeframe,
              enabledInstruments,
              overlaySettings,
              entryModel,
              strictnessMode
            }
          })
        });
        if (!res.ok) throw new Error(`Settings save failed (${res.status})`);
      } catch (err) {
        console.error('Error saving settings:', err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentUser, selectedInstrument, selectedTimeframe, enabledInstruments, overlaySettings, entryModel, strictnessMode]);

  // 2. Load Market Overview (All 4 Instruments simultaneously)
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/overview');
      const data = await res.json();
      if (data.success && data.instruments) {
        setOverviewData(data.instruments);
      }
    } catch (err) {
      console.error('Overview error:', err);
    }
  }, []);

  // 3. Load Economic News
  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (data.success && data.events) {
        setNewsEvents(data.events);
      }
    } catch (err) {
      console.error('News error:', err);
    }
  }, []);

  // 4. Load MT5 Trades
  const fetchMt5Trades = useCallback(async () => {
    try {
      const token = localStorage.getItem('justfx_token') || '';
      const res = await fetch('/api/mt5', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success && data.trades) {
        setMt5Trades(data.trades);
        setRevengeAnalysis(data.revengeAnalysis);
      }
    } catch (err) {
      console.error('MT5 fetch error:', err);
    }
  }, []);

  // 5. Load Primary Candlestick Data & Signals
  const fetchPrimaryChartAndSignals = useCallback(async () => {
    const requestKey = [selectedInstrument, selectedTimeframe, entryModel, strictnessMode, htfBias].join(':');
    // Avoid overlapping identical polls. If a provider takes longer than the
    // polling interval, keep its response instead of cancelling it every 2s.
    if (primaryFetchInFlightRef.current?.key === requestKey) return;

    const requestSequence = ++primaryFetchSequenceRef.current;
    primaryFetchInFlightRef.current = { key: requestKey, sequence: requestSequence };
    try {
      // Fetch Candles
      const candleRes = await fetch(`/api/market-data?instrument=${selectedInstrument}&timeframe=${selectedTimeframe}`);
      const candleData = await candleRes.json();
      if (requestSequence !== primaryFetchSequenceRef.current) return;
      if (candleData.success && candleData.candles?.length) {
        setCandles(candleData.candles);
        setMarketFeed(previous => {
          if (selectedInstrument === 'BTCUSD' && previous.status === 'connected' && previous.source === 'Binance live stream') {
            return previous;
          }
          return {
            status: candleData.feedStatus?.isStale ? 'stale' : 'connected',
            source: selectedInstrument === 'BTCUSD'
              ? `${candleData.feedStatus?.source || 'Binance'} REST fallback`
              : candleData.feedStatus?.source || 'market feed',
            lastUpdated: Date.now(),
            message: candleData.feedStatus?.isStale ? 'Feed data is stale' : undefined
          };
        });
      } else {
        setMarketFeed({
          status: candleData.feedStatus?.isStale ? 'stale' : 'disconnected',
          source: candleData.feedStatus?.source || 'market feed',
          lastUpdated: null,
          message: candleData.error || 'No candles received from the market feed'
        });
      }

      // Fetch Signals & Overlays
      const signalRes = await fetch(
        `/api/signals?instrument=${selectedInstrument}&timeframe=${selectedTimeframe}&entryModel=${entryModel}&strictnessMode=${strictnessMode}&htfBias=${htfBias}`
      );
      const signalData = await signalRes.json();
      if (requestSequence !== primaryFetchSequenceRef.current) return;

      if (signalData.success) {
        const incomingSignals: ConfirmedSignal[] = signalData.signals || [];
        setSignals(incomingSignals);
        if (signalData.overlays) {
          setOverlays(signalData.overlays);
        }

        // Live notification deduplication
        if (initialLoadDoneRef.current) {
          for (const s of incomingSignals) {
            if (!seenSignalIdsRef.current.has(s.id)) {
              seenSignalIdsRef.current.add(s.id);
              // Trigger fresh live notification toast!
              setLiveNotification({
                id: s.id,
                instrument: s.instrument,
                direction: s.direction,
                timeframe: s.timeframe,
                entry: s.entryPrice,
                explanation: s.explanation
              });
            }
          }
        } else {
          // First load: seed all existing setups so they do not trigger spam popups
          incomingSignals.forEach(s => seenSignalIdsRef.current.add(s.id));
          initialLoadDoneRef.current = true;
        }
      }
    } catch (err) {
      if (requestSequence !== primaryFetchSequenceRef.current) return;
      console.error('Chart update error:', err);
      setMarketFeed(previous => ({
        ...previous,
        status: 'disconnected',
        message: err instanceof Error ? err.message : 'Market data request failed'
      }));
    } finally {
      if (primaryFetchInFlightRef.current?.sequence === requestSequence) {
        primaryFetchInFlightRef.current = null;
      }
    }
  }, [selectedInstrument, selectedTimeframe, entryModel, strictnessMode, htfBias]);

  // Periodic Polling Cycle
  useEffect(() => {
    fetchPrimaryChartAndSignals();
    fetchOverview();
    fetchNews();
    fetchMt5Trades();

    // Refresh candles, signals, and overlays every two seconds.
    const timer = setInterval(() => {
      fetchPrimaryChartAndSignals();
      fetchOverview();
    }, MARKET_REFRESH_INTERVAL_MS);

    // 60-second interval for news countdowns
    const newsTimer = setInterval(fetchNews, 60000);

    return () => {
      clearInterval(timer);
      clearInterval(newsTimer);
    };
  }, [fetchPrimaryChartAndSignals, fetchOverview, fetchNews, fetchMt5Trades]);

  // Binance streams live BTC trades; merge each tick into the active chart candle.
  useEffect(() => {
    if (selectedInstrument !== 'BTCUSD') return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
    let disposed = false;
    const timeframeSeconds: Record<SupportedTimeframe, number> = {
      '1m': 60, '3m': 180, '5m': 300, '15m': 900,
      '1h': 3600, '4h': 14400, '1d': 86400
    };

    const connect = () => {
      if (disposed) return;
      setMarketFeed(previous => ({ ...previous, status: 'connecting', source: 'Binance live stream' }));
      socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
      socket.onopen = () => {
        retryDelay = 1000;
        setMarketFeed({ status: 'connected', source: 'Binance live stream', lastUpdated: Date.now() });
      };
      socket.onmessage = event => {
        try {
          const tick = JSON.parse(event.data);
          const price = Number(tick.p);
          const quantity = Number(tick.q) || 0;
          const timestamp = Math.floor(Number(tick.T) / 1000);
          if (!Number.isFinite(price) || !timestamp) return;
          const interval = timeframeSeconds[selectedTimeframe];
          const bucket = Math.floor(timestamp / interval) * interval;

          setCandles(previous => {
            if (!previous.length) return previous;
            const next = [...previous];
            const last = next[next.length - 1];
            if (bucket < last.timestamp) return previous;
            if (bucket === last.timestamp) {
              next[next.length - 1] = {
                ...last,
                high: Math.max(last.high, price),
                low: Math.min(last.low, price),
                close: price,
                volume: last.volume + quantity,
                source: 'binance',
                isComplete: false
              };
            } else {
              next.push({
                timestamp: bucket,
                open: last.close,
                high: Math.max(last.close, price),
                low: Math.min(last.close, price),
                close: price,
                volume: quantity,
                source: 'binance',
                isComplete: false
              });
            }
            return next;
          });
          setMarketFeed({ status: 'connected', source: 'Binance live stream', lastUpdated: Date.now() });
        } catch (err) {
          console.error('Invalid Binance trade update:', err);
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        setMarketFeed(previous => ({ ...previous, status: 'stale', message: 'Reconnecting to Binance live stream' }));
        reconnectTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [selectedInstrument, selectedTimeframe]);

  // Toggle Overlay
  const handleToggleOverlay = (key: keyof OverlayVisibilitySettings) => {
    setOverlaySettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Toggle Background Monitoring for an Instrument
  const handleToggleInstrument = (inst: SupportedInstrument) => {
    setEnabledInstruments(prev =>
      prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]
    );
  };

  const handleSelectInstrument = (instrument: SupportedInstrument) => {
    if (instrument === selectedInstrument) return;
    primaryFetchSequenceRef.current++;
    setCandles([]);
    setSignals([]);
    setOverlays({
      activeFvgs: [], activeIfvgs: [], orderBlocks: [], sweeps: [],
      cisdEvents: [], displacements: [], dealingRange: null,
      sessionExtremes: null, silverBulletWindows: [], htfContext: 'NEUTRAL'
    });
    setMarketFeed({ status: 'connecting', source: 'waiting for feed', lastUpdated: null });
    setSelectedInstrument(instrument);
  };

  const handleSelectTimeframe = (timeframe: SupportedTimeframe) => {
    if (timeframe === selectedTimeframe) return;
    primaryFetchSequenceRef.current++;
    setCandles([]);
    setSignals([]);
    setOverlays({
      activeFvgs: [], activeIfvgs: [], orderBlocks: [], sweeps: [],
      cisdEvents: [], displacements: [], dealingRange: null,
      sessionExtremes: null, silverBulletWindows: [], htfContext: 'NEUTRAL'
    });
    setMarketFeed({ status: 'connecting', source: 'waiting for feed', lastUpdated: null });
    setSelectedTimeframe(timeframe);
  };

  // Upload MT5 CSV
  const handleUploadMt5Csv = async (content: string) => {
    try {
      const token = localStorage.getItem('justfx_token') || '';
      const res = await fetch('/api/mt5', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ csvContent: content })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchMt5Trades();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  // Run Historical Backtest
  const handleRunBacktest = async (config: any): Promise<BacktestResult | null> => {
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        return data.result;
      } else {
        alert(`Backtest error: ${data.error}`);
        return null;
      }
    } catch (err: any) {
      alert(`Backtest failed: ${err.message}`);
      return null;
    }
  };

  // Auth Handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode,
          email: authEmail,
          password: authPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('justfx_token', data.token);
        setCurrentUser(data.user);
        setAuthModalOpen(false);
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', height: 'auto', overflowY: 'auto', background: 'var(--bg-primary)' }}>
      {/* 1. Header with Multi-Ticker Overview Strip & Dual NY/IST Clocks */}
      <Header
        overviewData={overviewData}
        enabledInstruments={enabledInstruments}
        onToggleInstrument={handleToggleInstrument}
        selectedInstrument={selectedInstrument}
        onSelectInstrument={handleSelectInstrument}
        currentUser={currentUser}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />

      {/* 2. Strategy & Chart Toolbar */}
      <Toolbar
        selectedInstrument={selectedInstrument}
        onSelectInstrument={handleSelectInstrument}
        selectedTimeframe={selectedTimeframe}
        onSelectTimeframe={handleSelectTimeframe}
        entryModel={entryModel}
        onChangeEntryModel={setEntryModel}
        strictnessMode={strictnessMode}
        onChangeStrictness={setStrictnessMode}
        htfBias={htfBias}
        onChangeHtfBias={setHtfBias}
        overlaySettings={overlaySettings}
        onToggleOverlay={handleToggleOverlay}
        activeDrawingTool={activeDrawingTool}
        onSelectDrawingTool={setActiveDrawingTool}
        onClearDrawings={() => setSavedDrawings([])}
      />

      {/* 3. Main Workspace: Primary Chart + Right Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: '1 1 auto', minHeight: 0, gap: '8px', padding: '8px 16px' }}>
        {/* Interactive Candlestick Chart */}
        <div style={{ height: '100%', minHeight: '480px', position: 'relative' }}>
          <TradingChart
            candles={candles}
            instrument={selectedInstrument}
            timeframe={selectedTimeframe}
            signals={signals}
            overlays={overlays}
            overlaySettings={overlaySettings}
            activeDrawingTool={activeDrawingTool}
            savedDrawings={savedDrawings}
            onDrawingComplete={(d) => setSavedDrawings(prev => [...prev, d])}
            onCancelDrawingTool={() => setActiveDrawingTool(null)}
          />
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              top: '10px',
              left: '12px',
              zIndex: 10,
              maxWidth: 'min(420px, calc(100% - 24px))',
              padding: '6px 9px',
              borderRadius: '6px',
              border: `1px solid ${marketFeed.status === 'connected' ? 'var(--bullish)' : 'var(--warning)'}`,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.7rem'
            }}
          >
            <strong>{marketFeed.status === 'connected' ? 'FEED CONNECTED' : marketFeed.status.toUpperCase()}</strong>
            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
              {marketFeed.source}{selectedInstrument === 'BTCUSD' ? ' · live stream' : ` · checks every ${MARKET_REFRESH_INTERVAL_MS / 1000}s`}
              {marketFeed.lastUpdated ? ` · response ${new Date(marketFeed.lastUpdated).toLocaleTimeString()}` : ''}
            </span>
            {marketFeed.message && (
              <div style={{ color: 'var(--warning)', marginTop: '3px', overflowWrap: 'anywhere' }}>
                {marketFeed.message}
              </div>
            )}
          </div>
          {candles.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 5,
              display: 'grid', placeItems: 'center', pointerEvents: 'none',
              color: 'var(--text-muted)', textAlign: 'center', padding: '48px'
            }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '6px' }}>Waiting for market candles</strong>
                <span>{marketFeed.message || 'The chart will appear when a market feed responds.'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Signals & Economic News */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
          <div style={{ flex: '1 1 55%', minHeight: 0 }}>
            <SignalPanel signals={signals} />
          </div>
          <div style={{ flex: '1 1 45%', minHeight: 0 }}>
            <EconomicNewsWidget events={newsEvents} />
          </div>
        </div>
      </div>

      {/* 4. Bottom Tabbed Section: Portfolios, Backtest, Rulebook */}
      <div style={{ minHeight: '420px', height: 'auto', padding: '0 16px 24px 16px', flexShrink: 0 }}>
        <PortfolioTabs
          signals={signals}
          mt5Trades={mt5Trades}
          revengeAnalysis={revengeAnalysis}
          onUploadMt5Csv={handleUploadMt5Csv}
          onRunBacktest={handleRunBacktest}
          currentInstrument={selectedInstrument}
          currentTimeframe={selectedTimeframe}
        />
      </div>

      {/* Live Fresh Signal Notification Toast Banner */}
      {liveNotification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'var(--bg-surface)',
          border: '1px solid var(--accent-cyan)',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: 'var(--shadow-md)',
          maxWidth: '380px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={16} color="var(--accent-cyan)" />
              <strong style={{ fontSize: '0.85rem' }}>Fresh Confirmed Setup!</strong>
            </div>
            <button onClick={() => setLiveNotification(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
            <span className={`badge ${liveNotification.direction === 'BUY' ? 'badge-bullish' : 'badge-bearish'}`} style={{ marginRight: '6px' }}>
              {liveNotification.direction}
            </span>
            <strong>{liveNotification.instrument}</strong> on <strong>{liveNotification.timeframe}</strong> at {liveNotification.entry.toFixed(4)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
            {liveNotification.explanation}
          </div>
        </div>
      )}

      {/* Authentication Modal */}
      {authModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="glass-panel" style={{ width: '360px', padding: '24px', position: 'relative' }}>
            <button
              onClick={() => setAuthModalOpen(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
              {authMode === 'login' ? 'Trader Account Login' : 'Create Trader Account'}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Secure server-side authorization for your settings and portfolios.
            </p>

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="trader@justfx.com"
                  className="btn"
                  style={{ width: '100%', textAlign: 'left', padding: '8px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="btn"
                  style={{ width: '100%', textAlign: 'left', padding: '8px' }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', padding: '9px' }}>
                {authMode === 'login' ? 'Sign In' : 'Register Account'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {authMode === 'login' ? "Don't have an account? " : 'Already registered? '}
                <span
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 600 }}
                >
                  {authMode === 'login' ? 'Create one' : 'Sign in'}
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
