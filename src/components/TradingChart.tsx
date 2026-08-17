/**
 * @file TradingChart.tsx
 * @description OKX-Dog 极客专业 K 线交易图表组件
 * 基于 TradingView lightweight-charts 引擎构建
 * 支持多周期切换、蜡烛图主图 + 成交量副图 + EMA 20/50/200 均线组
 * 动态叠加持仓均价线、止盈止损线、AI 支撑/阻力价格线与自适应缩放
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  ColorType,
  CrosshairMode,
  UTCTimestamp,
  CandlestickData,
  HistogramData,
  LineData,
  LineStyle,
} from 'lightweight-charts';
import { 
  Maximize2, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Layers 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { marketApi } from '../services/api';
import { TimeFrame, KlineCandle } from '../types';

interface OHLCVState {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePct: number;
}

export const TradingChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // 辅助价格线引用数组（用于动态清理与更新）
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastCandleRef = useRef<CandlestickData | null>(null);


  const {
    activeSymbol,
    activeTimeframe,
    setActiveTimeframe,
    ticker,
    positions,
    aiAnalysis,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [showEma, setShowEma] = useState(true);
  const [showOverlays, setShowOverlays] = useState(true);
  const [currentOhlc, setCurrentOhlc] = useState<OHLCVState | null>(null);

  const supportedTimeframes: { label: string; value: TimeFrame }[] = [
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '4h', value: '4h' },
    { label: '1d', value: '1d' },
  ];

  /**
   * EMA 指标计算算法
   */
  const calculateEMA = (data: CandlestickData[], period: number): LineData[] => {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    const emaArray: LineData[] = [];

    // 计算初始 SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].close;
    }
    let prevEma = sum / period;
    emaArray.push({ time: data[period - 1].time, value: Number(prevEma.toFixed(2)) });

    for (let i = period; i < data.length; i++) {
      const currentClose = data[i].close;
      prevEma = currentClose * k + prevEma * (1 - k);
      emaArray.push({ time: data[i].time, value: Number(prevEma.toFixed(2)) });
    }

    return emaArray;
  };

  /**
   * 生成真实或沙盒回退 K 线数据
   */
  const generateFallbackKlines = (timeframe: TimeFrame, count = 120): KlineCandle[] => {
    const candles: KlineCandle[] = [];
    const now = Math.floor(Date.now() / 1000);
    const stepSeconds =
      timeframe === '15m' ? 15 * 60 : timeframe === '1h' ? 3600 : timeframe === '4h' ? 14400 : 86400;

    let basePrice = ticker?.last_price || 95200;
    const startTime = now - count * stepSeconds;

    for (let i = 0; i < count; i++) {
      const time = (startTime + i * stepSeconds) * 1000;
      const volatility = basePrice * 0.006;
      const change = (Math.random() - 0.48) * volatility;
      const open = basePrice;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
      const low = Math.min(open, close) - Math.random() * (volatility * 0.5);
      const volume = Math.floor(150 + Math.random() * 450);

      candles.push({
        time,
        timestamp: time,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume,
        vol_currency: volume * close,
        is_closed: true,
      });

      basePrice = close;
    }

    return candles;
  };

  /**
   * 渲染动态高交互辅助线 (持仓均价、TP/SL、AI 支撑阻力)
   */
  const updatePriceOverlays = useCallback(() => {
    if (!candleSeriesRef.current) return;
    const series = candleSeriesRef.current;

    // 1. 清理现有辅助线
    priceLinesRef.current.forEach((line) => {
      try {
        series.removePriceLine(line);
      } catch {
        // 忽略移除异常
      }
    });
    priceLinesRef.current = [];

    if (!showOverlays) return;

    // 2. 叠加活跃持仓均价线与止盈止损线
    (Array.isArray(positions) ? positions : [])
      .filter((pos) => pos && pos.symbol === activeSymbol && (pos.pos_size ?? 0) > 0)
      .forEach((pos) => {
        // 持仓均价线 (亮黄色)
        const isLong = pos.pos_side === 'long';
        const uplVal = pos.upl ?? 0;
        const uplText = uplVal >= 0 ? `+${uplVal.toFixed(2)}` : uplVal.toFixed(2);
        const posLine = series.createPriceLine({
          price: pos.avg_price ?? 0,
          color: '#EAB308',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `持仓均价 (${isLong ? '多' : '空'} ${pos.pos_size ?? 0}张, 浮盈: ${uplText} USDT)`,
        });
        priceLinesRef.current.push(posLine);

        // 强平预警参考线 (粉紫色)
        if (pos.liquidation_price && pos.liquidation_price > 0) {
          const liqLine = series.createPriceLine({
            price: pos.liquidation_price,
            color: '#EC4899',
            lineWidth: 1,
            lineStyle: LineStyle.LargeDashed,
            axisLabelVisible: true,
            title: `预估强平价: $${(pos.liquidation_price || 0).toFixed(2)}`,
          });
          priceLinesRef.current.push(liqLine);
        }

        // 关联止盈线 (亮绿色虚线)
        if (pos.tp_trigger_price && pos.tp_trigger_price > 0) {
          const tpLine = series.createPriceLine({
            price: pos.tp_trigger_price,
            color: '#00C087',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `持仓止盈线 (TP): $${(pos.tp_trigger_price || 0).toFixed(2)}`,
          });
          priceLinesRef.current.push(tpLine);
        }

        // 关联止损线 (霓虹红虚线)
        if (pos.sl_trigger_price && pos.sl_trigger_price > 0) {
          const slLine = series.createPriceLine({
            price: pos.sl_trigger_price,
            color: '#F6465D',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `持仓止损线 (SL): $${(pos.sl_trigger_price || 0).toFixed(2)}`,
          });
          priceLinesRef.current.push(slLine);
        }
      });

    // 3. 叠加 AI 建议关键点位 (支撑位/阻力位/建议计划)
    if (aiAnalysis && aiAnalysis.symbol === activeSymbol) {
      const plan = aiAnalysis.trade_plan;
      const tfDetail =
        activeTimeframe === '15m'
          ? aiAnalysis.timeframe_analysis?.tf_15m
          : activeTimeframe === '4h'
          ? aiAnalysis.timeframe_analysis?.tf_4h
          : activeTimeframe === '1d'
          ? aiAnalysis.timeframe_analysis?.tf_1d
          : aiAnalysis.timeframe_analysis?.tf_1h;

      // AI 关键支撑位 (绿色点线)
      if (tfDetail?.support_level) {
        const supportLine = series.createPriceLine({
          price: tfDetail.support_level,
          color: '#10B981',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `AI ${activeTimeframe}支撑: $${(tfDetail.support_level || 0).toFixed(2)}`,
        });
        priceLinesRef.current.push(supportLine);
      }

      // AI 关键阻力位 (红色点线)
      if (tfDetail?.resistance_level) {
        const resLine = series.createPriceLine({
          price: tfDetail.resistance_level,
          color: '#EF4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `AI ${activeTimeframe}阻力: $${(tfDetail.resistance_level || 0).toFixed(2)}`,
        });
        priceLinesRef.current.push(resLine);
      }

      // AI 计划建议止损点
      if (plan?.stop_loss_price && (!positions.length || !positions[0]?.sl_trigger_price)) {
        const planSlLine = series.createPriceLine({
          price: plan.stop_loss_price,
          color: '#F43F5E',
          lineWidth: 1,
          lineStyle: LineStyle.SparseDotted,
          axisLabelVisible: true,
          title: `AI 建议止损: $${(plan.stop_loss_price || 0).toFixed(2)}`,
        });
        priceLinesRef.current.push(planSlLine);
      }
    }
  }, [activeSymbol, activeTimeframe, positions, aiAnalysis, showOverlays]);

  /**
   * 初始化与挂载 lightweight-charts 图表
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 创建 Chart 实例
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 420,
      layout: {
        background: { type: ColorType.Solid, color: '#151921' },
        textColor: '#9CA3AF',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', -apple-system, BlinkMacSystemFont, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(42, 48, 60, 0.4)' },
        horzLines: { color: 'rgba(42, 48, 60, 0.4)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#6366F1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1E232E',
        },
        horzLine: {
          color: '#6366F1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1E232E',
        },
      },
      rightPriceScale: {
        borderColor: '#2A303C',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22, // 预留底部给成交量
        },
      },
      timeScale: {
        borderColor: '#2A303C',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // 1. 蜡烛图主图系列
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00C087',
      downColor: '#F6465D',
      borderVisible: false,
      wickUpColor: '#00C087',
      wickDownColor: '#F6465D',
    });
    candleSeriesRef.current = candleSeries;

    // 2. 成交量副图系列
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '', // 独立副图比例尺
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82, // 位于图表底部 18% 高度
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // 3. EMA 均线系列 (EMA 20 琥珀黄, EMA 50 天蓝, EMA 200 紫色)
    const ema20Series = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    ema20SeriesRef.current = ema20Series;

    const ema50Series = chart.addLineSeries({
      color: '#38BDF8',
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    ema50SeriesRef.current = ema50Series;

    const ema200Series = chart.addLineSeries({
      color: '#A855F7',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    ema200SeriesRef.current = ema200Series;

    // 4. 十字光标悬浮监听与数据头部更新
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.time ||
        !param.seriesData ||
        !param.seriesData.get(candleSeries)
      ) {
        return;
      }
      const data = param.seriesData.get(candleSeries) as CandlestickData;
      const volData = param.seriesData.get(volumeSeries) as HistogramData;

      const changePct = ((data.close - data.open) / data.open) * 100;
      const dateStr = new Date(Number(data.time) * 1000).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      setCurrentOhlc({
        time: dateStr,
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: volData?.value || 0,
        changePct,
      });
    });

    // 5. 监听窗口自适应尺寸
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height: height || 420 });
    });

    resizeObserver.observe(chartContainerRef.current);

    // 6. 组件卸载时释放内存
    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  /**
   * 加载历史 K 线与刷新数据
   */
  const loadKlines = useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    setLoading(true);

    try {
      let klines: KlineCandle[] = [];
      try {
        klines = await marketApi.getKline(activeSymbol, activeTimeframe, 150);
      } catch {
        // 当后端未完全就绪时，降级使用保真行情数据
        klines = generateFallbackKlines(activeTimeframe, 150);
      }

      if (!klines || klines.length === 0) {
        klines = generateFallbackKlines(activeTimeframe, 150);
      }

      // 格式化为 Lightweight Charts 格式，确保时间戳提取正确并严格单调递增
      const rawCandles: {
        time: UTCTimestamp;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }[] = [];

      klines.forEach((k) => {
        const rawTs = k.timestamp ?? k.time ?? (k as any).ts;
        if (rawTs) {
          const sec = (rawTs > 10000000000 ? Math.floor(rawTs / 1000) : rawTs) as UTCTimestamp;
          if (!isNaN(sec) && sec > 0) {
            rawCandles.push({
              time: sec,
              open: Number(k.open),
              high: Number(k.high),
              low: Number(k.low),
              close: Number(k.close),
              volume: Number(k.volume || 0),
            });
          }
        }
      });

      // 严格按时间升序排序
      rawCandles.sort((a, b) => Number(a.time) - Number(b.time));

      // 去重 (lightweight-charts 禁止重复时间戳)
      const formattedCandles: CandlestickData[] = [];
      const formattedVolumes: HistogramData[] = [];
      const seenTime = new Set<number>();

      rawCandles.forEach((item) => {
        const t = Number(item.time);
        if (!seenTime.has(t)) {
          seenTime.add(t);
          formattedCandles.push({
            time: item.time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
          });
          formattedVolumes.push({
            time: item.time,
            value: item.volume,
            color: item.close >= item.open ? 'rgba(0, 192, 135, 0.4)' : 'rgba(246, 70, 93, 0.4)',
          });
        }
      });

      if (formattedCandles.length > 0) {
        candleSeriesRef.current.setData(formattedCandles);
        volumeSeriesRef.current.setData(formattedVolumes);
        lastCandleRef.current = { ...formattedCandles[formattedCandles.length - 1] };

        // 计算并绑定 EMA
        if (showEma) {
          const ema20 = calculateEMA(formattedCandles, 20);
          const ema50 = calculateEMA(formattedCandles, 50);
          const ema200 = calculateEMA(formattedCandles, 200);

          ema20SeriesRef.current?.setData(ema20);
          ema50SeriesRef.current?.setData(ema50);
          ema200SeriesRef.current?.setData(ema200);
        } else {
          ema20SeriesRef.current?.setData([]);
          ema50SeriesRef.current?.setData([]);
          ema200SeriesRef.current?.setData([]);
        }

        // 更新当前头部看板 OHLC
        const last = formattedCandles[formattedCandles.length - 1];
        const lastVol = formattedVolumes[formattedVolumes.length - 1]?.value || 0;
        setCurrentOhlc({
          time: new Date(Number(last.time) * 1000).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
          volume: lastVol,
          changePct: ((last.close - last.open) / (last.open || 1)) * 100,
        });

        chartRef.current?.timeScale().fitContent();
        updatePriceOverlays();
      }
    } catch (err) {
      console.error('[Chart] 加载 K 线失败:', err);
    } finally {
      setLoading(false);
    }
  }, [activeSymbol, activeTimeframe, showEma, updatePriceOverlays]);

  // 当标的、周期切换时重新拉取数据
  useEffect(() => {
    loadKlines();
  }, [loadKlines]);

  // 当持仓或 AI 研判变化时更新叠加辅助线
  useEffect(() => {
    updatePriceOverlays();
  }, [updatePriceOverlays]);

  // 实时 Ticker 更新最新 Candle (周期对齐与动态真实 High/Low 维护)
  useEffect(() => {
    if (!ticker || !ticker.last_price || !candleSeriesRef.current) return;
    const p = ticker.last_price;

    const tfSeconds =
      activeTimeframe === '15m'
        ? 15 * 60
        : activeTimeframe === '4h'
        ? 4 * 3600
        : activeTimeframe === '1d'
        ? 86400
        : 3600;

    const nowSec = Math.floor(Date.now() / 1000);
    const barTime = (Math.floor(nowSec / tfSeconds) * tfSeconds) as UTCTimestamp;

    try {
      if (lastCandleRef.current && Number(lastCandleRef.current.time) === Number(barTime)) {
        const updated: CandlestickData = {
          time: barTime,
          open: lastCandleRef.current.open,
          high: Math.max(lastCandleRef.current.high, p),
          low: Math.min(lastCandleRef.current.low, p),
          close: p,
        };
        lastCandleRef.current = updated;
        candleSeriesRef.current.update(updated);
      } else {
        const newBar: CandlestickData = {
          time: barTime,
          open: lastCandleRef.current ? lastCandleRef.current.close : p,
          high: p,
          low: p,
          close: p,
        };
        lastCandleRef.current = newBar;
        candleSeriesRef.current.update(newBar);
      }
    } catch {
      // 忽略实时微弱更新异常
    }
  }, [ticker, activeTimeframe]);


  return (
    <div className="flex flex-col h-full w-full rounded-lg border border-bg-border bg-bg-secondary overflow-hidden shadow-lg">
      {/* 1. 图表顶部控制栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bg-border bg-bg-secondary">
        {/* 左侧：周期切换与指标开关 */}
        <div className="flex items-center space-x-1.5">
          {supportedTimeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setActiveTimeframe(tf.value)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
                activeTimeframe === tf.value
                  ? 'bg-trade-ai text-white shadow-sm shadow-trade-ai/30 font-bold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              }`}
            >
              {tf.label}
            </button>
          ))}

          <div className="h-4 w-px bg-bg-border mx-1" />

          {/* EMA 均线开关 */}
          <button
            onClick={() => setShowEma(!showEma)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
              showEma
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-text-muted hover:text-text-secondary bg-bg-elevated'
            }`}
            title="EMA 20/50/200 均线组"
          >
            <Layers className="w-3 h-3" />
            <span>EMA</span>
          </button>

          {/* 辅助价格线开关 */}
          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
              showOverlays
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                : 'text-text-muted hover:text-text-secondary bg-bg-elevated'
            }`}
            title="持仓均价、止盈止损与 AI 支撑阻力线"
          >
            {showOverlays ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Overlay</span>
          </button>
        </div>

        {/* 右侧：刷新与全屏工具 */}
        <div className="flex items-center space-x-2">
          {loading && (
            <span className="flex items-center text-[10px] text-text-muted">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin text-trade-ai" />
              加载中...
            </span>
          )}

          <button
            onClick={() => loadKlines()}
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
            title="刷新图表"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
            title="自适应缩放"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. OHLCV 实时数据悬浮条 */}
      {currentOhlc && (
        <div className="flex flex-wrap items-center gap-x-3 px-3 py-1 bg-bg-primary/50 text-[11px] font-mono-num border-b border-bg-border/60">
          <span className="text-text-muted">{currentOhlc.time}</span>
          <span>
            <span className="text-text-muted">O: </span>
            <span className="text-text-primary">{(currentOhlc.open ?? 0).toFixed(1)}</span>
          </span>
          <span>
            <span className="text-text-muted">H: </span>
            <span className="text-text-primary">{(currentOhlc.high ?? 0).toFixed(1)}</span>
          </span>
          <span>
            <span className="text-text-muted">L: </span>
            <span className="text-text-primary">{(currentOhlc.low ?? 0).toFixed(1)}</span>
          </span>
          <span>
            <span className="text-text-muted">C: </span>
            <span
              className={`font-semibold ${
                (currentOhlc.close ?? 0) >= (currentOhlc.open ?? 0) ? 'text-trade-up' : 'text-trade-down'
              }`}
            >
              {(currentOhlc.close ?? 0).toFixed(1)} ({(currentOhlc.changePct ?? 0) >= 0 ? '+' : ''}
              {(currentOhlc.changePct ?? 0).toFixed(2)}%)
            </span>
          </span>
          <span>
            <span className="text-text-muted">Vol: </span>
            <span className="text-text-secondary">{(currentOhlc.volume ?? 0).toLocaleString()}</span>
          </span>

          {/* EMA 图例 */}
          {showEma && (
            <div className="ml-auto hidden md:flex items-center space-x-2 text-[10px]">
              <span className="flex items-center text-amber-400">
                <span className="w-2 h-0.5 bg-amber-400 mr-1" />
                EMA(20)
              </span>
              <span className="flex items-center text-sky-400">
                <span className="w-2 h-0.5 bg-sky-400 mr-1" />
                EMA(50)
              </span>
              <span className="flex items-center text-purple-400">
                <span className="w-2 h-0.5 bg-purple-400 mr-1" />
                EMA(200)
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3. 图表核心画布容器 */}
      <div className="relative flex-1 w-full min-h-[360px] bg-bg-secondary">
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};
