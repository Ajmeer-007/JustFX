'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, AutoscaleInfo } from 'lightweight-charts';
import { format, fromZonedTime } from 'date-fns-tz';
import { Candle, SupportedInstrument, SupportedTimeframe } from '@/types/market';
import { ConfirmedSignal, OverlayVisibilitySettings } from '@/types/ict';
import { getInstrumentMetadata } from '@/lib/market-data/symbols';
import { useTheme } from '@/lib/theme/ThemeContext';

export interface UserDrawingPoint {
  time: number;
  price: number;
}

export interface UserDrawingItem {
  id: string;
  toolType: string;
  points: UserDrawingPoint[];
  color?: string;
}

interface TradingChartProps {
  candles: Candle[];
  instrument: SupportedInstrument;
  timeframe: SupportedTimeframe;
  signals: ConfirmedSignal[];
  overlays: {
    activeFvgs: any[];
    activeIfvgs: any[];
    orderBlocks: any[];
    sweeps: any[];
    cisdEvents: any[];
    displacements: any[];
    dealingRange: any;
    sessionExtremes: any;
    silverBulletWindows: any[];
    htfContext?: string;
  };
  overlaySettings: OverlayVisibilitySettings;
  activeDrawingTool: string | null;
  onDrawingComplete?: (drawing: UserDrawingItem) => void;
  onCancelDrawingTool?: () => void;
  savedDrawings?: UserDrawingItem[];
}

/** Read a CSS custom property value from the document root */
function getCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export default function TradingChart({
  candles,
  instrument,
  timeframe,
  signals,
  overlays,
  overlaySettings,
  activeDrawingTool,
  onDrawingComplete,
  onCancelDrawingTool,
  savedDrawings = []
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const overlayPriceRangeRef = useRef<{ min: number; max: number } | null>(null);

  // Track previous candle count and last-rendered candle key so we can do smart updates
  const prevCandleCountRef = useRef<number>(0);
  const prevInstrumentRef = useRef<string>(instrument);
  const prevTimeframeRef = useRef<string>(timeframe);
  const lastCandleTimestampRef = useRef<number>(0);

  const [hoveredOhlc, setHoveredOhlc] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    change: number;
  } | null>(null);

  const [drawings, setDrawings] = useState<UserDrawingItem[]>(savedDrawings);
  const [currentPoints, setCurrentPoints] = useState<UserDrawingPoint[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number; time: number; price: number } | null>(null);

  const meta = getInstrumentMetadata(instrument);
  const { theme } = useTheme();

  // ESC to cancel drawing tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeDrawingTool) {
        setCurrentPoints([]);
        onCancelDrawingTool?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDrawingTool, onCancelDrawingTool]);

  // Sync external drawings
  useEffect(() => {
    if (savedDrawings && savedDrawings.length > 0) {
      setDrawings(savedDrawings);
    }
  }, [savedDrawings]);

  // Build theme-aware chart options object
  const getChartThemeOptions = useCallback(() => {
    return {
      layout: {
        background: { color: getCssVar('--chart-bg') || (theme === 'dark' ? '#07090e' : '#f9fafc') },
        textColor: getCssVar('--chart-text') || (theme === 'dark' ? '#8C9CB8' : '#445572'),
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace"
      },
      grid: {
        vertLines: { color: getCssVar('--chart-grid') || 'rgba(255,255,255,0.04)' },
        horzLines: { color: getCssVar('--chart-grid') || 'rgba(255,255,255,0.04)' }
      },
      crosshair: {
        vertLine: {
          color: getCssVar('--chart-crosshair') || 'rgba(0,229,255,0.4)',
          width: 1 as const,
          style: 3 as const,
          labelBackgroundColor: getCssVar('--chart-label-bg') || '#131926'
        },
        horzLine: {
          color: getCssVar('--chart-crosshair') || 'rgba(0,229,255,0.4)',
          width: 1 as const,
          style: 3 as const,
          labelBackgroundColor: getCssVar('--chart-label-bg') || '#131926'
        }
      },
      timeScale: {
        borderColor: getCssVar('--chart-border') || 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false
      },
      rightPriceScale: {
        borderColor: getCssVar('--chart-border') || 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.08, bottom: 0.22 }
      }
    };
  }, [theme]);

  // Initialize chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 560,
      ...getChartThemeOptions()
    });

    const upColor = getCssVar('--chart-candle-up') || '#00E676';
    const downColor = getCssVar('--chart-candle-down') || '#FF1744';

    const candleSeries = chart.addCandlestickSeries({
      upColor,
      downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
      autoscaleInfoProvider: (baseImplementation: () => AutoscaleInfo | null) => {
        const base = baseImplementation();
        const zoneRange = overlayPriceRangeRef.current;
        if (!zoneRange) return base;
        if (!base) return { priceRange: { minValue: zoneRange.min, maxValue: zoneRange.max } };
        return {
          ...base,
          priceRange: {
            minValue: Math.min(base.priceRange.minValue, zoneRange.min),
            maxValue: Math.max(base.priceRange.maxValue, zoneRange.max)
          }
        };
      }
    });

    const volumeSeries = chart.addHistogramSeries({
      color: 'rgba(0, 229, 255, 0.3)',
      priceFormat: { type: 'volume' },
      priceScaleId: ''
    });
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    chart.subscribeCrosshairMove(param => {
      if (param.time && param.seriesData.get(candleSeries)) {
        const data = param.seriesData.get(candleSeries) as CandlestickData;
        const change = ((data.close - data.open) / data.open) * 100;
        setHoveredOhlc({
          time: new Date((param.time as number) * 1000).toLocaleString(),
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          change
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------
  // Re-apply chart theme whenever theme changes
  // ----------------------------------------------------------------
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;

    // Small delay to let CSS vars update in the DOM
    const t = setTimeout(() => {
      chart.applyOptions(getChartThemeOptions());

      const upColor = getCssVar('--chart-candle-up') || '#00E676';
      const downColor = getCssVar('--chart-candle-down') || '#FF1744';
      candleSeries.applyOptions({
        upColor,
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor
      });
    }, 50);

    return () => clearTimeout(t);
  }, [theme, getChartThemeOptions]);

  // ----------------------------------------------------------------
  // Smart candle data update:
  //  - If instrument/timeframe changed → full setData (chart reset)
  //  - If only new candles appended → setData (new bar added)
  //  - If same count but last candle changed → update last candle only (live tick)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    if (candles.length === 0) {
      setHoveredOhlc(null);
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current?.setData([]);
      prevInstrumentRef.current = instrument;
      prevTimeframeRef.current = timeframe;
      prevCandleCountRef.current = 0;
      lastCandleTimestampRef.current = 0;
      return;
    }

    const instrumentChanged = prevInstrumentRef.current !== instrument;
    const timeframeChanged = prevTimeframeRef.current !== timeframe;
    const prevCount = prevCandleCountRef.current;
    const lastCandle = candles[candles.length - 1];

    prevInstrumentRef.current = instrument;
    prevTimeframeRef.current = timeframe;
    prevCandleCountRef.current = candles.length;

    if (instrumentChanged || timeframeChanged) {
      // Full data reset
      setHoveredOhlc(null);
      const formatted: CandlestickData[] = candles.map(c => ({
        time: c.timestamp as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));
      candleSeriesRef.current.setData(formatted);
      lastCandleTimestampRef.current = lastCandle.timestamp;
      // A new series starts with the library's default range, which can leave
      // hundreds of older bars compressed into the visible pane. Always focus
      // the latest bars after a symbol/timeframe reset.
      const visibleBars = Math.min(140, formatted.length);
      chartRef.current?.timeScale().setVisibleLogicalRange({
        from: Math.max(0, formatted.length - visibleBars),
        to: formatted.length + 5
      });

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(candles.map(c => ({
          time: c.timestamp as Time,
          value: c.volume || 10,
          color: c.close >= c.open
            ? (getCssVar('--chart-volume-up') || 'rgba(0,230,118,0.35)')
            : (getCssVar('--chart-volume-down') || 'rgba(255,23,68,0.35)')
        })));
      }
    } else if (candles.length > prevCount) {
      // New candles added — set full data (handles gaps)
      const formatted: CandlestickData[] = candles.map(c => ({
        time: c.timestamp as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));
      candleSeriesRef.current.setData(formatted);
      lastCandleTimestampRef.current = lastCandle.timestamp;
      if (prevCount === 0) {
        candleSeriesRef.current.priceScale().applyOptions({ autoScale: true });
        chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
        const visibleBars = Math.min(140, candles.length);
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: Math.max(0, candles.length - visibleBars),
          to: candles.length + 5
        });
      }

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(candles.map(c => ({
          time: c.timestamp as Time,
          value: c.volume || 10,
          color: c.close >= c.open
            ? (getCssVar('--chart-volume-up') || 'rgba(0,230,118,0.35)')
            : (getCssVar('--chart-volume-down') || 'rgba(255,23,68,0.35)')
        })));
      }
    } else {
      // Same count — live tick update: only update the last candle
      candleSeriesRef.current.update({
        time: lastCandle.timestamp as Time,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close
      });

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: lastCandle.timestamp as Time,
          value: lastCandle.volume || 10,
          color: lastCandle.close >= lastCandle.open
            ? (getCssVar('--chart-volume-up') || 'rgba(0,230,118,0.35)')
            : (getCssVar('--chart-volume-down') || 'rgba(255,23,68,0.35)')
        });
      }
    }

    // Apply signal markers
    const markers: any[] = [];
    for (const sig of signals) {
      markers.push({
        time: sig.candleTimestamp as Time,
        position: sig.direction === 'BUY' ? 'belowBar' : 'aboveBar',
        color: sig.direction === 'BUY' ? getCssVar('--chart-candle-up') || '#00E676' : getCssVar('--chart-candle-down') || '#FF1744',
        shape: sig.direction === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: `${sig.direction} (${sig.riskReward}R)`
      });
    }
    candleSeriesRef.current.setMarkers(markers);
  }, [candles, signals, instrument, timeframe]);

  // Redraw Canvas Overlay for ICT/SMC zones and drawings
  const renderOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!canvas || !chart || !candleSeries) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = chart.timeScale().width() || canvas.parentElement?.clientWidth || 800;
    const canvasWidth = chartContainerRef.current?.clientWidth || canvas.parentElement?.clientWidth || width;
    const height = chartContainerRef.current?.clientHeight || canvas.parentElement?.clientHeight || 560;
    canvas.width = canvasWidth;
    canvas.height = height;

    ctx.clearRect(0, 0, canvasWidth, height);
    if (candles.length === 0) return;

    const timeScale = chart.timeScale();

    // Include enabled, horizontally visible price zones in autoscaling. Without
    // this, a valid order block can be clipped below/above the candle range.
    const scaleZones = [
      ...(overlaySettings.fvg ? overlays.activeFvgs.slice(-8) : []),
      ...(overlaySettings.ifvg ? overlays.activeIfvgs.slice(-6) : []),
      ...(overlaySettings.orderBlocks ? overlays.orderBlocks.slice(-10) : [])
    ];
    const visibleZonePrices: number[] = [];
    for (const zone of scaleZones) {
      const startX = timeScale.timeToCoordinate(zone.timestamp as Time);
      if (startX === null || startX > width) continue;
      const endTimestamp = zone.mitigatedAtTimestamp as number | undefined;
      const mappedEnd = endTimestamp ? timeScale.timeToCoordinate(endTimestamp as Time) : width;
      const endX = mappedEnd === null ? (endTimestamp && endTimestamp < candles[0].timestamp ? null : width) : mappedEnd;
      if (endX === null || endX < 0) continue;
      visibleZonePrices.push(zone.top, zone.bottom);
    }
    const nextZoneRange = visibleZonePrices.length
      ? { min: Math.min(...visibleZonePrices), max: Math.max(...visibleZonePrices) }
      : null;
    const oldZoneRange = overlayPriceRangeRef.current;
    if (oldZoneRange?.min !== nextZoneRange?.min || oldZoneRange?.max !== nextZoneRange?.max) {
      overlayPriceRangeRef.current = nextZoneRange;
      candleSeries.applyOptions({
        autoscaleInfoProvider: (baseImplementation: () => AutoscaleInfo | null) => {
          const base = baseImplementation();
          const zoneRange = overlayPriceRangeRef.current;
          if (!zoneRange) return base;
          if (!base) return { priceRange: { minValue: zoneRange.min, maxValue: zoneRange.max } };
          return {
            ...base,
            priceRange: {
              minValue: Math.min(base.priceRange.minValue, zoneRange.min),
              maxValue: Math.max(base.priceRange.maxValue, zoneRange.max)
            }
          };
        }
      });
      candleSeries.priceScale().applyOptions({ autoScale: true });
    }

    const drawZone = (zone: any, label: string, color: string, endTimestamp?: number) => {
      const xStart = timeScale.timeToCoordinate(zone.timestamp as Time);
      const mappedEnd = endTimestamp ? timeScale.timeToCoordinate(endTimestamp as Time) : width;
      const xEnd = mappedEnd === null
        ? (endTimestamp && endTimestamp < candles[0].timestamp ? null : width)
        : mappedEnd;
      const yTop = candleSeries.priceToCoordinate(zone.top);
      const yBottom = candleSeries.priceToCoordinate(zone.bottom);
      if (xStart === null || yTop === null || yBottom === null || xStart > width || xEnd === null) return;

      const x = Math.max(0, xStart);
      const right = Math.min(width, xEnd);
      if (right <= x) return;
      const top = Math.min(yTop, yBottom);
      const boxHeight = Math.max(2, Math.abs(yBottom - yTop));
      if (top + boxHeight < 0 || top > height) return;
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = color.replace(/,\s*[\d.]+\)$/, ', 0.9)');
      ctx.lineWidth = 1;
      ctx.fillRect(x, top, right - x, boxHeight);
      ctx.strokeRect(x, top, right - x, boxHeight);
      const tag = `${label} · ${zone.bottom.toFixed(meta.priceDecimals)}–${zone.top.toFixed(meta.priceDecimals)}`;
      ctx.font = 'bold 10px JetBrains Mono';
      const tagWidth = Math.min(right - x, ctx.measureText(tag).width + 10);
      ctx.fillStyle = color.replace(/,\s*[\d.]+\)$/, ', 0.92)');
      ctx.fillRect(x, Math.max(0, top), tagWidth, Math.min(18, boxHeight));
      ctx.font = 'bold 10px JetBrains Mono';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(tag, x + 5, Math.max(12, top + 12), Math.max(0, tagWidth - 8));
      ctx.restore();
    };

    // 1. Silver Bullet windows: shade only the actual NY session window.
    if (overlaySettings.silverBullet && overlays.silverBulletWindows?.length && candles.length) {
      const nyDate = format(new Date(candles[candles.length - 1].timestamp * 1000), 'yyyy-MM-dd', {
        timeZone: 'America/New_York'
      });
      const firstTime = candles[0].timestamp;
      const lastTime = candles[candles.length - 1].timestamp;
      for (const sb of overlays.silverBulletWindows) {
        const startText = `${nyDate} ${String(sb.startHourNy).padStart(2, '0')}:${String(sb.startMinuteNy).padStart(2, '0')}`;
        const endText = `${nyDate} ${String(sb.endHourNy).padStart(2, '0')}:${String(sb.endMinuteNy).padStart(2, '0')}`;
        const start = Math.floor(fromZonedTime(startText, 'America/New_York').getTime() / 1000);
        const end = Math.floor(fromZonedTime(endText, 'America/New_York').getTime() / 1000);
        if (end < firstTime || start > lastTime) continue;
        const x1 = timeScale.timeToCoordinate(start as Time) ?? 0;
        const x2 = timeScale.timeToCoordinate(end as Time) ?? width;
        const left = Math.max(0, Math.min(x1, x2));
        const right = Math.min(width, Math.max(x1, x2));
        if (right <= left) continue;
        ctx.fillStyle = 'rgba(0, 229, 255, 0.07)';
        ctx.fillRect(left, 0, right - left, height);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(left, 0, right - left, height);
        ctx.setLineDash([]);
        ctx.fillStyle = getCssVar('--accent-cyan') || '#00E5FF';
        ctx.font = 'bold 10px Inter';
        ctx.fillText(`⚡ ${sb.name} · ${sb.startTimestampNy}–${sb.endTimestampNy}`, left + 5, 44);
      }
    }

    // 2. Premium & Discount Equilibrium
    if (overlaySettings.premiumDiscount && overlays.dealingRange) {
      const dr = overlays.dealingRange;
      const yEq = candleSeries.priceToCoordinate(dr.equilibrium);
      const yHigh = candleSeries.priceToCoordinate(dr.high);
      const yLow = candleSeries.priceToCoordinate(dr.low);

      if (yEq !== null && yHigh !== null && yLow !== null) {
        ctx.fillStyle = 'rgba(255, 23, 68, 0.04)';
        ctx.fillRect(0, yHigh, width, yEq - yHigh);
        ctx.fillStyle = 'rgba(0, 230, 118, 0.04)';
        ctx.fillRect(0, yEq, width, yLow - yEq);

        ctx.strokeStyle = getCssVar('--equilibrium') || '#FFD600';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yEq);
        ctx.lineTo(width, yEq);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = getCssVar('--equilibrium') || '#FFD600';
        ctx.font = '10px JetBrains Mono';
        ctx.fillText(`EQ: ${dr.equilibrium.toFixed(meta.priceDecimals)} (Dealing Range Midpoint)`, width - 260, yEq - 4);
      }
    }

    // 3. FVG and inverse FVG price zones.
    if (overlaySettings.fvg && overlays.activeFvgs) {
      for (const fvg of overlays.activeFvgs.slice(-8)) {
        const color = fvg.type === 'bullish' ? 'rgba(0,230,118,0.10)' : 'rgba(255,23,68,0.10)';
        drawZone(fvg, `${fvg.type.toUpperCase()} FVG${fvg.mitigated ? ' · MITIGATED' : ''}`, color, fvg.mitigatedAtTimestamp);
      }
    }
    if (overlaySettings.ifvg && overlays.activeIfvgs) {
      for (const ifvg of overlays.activeIfvgs.slice(-6)) {
        const color = ifvg.type === 'bullish' ? 'rgba(0,190,255,0.12)' : 'rgba(185,95,255,0.12)';
        drawZone(ifvg, `${ifvg.type.toUpperCase()} IFVG`, color);
      }
    }

    // 4. Order Blocks
    if (overlaySettings.orderBlocks && overlays.orderBlocks) {
      for (const ob of overlays.orderBlocks) {
        const color = ob.type === 'bullish' ? 'rgba(0,230,118,0.12)' : 'rgba(255,23,68,0.12)';
        drawZone(ob, `${ob.type.toUpperCase()} ORDER BLOCK`, color);
      }
    }

    // 5. Liquidity sweeps: mark the swept level and the wick that took it.
    if (overlaySettings.sweeps && overlays.sweeps) {
      for (const sweep of overlays.sweeps) {
        const x = timeScale.timeToCoordinate(sweep.sweepTimestamp as Time);
        const yLevel = candleSeries.priceToCoordinate(sweep.levelPrice);
        const yWick = candleSeries.priceToCoordinate(sweep.sweepPrice);
        if (x === null || yLevel === null || yWick === null || x > width) continue;
        const color = sweep.direction === 'BUY' ? '#00E676' : '#FF5252';
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x), yLevel);
        ctx.lineTo(width, yLevel);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x, yWick, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 9px JetBrains Mono';
        ctx.fillText(`${sweep.levelType === 'swing_low' ? 'SSL' : 'BSL'} SWEPT · ${sweep.direction}`, Math.max(4, x + 7), yLevel - 5);
        ctx.restore();
      }
    }

    // 6. CISD confirmation levels.
    if (overlaySettings.cisd && overlays.cisdEvents) {
      for (const event of overlays.cisdEvents) {
        const x = timeScale.timeToCoordinate(event.triggerCandleTimestamp as Time);
        const y = candleSeries.priceToCoordinate(event.thresholdPrice);
        if (x === null || y === null || x > width) continue;
        ctx.save();
        ctx.strokeStyle = event.direction === 'BUY' ? '#00D5FF' : '#FFB300';
        ctx.fillStyle = ctx.strokeStyle;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x), y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 9px JetBrains Mono';
        ctx.fillText(`${event.direction} CISD`, Math.max(4, x + 6), y - 5);
        ctx.restore();
      }
    }

    // 7. Strong displacement candles.
    if (overlaySettings.displacement && overlays.displacements) {
      for (const displacement of overlays.displacements) {
        const x = timeScale.timeToCoordinate(displacement.timestamp as Time);
        const candle = candles.find(item => item.timestamp === displacement.timestamp);
        if (x === null || !candle || x > width) continue;
        ctx.save();
        ctx.fillStyle = displacement.direction === 'BUY' ? 'rgba(0,230,118,0.14)' : 'rgba(255,23,68,0.14)';
        ctx.fillRect(Math.max(0, x - 5), 48, 10, height - 48);
        ctx.font = 'bold 9px JetBrains Mono';
        ctx.fillStyle = displacement.direction === 'BUY' ? '#00E676' : '#FF5252';
        const y = candleSeries.priceToCoordinate(displacement.direction === 'BUY' ? candle.high : candle.low);
        if (y !== null) ctx.fillText(`DISP ${displacement.atrRatio.toFixed(1)}×ATR`, Math.max(2, x + 6), y - 4);
        ctx.restore();
      }
    }

    // 8. Current session high and low.
    if (overlaySettings.sessionExtremes && overlays.sessionExtremes) {
      for (const [name, price, color] of [
        ['SESSION HIGH', overlays.sessionExtremes.high, '#FFB300'],
        ['SESSION LOW', overlays.sessionExtremes.low, '#5C9DFF']
      ] as [string, number, string][]) {
        const y = candleSeries.priceToCoordinate(price);
        if (y === null) continue;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 9px JetBrains Mono';
        ctx.fillText(`${name} ${price.toFixed(meta.priceDecimals)}`, 8, y - 4);
        ctx.restore();
      }
    }

    // HTF selector is a bias filter, so show its state as context rather than inventing a price zone.
    if (overlaySettings.htfContext && overlays.htfContext) {
      ctx.save();
      ctx.font = 'bold 10px Inter';
      ctx.fillStyle = overlays.htfContext === 'BULLISH' ? '#00E676' : overlays.htfContext === 'BEARISH' ? '#FF5252' : '#B0BEC5';
      ctx.fillText(`HTF FILTER · ${overlays.htfContext}`, Math.max(8, width - 150), 44);
      ctx.restore();
    }

    // 5. User drawings
    for (const d of drawings) {
      renderUserDrawing(ctx, d, timeScale, candleSeries, width);
    }

    // 6. In-progress drawing preview
    if (activeDrawingTool && currentPoints.length > 0 && mousePos) {
      const previewDrawing: UserDrawingItem = {
        id: 'preview',
        toolType: activeDrawingTool,
        points: [...currentPoints, { time: mousePos.time, price: mousePos.price }],
        color: getCssVar('--accent-cyan') || '#00E5FF'
      };
      renderUserDrawing(ctx, previewDrawing, timeScale, candleSeries, width, true);
    }
  }, [candles, overlays, overlaySettings, drawings, currentPoints, mousePos, activeDrawingTool, meta.priceDecimals]);

  // Sync canvas overlay with chart scrolling
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().subscribeVisibleTimeRangeChange(() => renderOverlay());
    renderOverlay();
  }, [renderOverlay]);

  // Canvas click for drawing tools
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeDrawingTool || !chartRef.current || !candleSeriesRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = chartRef.current.timeScale().coordinateToTime(x) as number;
    const price = candleSeriesRef.current.coordinateToPrice(y) as number;
    if (!time || !price) return;

    const newPoints = [...currentPoints, { time, price }];
    const requiredPoints = activeDrawingTool === 'horizontal_line' || activeDrawingTool === 'vertical_line' ? 1 : 2;

    if (newPoints.length >= requiredPoints) {
      const newDrawing: UserDrawingItem = {
        id: `drawing_${Date.now()}`,
        toolType: activeDrawingTool,
        points: newPoints,
        color: activeDrawingTool.includes('short') ? (getCssVar('--bearish') || '#FF1744') : (getCssVar('--accent-cyan') || '#00E5FF')
      };
      const updated = [...drawings, newDrawing];
      setDrawings(updated);
      setCurrentPoints([]);
      if (onDrawingComplete) onDrawingComplete(newDrawing);
    } else {
      setCurrentPoints(newPoints);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = chartRef.current.timeScale().coordinateToTime(x) as number;
    const price = candleSeriesRef.current.coordinateToPrice(y) as number;
    if (time && price) {
      setMousePos({ x, y, time, price });
      renderOverlay();
    }
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '560px',
      background: 'var(--chart-bg)',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid var(--border-color)'
    }}>
      {/* OHLC Inspection Bar */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 14,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        background: 'var(--chart-ohlc-bg)',
        padding: '4px 10px',
        borderRadius: '4px',
        border: '1px solid var(--border-color)',
        pointerEvents: 'none'
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{instrument} · {timeframe}</span>
        {hoveredOhlc ? (
          <>
            <span>O: <strong style={{ color: 'var(--text-primary)' }}>{hoveredOhlc.open.toFixed(meta.priceDecimals)}</strong></span>
            <span>H: <strong style={{ color: 'var(--text-primary)' }}>{hoveredOhlc.high.toFixed(meta.priceDecimals)}</strong></span>
            <span>L: <strong style={{ color: 'var(--text-primary)' }}>{hoveredOhlc.low.toFixed(meta.priceDecimals)}</strong></span>
            <span>C: <strong style={{ color: 'var(--text-primary)' }}>{hoveredOhlc.close.toFixed(meta.priceDecimals)}</strong></span>
            <span style={{ color: hoveredOhlc.change >= 0 ? 'var(--bullish)' : 'var(--bearish)', fontWeight: 600 }}>
              {hoveredOhlc.change >= 0 ? '+' : ''}{hoveredOhlc.change.toFixed(2)}%
            </span>
          </>
        ) : (
          <span>Hover chart for OHLC inspection</span>
        )}
      </div>

      {/* Lightweight Charts container */}
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* ICT/SMC overlay canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
          pointerEvents: activeDrawingTool ? 'auto' : 'none',
          cursor: activeDrawingTool ? 'crosshair' : 'default'
        }}
      />

      {/* Active drawing tool HUD */}
      {activeDrawingTool && (
        <div style={{
          position: 'absolute',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'var(--chart-ohlc-bg)',
          border: '1px solid var(--accent-cyan)',
          borderRadius: '6px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: 'var(--shadow-md)',
          fontSize: '0.78rem',
          backdropFilter: 'blur(8px)'
        }}>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
            ✏️ Active Tool: {activeDrawingTool.replace('_', ' ').toUpperCase()}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {currentPoints.length === 0 ? 'Click 1st point' : 'Click 2nd point to finish'}
          </span>
          <button
            onClick={() => onCancelDrawingTool?.()}
            className="btn"
            style={{ padding: '2px 8px', fontSize: '0.7rem' }}
          >
            Cancel (ESC)
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Drawing Helper Renderer
// ----------------------------------------------------------------
function renderUserDrawing(
  ctx: CanvasRenderingContext2D,
  d: UserDrawingItem,
  timeScale: any,
  candleSeries: any,
  width: number,
  isPreview: boolean = false
) {
  ctx.save();
  ctx.strokeStyle = d.color || '#00E5FF';
  ctx.lineWidth = isPreview ? 1 : 2;
  if (isPreview) ctx.setLineDash([4, 4]);

  const p1 = d.points[0];
  const p2 = d.points[1];

  const x1 = timeScale.timeToCoordinate(p1.time as Time);
  const y1 = candleSeries.priceToCoordinate(p1.price);

  if (x1 === null || y1 === null) {
    ctx.restore();
    return;
  }

  if (d.toolType === 'horizontal_line') {
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(width, y1);
    ctx.stroke();
  } else if (p2) {
    const x2 = timeScale.timeToCoordinate(p2.time as Time);
    const y2 = candleSeries.priceToCoordinate(p2.price);

    if (x2 !== null && y2 !== null) {
      if (d.toolType === 'trendline') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (d.toolType === 'rectangle') {
        const top = Math.min(y1, y2);
        const left = Math.min(x1, x2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
        ctx.fillRect(left, top, w, h);
        ctx.strokeRect(left, top, w, h);
      } else if (d.toolType === 'fibonacci') {
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        for (const lvl of levels) {
          const yLvl = y1 + (y2 - y1) * lvl;
          ctx.strokeStyle = lvl === 0.5 ? '#FFD600' : 'rgba(0, 229, 255, 0.5)';
          ctx.beginPath();
          ctx.moveTo(minX, yLvl);
          ctx.lineTo(maxX, yLvl);
          ctx.stroke();
          ctx.fillStyle = '#8C9CB8';
          ctx.font = '9px JetBrains Mono';
          ctx.fillText(`${(lvl * 100).toFixed(1)}%`, maxX + 4, yLvl + 3);
        }
      } else if (d.toolType === 'long_position') {
        const entryY = y1;
        const slY = Math.max(y1, y2);
        const risk = Math.abs(slY - entryY);
        const tpY = entryY - risk * 2;
        const left = Math.min(x1, x2);
        const w = Math.max(100, Math.abs(x2 - x1));

        ctx.fillStyle = 'rgba(0, 230, 118, 0.15)';
        ctx.fillRect(left, tpY, w, Math.abs(entryY - tpY));
        ctx.fillStyle = 'rgba(255, 23, 68, 0.15)';
        ctx.fillRect(left, entryY, w, Math.abs(slY - entryY));

        ctx.strokeStyle = '#00E676';
        ctx.strokeRect(left, tpY, w, Math.abs(entryY - tpY));
        ctx.strokeStyle = '#FF1744';
        ctx.strokeRect(left, entryY, w, Math.abs(slY - entryY));

        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '10px JetBrains Mono';
        ctx.fillText(`Target: 2.0R`, left + 6, tpY + 14);
        ctx.fillText(`Stop Loss: -1.0R`, left + 6, slY - 6);
      }
    }
  }

  ctx.restore();
}
