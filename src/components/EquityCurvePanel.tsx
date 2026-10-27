/**
 * @file EquityCurvePanel.tsx
 * @description OKX-Dog 全景交互式多维时序收益与净值曲线面板
 * 基于 TradingView lightweight-charts 高性能 Canvas 引擎构建
 * 支持：
 * 1. 鼠标左键自由拖拽平移 (Pan)、滚轮无级缩放 (Zoom)、一键自适应全览与全屏沉浸放大
 * 2. 多曲线同屏叠加与独立图例开关：
 *    - 总净盈亏曲线 (Total PnL)
 *    - 已实现落袋盈亏曲线 (Realized PnL)
 *    - 持仓浮动盈亏曲线 (Unrealized PnL)
 *    - 账户总权益净值 (Total Equity) + 历史最高净值水线 (Peak High-Water Mark)
 *    - 累计收益率曲线 (ROI %)
 * 3. 自动平仓战绩图表打点 (Markers) 与十字光标毫秒级多维数值浮层检视
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  CrosshairMode,
  UTCTimestamp,
  LineData,
  LineStyle,
  SeriesMarker,
} from 'lightweight-charts';
import {
  TrendingUp,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Activity,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AutoPilotHistoryPoint, AutoPilotTradeRecord } from '../types';
import { getBaseCurrency } from '../utils/symbolHelper';

type ChartMetricMode = 'PNL_MULTI' | 'EQUITY_HWM' | 'ROI_PCT';
type TimeRangeFilter = '15M' | '1H' | '6H' | '24H' | 'ALL';

interface HoverSnapshot {
  timeStr: string;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  equity: number;
  peakEquity: number;
  roiPct: number;
}

interface EquityCurvePanelProps {
  compact?: boolean;
}

export const EquityCurvePanel: React.FC<EquityCurvePanelProps> = ({ compact = false }) => {
  const { autoPilotHistory, autoPilotStatus, balance } = useAppStore();

  // 图表模式与曲线显隐开关
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('PNL_MULTI');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('ALL');
  const [showTotalPnl, setShowTotalPnl] = useState<boolean>(true);
  const [showRealizedPnl, setShowRealizedPnl] = useState<boolean>(true);
  const [showUnrealizedPnl, setShowUnrealizedPnl] = useState<boolean>(true);
  const [showTradeMarkers, setShowTradeMarkers] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeBottomView, setActiveBottomView] = useState<'stats' | 'trades'>('stats');
  const [hoverData, setHoverData] = useState<HoverSnapshot | null>(null);

  // Lightweight Charts 容器与实例引用
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const primarySeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const secondarySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const tertiarySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // 时间戳 -> 原始数据点映射表 (供十字光标悬停读取全量多维指标)
  const pointByTimeRef = useRef<Map<number, HoverSnapshot>>(new Map());

  const rawCurve = autoPilotHistory?.curve || [];
  const rawTrades = autoPilotHistory?.trades || [];

  // 过滤并去重排序时序采样点 (lightweight-charts 要求秒级时间戳严格递增)
  const normalizedPoints = useMemo(() => {
    const nowMs = Date.now();
    const cutoffMs =
      timeRange === '15M'
        ? nowMs - 15 * 60 * 1000
        : timeRange === '1H'
        ? nowMs - 60 * 60 * 1000
        : timeRange === '6H'
        ? nowMs - 6 * 3600 * 1000
        : timeRange === '24H'
        ? nowMs - 24 * 3600 * 1000
        : 0;

    const filtered = cutoffMs > 0 ? rawCurve.filter((p) => p.timestamp >= cutoffMs) : rawCurve;
    const source = filtered.length >= 2 ? filtered : rawCurve;

    const sorted = [...source].sort((a, b) => a.timestamp - b.timestamp);
    const deduped: Array<AutoPilotHistoryPoint & { sec: UTCTimestamp; peakEquity: number }> = [];
    let runningPeak = autoPilotStatus?.start_equity_usdt || 10000;
    let lastSec = 0;

    for (const pt of sorted) {
      let sec = Math.floor(pt.timestamp / 1000);
      if (sec <= lastSec) {
        sec = lastSec + 1;
      }
      lastSec = sec;
      if (pt.equity > runningPeak) {
        runningPeak = pt.equity;
      }
      deduped.push({
        ...pt,
        sec: sec as UTCTimestamp,
        peakEquity: runningPeak,
      });
    }

    return deduped;
  }, [rawCurve, timeRange, autoPilotStatus?.start_equity_usdt]);

  // 构造图表所需的各条曲线数据与平仓打点 Markers
  const chartDataBundle = useMemo(() => {
    const map = new Map<number, HoverSnapshot>();
    const totalPnlData: LineData[] = [];
    const realizedPnlData: LineData[] = [];
    const unrealizedPnlData: LineData[] = [];
    const equityData: LineData[] = [];
    const peakEquityData: LineData[] = [];
    const roiData: LineData[] = [];

    for (const pt of normalizedPoints) {
      const secNum = pt.sec as number;
      const roiVal = Number((pt.pnl_ratio * 100).toFixed(3));
      const d = new Date(pt.timestamp);
      const timeStr = d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      map.set(secNum, {
        timeStr,
        totalPnl: pt.total_pnl,
        realizedPnl: pt.realized_pnl,
        unrealizedPnl: pt.unrealized_pnl,
        equity: pt.equity,
        peakEquity: pt.peakEquity,
        roiPct: roiVal,
      });

      totalPnlData.push({ time: pt.sec, value: pt.total_pnl });
      realizedPnlData.push({ time: pt.sec, value: pt.realized_pnl });
      unrealizedPnlData.push({ time: pt.sec, value: pt.unrealized_pnl });
      equityData.push({ time: pt.sec, value: pt.equity });
      peakEquityData.push({ time: pt.sec, value: pt.peakEquity });
      roiData.push({ time: pt.sec, value: roiVal });
    }

    pointByTimeRef.current = map;

    // 匹配自动平仓流水至最接近的采样秒级时间戳，生成图表打点
    const markers: SeriesMarker<UTCTimestamp>[] = [];
    if (showTradeMarkers && normalizedPoints.length >= 2 && rawTrades.length > 0) {
      const firstSec = normalizedPoints[0].sec as number;
      const lastSec = normalizedPoints[normalizedPoints.length - 1].sec as number;

      const sortedTrades = [...rawTrades]
        .filter((t) => {
          const tsSec = Math.floor(t.timestamp / 1000);
          return tsSec >= firstSec - 60 && tsSec <= lastSec + 60;
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      for (const tr of sortedTrades.slice(-30)) {
        const targetSec = Math.floor(tr.timestamp / 1000);
        // 二分或线性查找最近点
        let closestSec = normalizedPoints[0].sec;
        let minDiff = Math.abs((closestSec as number) - targetSec);
        for (const p of normalizedPoints) {
          const diff = Math.abs((p.sec as number) - targetSec);
          if (diff < minDiff) {
            minDiff = diff;
            closestSec = p.sec;
          }
        }
        const isWin = tr.realized_pnl >= 0;
        markers.push({
          time: closestSec,
          position: isWin ? 'aboveBar' : 'belowBar',
          color: isWin ? '#00C087' : '#FF3B69',
          shape: isWin ? 'arrowUp' : 'arrowDown',
          text: `${getBaseCurrency(tr.symbol)} ${isWin ? '+' : ''}$${tr.realized_pnl.toFixed(1)}`,
        });
      }
    }

    return {
      totalPnlData,
      realizedPnlData,
      unrealizedPnlData,
      equityData,
      peakEquityData,
      roiData,
      markers,
    };
  }, [normalizedPoints, rawTrades, showTradeMarkers]);

  // 初始化与重建 Lightweight Chart 实例
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth || 320,
      height: container.clientHeight || (isFullscreen ? 460 : compact ? 150 : 210),
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#848E9C',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(43, 49, 57, 0.35)' },
        horzLines: { color: 'rgba(43, 49, 57, 0.35)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(59, 130, 246, 0.5)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1E2329',
        },
        horzLine: {
          color: 'rgba(59, 130, 246, 0.5)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1E2329',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(43, 49, 57, 0.8)',
        scaleMargins: { top: 0.14, bottom: 0.14 },
      },
      timeScale: {
        borderColor: 'rgba(43, 49, 57, 0.8)',
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 3,
        barSpacing: 8,
        minBarSpacing: 0.5,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // 1. 主曲线 (AreaSeries: 总净盈亏 / 账户总权益 / 累计收益率)
    const primarySeries = chart.addAreaSeries({
      lineColor: '#00C087',
      topColor: 'rgba(0, 192, 135, 0.28)',
      bottomColor: 'rgba(0, 192, 135, 0.02)',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // 2. 第二曲线 (LineSeries: 已实现盈亏 / 最高净值水线)
    const secondarySeries = chart.addLineSeries({
      color: '#38BDF8',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      crosshairMarkerVisible: true,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // 3. 第三曲线 (LineSeries: 持仓浮动盈亏)
    const tertiarySeries = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: true,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    chartRef.current = chart;
    primarySeriesRef.current = primarySeries;
    secondarySeriesRef.current = secondarySeries;
    tertiarySeriesRef.current = tertiarySeries;

    // 十字光标悬停监听
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        setHoverData(null);
        return;
      }
      const secKey = param.time as number;
      const snap = pointByTimeRef.current.get(secKey);
      if (snap) {
        setHoverData(snap);
      }
    });

    // 响应式尺寸监听
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && chartRef.current) {
          chartRef.current.applyOptions({ width, height });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      primarySeriesRef.current = null;
      secondarySeriesRef.current = null;
      tertiarySeriesRef.current = null;
    };
  }, [isFullscreen, compact]);

  // 当数据、模式或图例显隐变化时更新曲线数据
  useEffect(() => {
    const primary = primarySeriesRef.current;
    const secondary = secondarySeriesRef.current;
    const tertiary = tertiarySeriesRef.current;
    if (!primary || !secondary || !tertiary) return;

    const latestTotalPnl =
      chartDataBundle.totalPnlData.length > 0
        ? chartDataBundle.totalPnlData[chartDataBundle.totalPnlData.length - 1].value
        : 0;
    const isPositive = latestTotalPnl >= 0;

    if (metricMode === 'PNL_MULTI') {
      primary.applyOptions({
        visible: showTotalPnl,
        lineColor: isPositive ? '#00C087' : '#FF3B69',
        topColor: isPositive ? 'rgba(0, 192, 135, 0.28)' : 'rgba(255, 59, 105, 0.28)',
        bottomColor: isPositive ? 'rgba(0, 192, 135, 0.01)' : 'rgba(255, 59, 105, 0.01)',
      });
      primary.setData(chartDataBundle.totalPnlData);
      primary.setMarkers(chartDataBundle.markers);

      secondary.applyOptions({
        visible: showRealizedPnl,
        color: '#38BDF8',
        lineStyle: LineStyle.Solid,
      });
      secondary.setData(chartDataBundle.realizedPnlData);

      tertiary.applyOptions({
        visible: showUnrealizedPnl,
        color: '#F59E0B',
        lineStyle: LineStyle.Dashed,
      });
      tertiary.setData(chartDataBundle.unrealizedPnlData);
    } else if (metricMode === 'EQUITY_HWM') {
      primary.applyOptions({
        visible: true,
        lineColor: '#8B5CF6',
        topColor: 'rgba(139, 92, 246, 0.28)',
        bottomColor: 'rgba(139, 92, 246, 0.02)',
      });
      primary.setData(chartDataBundle.equityData);
      primary.setMarkers(chartDataBundle.markers);

      secondary.applyOptions({
        visible: true,
        color: '#10B981',
        lineStyle: LineStyle.Dashed,
      });
      secondary.setData(chartDataBundle.peakEquityData);

      tertiary.applyOptions({ visible: false });
      tertiary.setData([]);
    } else {
      // ROI_PCT
      primary.applyOptions({
        visible: true,
        lineColor: isPositive ? '#00C087' : '#FF3B69',
        topColor: isPositive ? 'rgba(0, 192, 135, 0.28)' : 'rgba(255, 59, 105, 0.28)',
        bottomColor: 'rgba(0, 0, 0, 0)',
      });
      primary.setData(chartDataBundle.roiData);
      primary.setMarkers(chartDataBundle.markers);

      secondary.applyOptions({ visible: false });
      secondary.setData([]);
      tertiary.applyOptions({ visible: false });
      tertiary.setData([]);
    }
  }, [
    chartDataBundle,
    metricMode,
    showTotalPnl,
    showRealizedPnl,
    showUnrealizedPnl,
  ]);

  // 缩放与平移交互控制函数
  const handleZoom = useCallback((factor: number) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const span = range.to - range.from;
    const center = (range.from + range.to) / 2;
    const nextSpan = Math.max(5, span * factor);
    ts.setVisibleLogicalRange({
      from: center - nextSpan / 2,
      to: center + nextSpan / 2,
    });
  }, []);

  const handlePan = useCallback((direction: -1 | 1) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const shift = Math.max(2, (range.to - range.from) * 0.25) * direction;
    ts.setVisibleLogicalRange({
      from: range.from + shift,
      to: range.to + shift,
    });
  }, []);

  const handleFitContent = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  // 当前最新汇总数据（无悬停时默认展示最新值）
  const latestPoint = normalizedPoints[normalizedPoints.length - 1];
  const displayTotalPnl = hoverData
    ? hoverData.totalPnl
    : latestPoint?.total_pnl ?? (autoPilotStatus?.total_pnl_usdt ?? 0);
  const displayRealizedPnl = hoverData
    ? hoverData.realizedPnl
    : latestPoint?.realized_pnl ?? (autoPilotStatus?.realized_pnl_usdt ?? 0);
  const displayUnrealizedPnl = hoverData
    ? hoverData.unrealizedPnl
    : latestPoint?.unrealized_pnl ?? (balance?.unrealized_pnl_usdt ?? 0);
  const displayEquity = hoverData
    ? hoverData.equity
    : latestPoint?.equity ?? (balance?.total_equity_usdt ?? 10000);
  const displayRoi = hoverData
    ? hoverData.roiPct
    : latestPoint
    ? Number((latestPoint.pnl_ratio * 100).toFixed(2))
    : Number(((autoPilotStatus?.total_pnl_ratio ?? 0) * 100).toFixed(2));

  const renderPanelContent = (inModal: boolean) => (
    <div className="flex flex-col h-full w-full bg-bg-secondary rounded-lg border border-bg-border overflow-hidden select-none">
      {/* 1. 顶部标题与模式/时间范围/缩放工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 border-b border-bg-border bg-bg-secondary">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-trade-ai/15 border border-trade-ai/30 text-trade-ai">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-text-primary">全景多维时序收益曲线</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-bg-elevated text-text-muted border border-bg-border">
                {normalizedPoints.length} 采样点
              </span>
            </div>
          </div>
        </div>

        {/* 右侧缩放、平移与全屏控制按钮组 */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => handlePan(-1)}
            className="p-1 rounded bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="向左拖动时间轴"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handlePan(1)}
            className="p-1 rounded bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="向右拖动时间轴"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(0.65)}
            className="p-1 rounded bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="放大曲线 (或使用鼠标滚轮)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1.45)}
            className="p-1 rounded bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="缩小曲线 (或使用鼠标滚轮)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFitContent}
            className="px-1.5 py-1 rounded bg-bg-elevated hover:bg-bg-border text-[10px] font-mono text-text-secondary hover:text-text-primary transition-colors cursor-pointer flex items-center space-x-0.5"
            title="自适应铺满全部采样点"
          >
            <RotateCcw className="w-3 h-3" />
            <span>全览</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!inModal)}
            className="p-1 rounded bg-trade-ai/15 hover:bg-trade-ai/25 text-trade-ai border border-trade-ai/30 transition-colors cursor-pointer"
            title={inModal ? '退出全屏' : '全屏放大检视多维曲线'}
          >
            {inModal ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. 二级控制栏：多曲线模式切换 + 时间跨度过滤 */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 bg-bg-elevated/50 border-b border-bg-border/60 text-[10px]">
        {/* 模式切换 */}
        <div className="flex items-center space-x-1 bg-bg-secondary p-0.5 rounded border border-bg-border">
          <button
            type="button"
            onClick={() => setMetricMode('PNL_MULTI')}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              metricMode === 'PNL_MULTI'
                ? 'bg-trade-ai text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            三线盈亏分解
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('EQUITY_HWM')}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              metricMode === 'EQUITY_HWM'
                ? 'bg-purple-600 text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            总权益+最高水线
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('ROI_PCT')}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              metricMode === 'ROI_PCT'
                ? 'bg-emerald-600 text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            收益率(%)
          </button>
        </div>

        {/* 时间范围过滤 */}
        <div className="flex items-center space-x-0.5 font-mono">
          {(['15M', '1H', '6H', '24H', 'ALL'] as TimeRangeFilter[]).map((rng) => (
            <button
              key={rng}
              type="button"
              onClick={() => {
                setTimeRange(rng);
                setTimeout(handleFitContent, 50);
              }}
              className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                timeRange === rng
                  ? 'bg-bg-border text-text-primary font-bold'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {rng === 'ALL' ? '全部' : rng}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 多曲线可点击图例开关与实时十字光标数值读数条 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/40 border-b border-bg-border/40 text-[10px] font-mono-num">
        {metricMode === 'PNL_MULTI' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTotalPnl(!showTotalPnl)}
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border transition cursor-pointer ${
                showTotalPnl
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-text-primary'
                  : 'opacity-40 border-bg-border text-text-muted'
              }`}
              title="点击显示/隐藏总净盈亏曲线"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>总净盈亏:</span>
              <span className={displayTotalPnl >= 0 ? 'text-trade-up font-bold' : 'text-trade-down font-bold'}>
                {displayTotalPnl >= 0 ? '+' : ''}${displayTotalPnl.toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowRealizedPnl(!showRealizedPnl)}
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border transition cursor-pointer ${
                showRealizedPnl
                  ? 'bg-sky-500/10 border-sky-500/40 text-text-primary'
                  : 'opacity-40 border-bg-border text-text-muted'
              }`}
              title="点击显示/隐藏已实现落袋盈亏曲线"
            >
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>已实现:</span>
              <span className="text-sky-400 font-bold">
                {displayRealizedPnl >= 0 ? '+' : ''}${displayRealizedPnl.toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowUnrealizedPnl(!showUnrealizedPnl)}
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border transition cursor-pointer ${
                showUnrealizedPnl
                  ? 'bg-amber-500/10 border-amber-500/40 text-text-primary'
                  : 'opacity-40 border-bg-border text-text-muted'
              }`}
              title="点击显示/隐藏持仓浮动盈亏曲线"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>浮动:</span>
              <span className="text-amber-400 font-bold">
                {displayUnrealizedPnl >= 0 ? '+' : ''}${displayUnrealizedPnl.toFixed(2)}
              </span>
            </button>
          </div>
        ) : metricMode === 'EQUITY_HWM' ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-text-muted">账户总权益:</span>
              <span className="text-purple-300 font-bold">${displayEquity.toFixed(2)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-text-muted">最高净值水线:</span>
              <span className="text-emerald-400 font-bold">
                ${(hoverData?.peakEquity ?? latestPoint?.peakEquity ?? displayEquity).toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-text-muted">累计收益率 (ROI):</span>
            <span className={displayRoi >= 0 ? 'text-trade-up font-bold' : 'text-trade-down font-bold'}>
              {displayRoi >= 0 ? '+' : ''}{displayRoi.toFixed(2)}%
            </span>
          </div>
        )}

        <div className="flex items-center space-x-2 ml-auto">
          <button
            type="button"
            onClick={() => setShowTradeMarkers(!showTradeMarkers)}
            className="flex items-center space-x-1 text-[10px] text-text-muted hover:text-text-primary cursor-pointer"
            title="显示/隐藏平仓打点标记"
          >
            {showTradeMarkers ? <Eye className="w-3 h-3 text-trade-ai" /> : <EyeOff className="w-3 h-3" />}
            <span>平仓打点</span>
          </button>
          {hoverData && (
            <span className="text-trade-ai font-mono">@{hoverData.timeStr}</span>
          )}
        </div>
      </div>

      {/* 4. Lightweight Charts 可拖拽缩放画布主体 */}
      <div className="relative flex-1 min-h-[165px] w-full">
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
        {normalizedPoints.length < 2 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-secondary/80 text-text-muted text-xs space-y-1.5 pointer-events-none">
            <Activity className="w-5 h-5 text-trade-ai animate-pulse" />
            <span>正在采集时序收益点（支持鼠标左键拖动平移、滚轮缩放）...</span>
          </div>
        )}
      </div>

      {/* 5. 底部战绩快览与平仓流水切换栏 */}
      {!compact && (
        <div className="border-t border-bg-border bg-bg-elevated/30 flex flex-col max-h-[135px]">
          <div className="flex items-center justify-between px-2.5 py-1 border-b border-bg-border/50 text-[10px]">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveBottomView('stats')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  activeBottomView === 'stats' ? 'bg-bg-elevated text-trade-ai' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                多维战绩归因
              </button>
              <button
                type="button"
                onClick={() => setActiveBottomView('trades')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  activeBottomView === 'trades' ? 'bg-bg-elevated text-trade-ai' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                最近自动平仓 ({rawTrades.length})
              </button>
            </div>
            <span className="text-text-muted font-mono">滚轮缩放 • 按住拖动</span>
          </div>

          <div className="p-2 overflow-y-auto text-[11px] font-mono-num">
            {activeBottomView === 'stats' ? (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-1.5 rounded bg-bg-secondary border border-bg-border/60">
                  <div className="text-[9px] text-text-muted">胜率</div>
                  <div className="font-bold text-text-primary mt-0.5">
                    {(autoPilotStatus?.total_trades_count ?? 0) > 0
                      ? `${((autoPilotStatus?.win_rate ?? 0) * 100).toFixed(1)}%`
                      : '--'}
                  </div>
                </div>
                <div className="p-1.5 rounded bg-bg-secondary border border-bg-border/60">
                  <div className="text-[9px] text-text-muted">盈亏比(PF)</div>
                  <div className="font-bold text-trade-ai mt-0.5">
                    {(autoPilotStatus?.profit_factor ?? 0) > 0
                      ? (autoPilotStatus?.profit_factor ?? 0).toFixed(2)
                      : '--'}
                  </div>
                </div>
                <div className="p-1.5 rounded bg-bg-secondary border border-bg-border/60">
                  <div className="text-[9px] text-text-muted">最大回撤</div>
                  <div className="font-bold text-amber-400 mt-0.5">
                    {(autoPilotStatus?.max_drawdown_pct ?? 0).toFixed(2)}%
                  </div>
                </div>
                <div className="p-1.5 rounded bg-bg-secondary border border-bg-border/60">
                  <div className="text-[9px] text-text-muted">成交笔数</div>
                  <div className="font-bold text-text-primary mt-0.5">
                    {autoPilotStatus?.winning_trades_count ?? 0}胜/{autoPilotStatus?.losing_trades_count ?? 0}负
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1 max-h-[85px] overflow-y-auto">
                {rawTrades.length > 0 ? (
                  rawTrades.slice(0, 20).map((t: AutoPilotTradeRecord, i: number) => (
                    <div
                      key={t.id || i}
                      className="flex items-center justify-between px-2 py-1 rounded bg-bg-secondary border border-bg-border/40 text-[10px]"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-1 py-0.2 rounded font-bold ${
                            t.pos_side === 'long'
                              ? 'bg-trade-up/20 text-trade-up'
                              : 'bg-trade-down/20 text-trade-down'
                          }`}
                        >
                          {t.pos_side === 'long' ? '多' : '空'} {t.leverage}x
                        </span>
                        <span className="font-bold text-text-primary">{getBaseCurrency(t.symbol)}</span>
                        <span className="text-text-muted">
                          ${t.entry_price}→${t.exit_price}
                        </span>
                      </div>
                      <div
                        className={`font-bold ${
                          t.realized_pnl >= 0 ? 'text-trade-up' : 'text-trade-down'
                        }`}
                      >
                        {t.realized_pnl >= 0 ? '+' : ''}${t.realized_pnl.toFixed(2)} ({t.roi_pct >= 0 ? '+' : ''}
                        {t.roi_pct.toFixed(1)}%)
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-text-muted py-2">暂无平仓记录</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {renderPanelContent(false)}

      {/* 全屏沉浸式多曲线放大检视弹窗 */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fade-in">
          <div className="w-full max-w-6xl h-[82vh] flex flex-col shadow-2xl">
            {renderPanelContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
export default EquityCurvePanel;
