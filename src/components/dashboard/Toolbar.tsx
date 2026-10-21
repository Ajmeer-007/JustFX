'use client';

import React from 'react';
import { SupportedInstrument, SupportedTimeframe } from '@/types/market';
import { EntryModelType, StrictnessMode, HtfBias, OverlayVisibilitySettings } from '@/types/ict';
import {
  MousePointer,
  TrendingUp,
  Minus,
  Square,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Layers,
  Sliders,
  Filter
} from 'lucide-react';

interface ToolbarProps {
  selectedInstrument: SupportedInstrument;
  onSelectInstrument: (inst: SupportedInstrument) => void;
  selectedTimeframe: SupportedTimeframe;
  onSelectTimeframe: (tf: SupportedTimeframe) => void;
  entryModel: EntryModelType;
  onChangeEntryModel: (model: EntryModelType) => void;
  strictnessMode: StrictnessMode;
  onChangeStrictness: (mode: StrictnessMode) => void;
  htfBias: HtfBias;
  onChangeHtfBias: (bias: HtfBias) => void;
  overlaySettings: OverlayVisibilitySettings;
  onToggleOverlay: (key: keyof OverlayVisibilitySettings) => void;
  activeDrawingTool: string | null;
  onSelectDrawingTool: (tool: string | null) => void;
  onClearDrawings: () => void;
}

const INSTRUMENTS: SupportedInstrument[] = ['XAUUSD', 'XAGUSD', 'EURUSD', 'BTCUSD'];
const TIMEFRAMES: SupportedTimeframe[] = ['1m', '3m', '5m', '15m', '1h', '4h', '1d'];

export default function Toolbar({
  selectedInstrument,
  onSelectInstrument,
  selectedTimeframe,
  onSelectTimeframe,
  entryModel,
  onChangeEntryModel,
  strictnessMode,
  onChangeStrictness,
  htfBias,
  onChangeHtfBias,
  overlaySettings,
  onToggleOverlay,
  activeDrawingTool,
  onSelectDrawingTool,
  onClearDrawings
}: ToolbarProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      padding: '8px 16px'
    }}>
      {/* Row 1: Selectors and Model Configuration */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        {/* Instrument Quick Selectors & Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {INSTRUMENTS.map(inst => (
            <button
              key={inst}
              onClick={() => onSelectInstrument(inst)}
              className={`btn ${selectedInstrument === inst ? 'btn-active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {inst}
            </button>
          ))}
        </div>

        {/* Timeframe Quick Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => onSelectTimeframe(tf)}
              className={`btn ${selectedTimeframe === tf ? 'btn-active' : ''}`}
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Entry Model & Strictness */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Model:</span>
            <select
              value={entryModel}
              onChange={(e) => onChangeEntryModel(e.target.value as EntryModelType)}
              className="btn"
              style={{ padding: '4px 8px', fontSize: '0.75rem', outline: 'none' }}
            >
              <option value="silver_bullet">Silver Bullet Scalp</option>
              <option value="sweep_mss">Sweep + MSS + OB</option>
              <option value="ifvg_inversion">IFVG Inversion</option>
            </select>
          </div>

          {/* Strictness Mode (Standard vs Strict) */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => onChangeStrictness('standard')}
              className={`btn ${strictnessMode === 'standard' ? 'btn-active' : ''}`}
              style={{ padding: '3px 8px', fontSize: '0.72rem', border: 'none' }}
            >
              Standard
            </button>
            <button
              onClick={() => onChangeStrictness('strict')}
              className={`btn ${strictnessMode === 'strict' ? 'btn-active' : ''}`}
              style={{ padding: '3px 8px', fontSize: '0.72rem', border: 'none' }}
            >
              Strict
            </button>
          </div>

          {/* HTF Bias Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>HTF:</span>
            <select
              value={htfBias}
              onChange={(e) => onChangeHtfBias(e.target.value as HtfBias)}
              className="btn"
              style={{ padding: '4px 8px', fontSize: '0.72rem' }}
            >
              <option value="NEUTRAL">Neutral (Auto)</option>
              <option value="BULLISH">Bullish Bias</option>
              <option value="BEARISH">Bearish Bias</option>
            </select>
          </div>
        </div>
      </div>

      {/* Row 2: Overlay Toggles and Drawing Tools */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '4px' }}>
        {/* ICT / SMC Overlay Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <Layers size={13} /> Overlays:
          </span>

          <button
            onClick={() => onToggleOverlay('fvg')}
            className={`btn ${overlaySettings.fvg ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            FVG
          </button>
          <button
            onClick={() => onToggleOverlay('ifvg')}
            className={`btn ${overlaySettings.ifvg ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            IFVG
          </button>
          <button
            onClick={() => onToggleOverlay('orderBlocks')}
            className={`btn ${overlaySettings.orderBlocks ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            Order Blocks
          </button>
          <button
            onClick={() => onToggleOverlay('sweeps')}
            className={`btn ${overlaySettings.sweeps ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            Sweeps
          </button>
          <button
            onClick={() => onToggleOverlay('cisd')}
            className={`btn ${overlaySettings.cisd ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            CISD
          </button>
          <button
            onClick={() => onToggleOverlay('displacement')}
            className={`btn ${overlaySettings.displacement ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            Displacement
          </button>
          <button
            onClick={() => onToggleOverlay('premiumDiscount')}
            className={`btn ${overlaySettings.premiumDiscount ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            Premium/Discount
          </button>
          <button
            onClick={() => onToggleOverlay('silverBullet')}
            className={`btn ${overlaySettings.silverBullet ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            Silver Bullet
          </button>
          <button
            onClick={() => onToggleOverlay('sessionExtremes')}
            className={`btn ${overlaySettings.sessionExtremes ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            Session High/Low
          </button>
          <button
            onClick={() => onToggleOverlay('htfContext')}
            className={`btn ${overlaySettings.htfContext ? 'btn-active' : ''}`}
            style={{ padding: '2px 7px', fontSize: '0.7rem' }}
          >
            HTF Context
          </button>
        </div>

        {/* Drawing Tools Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '4px' }}>Draw:</span>

          <button
            onClick={() => onSelectDrawingTool(null)}
            className={`btn ${activeDrawingTool === null ? 'btn-active' : ''}`}
            style={{ padding: '4px', height: '26px' }}
            title="Cursor / Pan"
          >
            <MousePointer size={14} />
          </button>

          <button
            onClick={() => onSelectDrawingTool('trendline')}
            className={`btn ${activeDrawingTool === 'trendline' ? 'btn-active' : ''}`}
            style={{ padding: '4px', height: '26px' }}
            title="Trendline"
          >
            <TrendingUp size={14} />
          </button>

          <button
            onClick={() => onSelectDrawingTool('horizontal_line')}
            className={`btn ${activeDrawingTool === 'horizontal_line' ? 'btn-active' : ''}`}
            style={{ padding: '4px', height: '26px' }}
            title="Horizontal Line"
          >
            <Minus size={14} />
          </button>

          <button
            onClick={() => onSelectDrawingTool('rectangle')}
            className={`btn ${activeDrawingTool === 'rectangle' ? 'btn-active' : ''}`}
            style={{ padding: '4px', height: '26px' }}
            title="Rectangle Zone"
          >
            <Square size={14} />
          </button>

          <button
            onClick={() => onSelectDrawingTool('fibonacci')}
            className={`btn ${activeDrawingTool === 'fibonacci' ? 'btn-active' : ''}`}
            style={{ padding: '4px', height: '26px' }}
            title="Fibonacci Retracement"
          >
            <Percent size={14} />
          </button>

          <button
            onClick={() => onSelectDrawingTool('long_position')}
            className={`btn ${activeDrawingTool === 'long_position' ? 'btn-active' : ''}`}
            style={{ padding: '4px', height: '26px', color: 'var(--bullish)' }}
            title="Long Position (R:R)"
          >
            <ArrowUpRight size={14} />
          </button>

          <button
            onClick={() => onSelectDrawingTool('short_position')}
            className={`btn ${activeDrawingTool === 'short_position' ? 'btn-active' : ''}`}
            style={{ padding: '4px', height: '26px', color: 'var(--bearish)' }}
            title="Short Position (R:R)"
          >
            <ArrowDownRight size={14} />
          </button>

          <button
            onClick={onClearDrawings}
            className="btn"
            style={{ padding: '4px', height: '26px', color: 'var(--text-muted)' }}
            title="Clear All Drawings"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
