/**
 * @file TradingChart.tsx
 * @description OKX-Dog 极客专业 K 线交易图表组件
 * 基于 TradingView lightweight-charts 引擎构建
 * 支持多周期切换、蜡烛图主图 + 多副图指标 (成交量 / RSI / MACD) + EMA 20/50/200 均线组
 * 动态叠加持仓均价线、止盈止损线、AI 支撑/阻力价格线与 AI 决策信号图表打点 (Markers)
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
  SeriesMarker,
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
import { wsService } from '../services/websocket';
import { TimeFrame, KlineCandle } from '../types';
import { getSymbolDefaultPrice, formatPrice } from '../utils/symbolHelper';

interface OHLCVState {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePct: number;
}

type SubIndicatorType = 'VOL' | 'RSI' | 'MACD';

export const TradingChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  
  // 副图指标系列
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdDifSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdDeaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // EMA 均线系列
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // 辅助价格线引用数组
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastCandleRef = useRef<CandlestickData | null>(null);
  const currentCandlesRef = useRef<CandlestickData[]>([]);

  const {
    activeSymbol,
    activeTimeframe,
    setActiveTimeframe,
    ticker,
    positions,
    aiAnalysis,
  } = useAppStore();

  const activeSymbolRef = useRef(activeSymbol);
  activeSymbolRef.current = activeSymbol;
  const activeTimeframeRef = useRef(activeTimeframe);
  activeTimeframeRef.current = activeTimeframe;
  const loadReqSeqRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [showEma, setShowEma] = useState(true);
  const [showOverlays, setShowOverlays] = useState(true);
  const [subIndicator, setSubIndicator] = useState<SubIndicatorType>('VOL');
  const [currentOhlc, setCurrentOhlc] = useState<OHLCVState | null>(null);
  const [currentRsiVal, setCurrentRsiVal] = useState<number | null>(null);
  const [currentMacdVal, setCurrentMacdVal] = useState<{ dif: number; dea: number; hist: number } | null>(null);

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
   * RSI (14) 指标计算算法
   */
  const calculateRSI = (data: CandlestickData[], period: number = 14): LineData[] => {
    if (data.length <= period) return [];
    const rsiArray: LineData[] = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - 100 / (1 + rs);
    rsiArray.push({ time: data[period].time, value: Number(rsi.toFixed(2)) });

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);
      rsiArray.push({ time: data[i].time, value: Number(rsi.toFixed(2)) });
    }

    return rsiArray;
  };

  /**
   * MACD (12, 26, 9) 指标计算算法
   */
  const calculateMACD = (data: CandlestickData[], fast = 12, slow = 26, signal = 9) => {
    if (data.length < slow + signal) return { dif: [], dea: [], hist: [] };
    const emaFast = calculateEMA(data, fast);
    const emaSlow = calculateEMA(data, slow);

    const difMap = new Map<number, number>();
    const fastMap = new Map<number, number>(emaFast.map((item) => [Number(item.time), item.value]));

    emaSlow.forEach((slowItem) => {
      const t = Number(slowItem.time);
      const fastVal = fastMap.get(t);
      if (fastVal !== undefined) {
        difMap.set(t, fastVal - slowItem.value);
      }
    });

    const difArray: LineData[] = Array.from(difMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as UTCTimestamp, value: Number(value.toFixed(2)) }));

    if (difArray.length < signal) return { dif: difArray, dea: [], hist: [] };
    const k = 2 / (signal + 1);
    let sum = 0;
    for (let i = 0; i < signal; i++) sum += difArray[i].value;
    let prevDea = sum / signal;
    const deaArray: LineData[] = [{ time: difArray[signal - 1].time, value: Number(prevDea.toFixed(2)) }];

    for (let i = signal; i < difArray.length; i++) {
      prevDea = difArray[i].value * k + prevDea * (1 - k);
      deaArray.push({ time: difArray[i].time, value: Number(prevDea.toFixed(2)) });
    }

    const deaMap = new Map<number, number>(deaArray.map((item) => [Number(item.time), item.value]));
    const histArray: HistogramData[] = [];

    difArray.forEach((difItem) => {
      const t = Number(difItem.time);
      const deaVal = deaMap.get(t);
      if (deaVal !== undefined) {
        const histVal = (difItem.value - deaVal) * 2;
        histArray.push({
          time: difItem.time,
          value: Number(histVal.toFixed(2)),
          color: histVal >= 0 ? 'rgba(0, 192, 135, 0.7)' : 'rgba(246, 70, 93, 0.7)',
        });
      }
    });

    return { dif: difArray, dea: deaArray, hist: histArray };
  };

  /**
   * 生成真实或沙盒回退 K 线数据 (防网络波动兜底)
   */
  const generateFallbackKlines = (timeframe: TimeFrame, count = 120): KlineCandle[] => {
    const candles: KlineCandle[] = [];
    const now = Math.floor(Date.now() / 1000);
    const stepSeconds =
      timeframe === '15m' ? 15 * 60 : timeframe === '1h' ? 3600 : timeframe === '4h' ? 14400 : 86400;

    let basePrice = getSymbolDefaultPrice(activeSymbolRef.current);
    if (ticker && ticker.symbol === activeSymbolRef.current && ticker.last_price > 0) {
      basePrice = ticker.last_price;
    }
    const startTime = now - count * stepSeconds;

    for (let i = 0; i < count; i++) {
      const time = (startTime + i * stepSeconds) * 1000;
      const volatility = basePrice * 0.006;
      const change = (Math.random() - 0.48) * volatility;
      const open = basePrice;
      const close = Math.max(0.0001, open + change);
      const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
      const low = Math.max(0.0001, Math.min(open, close) - Math.random() * (volatility * 0.5));
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
   * 刷新与应用副图指标显示
   */
  const applySubIndicatorData = useCallback(
    (candles: CandlestickData[], volumes: HistogramData[]) => {
      if (!chartRef.current) return;

      if (subIndicator === 'VOL') {
        volumeSeriesRef.current?.setData(volumes);
        rsiSeriesRef.current?.setData([]);
        macdDifSeriesRef.current?.setData([]);
        macdDeaSeriesRef.current?.setData([]);
        macdHistSeriesRef.current?.setData([]);
      } else if (subIndicator === 'RSI') {
        volumeSeriesRef.current?.setData([]);
        const rsiData = calculateRSI(candles, 14);
        rsiSeriesRef.current?.setData(rsiData);
        if (rsiData.length > 0) {
          setCurrentRsiVal(rsiData[rsiData.length - 1].value);
        }
        macdDifSeriesRef.current?.setData([]);
        macdDeaSeriesRef.current?.setData([]);
        macdHistSeriesRef.current?.setData([]);
      } else if (subIndicator === 'MACD') {
        volumeSeriesRef.current?.setData([]);
        rsiSeriesRef.current?.setData([]);
        const { dif, dea, hist } = calculateMACD(candles, 12, 26, 9);
        macdDifSeriesRef.current?.setData(dif);
        macdDeaSeriesRef.current?.setData(dea);
        macdHistSeriesRef.current?.setData(hist);
        if (dif.length > 0 && dea.length > 0) {
          setCurrentMacdVal({
            dif: dif[dif.length - 1].value,
            dea: dea[dea.length - 1].value,
            hist: hist[hist.length - 1]?.value || 0,
          });
        }
      }
    },
    [subIndicator]
  );

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
      .filter((pos) => pos && pos.symbol === activeSymbol && (pos.pos_size ?? pos.pos ?? 0) > 0)
      .forEach((pos) => {
        const isLong = pos.pos_side === 'long';
        const uplVal = pos.upl ?? 0;
        const uplText = uplVal >= 0 ? `+${uplVal.toFixed(2)}` : uplVal.toFixed(2);
        const avgPx = pos.avg_price ?? pos.avg_px ?? 0;
        const curSize = pos.pos_size ?? pos.pos ?? 0;
        const curLiq = pos.liquidation_price ?? pos.liq_px;

        if (avgPx <= 0) return;

        try {
          const posLine = series.createPriceLine({
            price: avgPx,
            color: '#EAB308',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `持仓均价 (${isLong ? '多' : '空'} ${curSize}张/币, 浮盈: ${uplText} USDT)`,
          });
          priceLinesRef.current.push(posLine);

          if (curLiq && curLiq > 0) {
            const liqLine = series.createPriceLine({
              price: curLiq,
              color: '#EC4899',
              lineWidth: 1,
              lineStyle: LineStyle.LargeDashed,
              axisLabelVisible: true,
              title: `预估强平价: $${formatPrice(curLiq, pos.symbol)}`,
            });
            priceLinesRef.current.push(liqLine);
          }

          if (pos.tp_trigger_price && pos.tp_trigger_price > 0) {
            const tpLine = series.createPriceLine({
              price: pos.tp_trigger_price,
              color: '#00C087',
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `持仓止盈线 (TP): $${formatPrice(pos.tp_trigger_price, pos.symbol)}`,
            });
            priceLinesRef.current.push(tpLine);
          }

          if (pos.sl_trigger_price && pos.sl_trigger_price > 0) {
            const slLine = series.createPriceLine({
              price: pos.sl_trigger_price,
              color: '#F6465D',
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `持仓止损线 (SL): $${formatPrice(pos.sl_trigger_price, pos.symbol)}`,
            });
            priceLinesRef.current.push(slLine);
          }
        } catch {}
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

      try {
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
      } catch {}
    }
  }, [activeSymbol, activeTimeframe, positions, aiAnalysis, showOverlays]);

  /**
   * 动态打点 AI 交易研判信号 (Trade Signal Markers)
   */
  const updateAIMarkers = useCallback(() => {
    if (!candleSeriesRef.current) return;
    if (!aiAnalysis || aiAnalysis.symbol !== activeSymbol) {
      candleSeriesRef.current.setMarkers([]);
      return;
    }

    const signal = aiAnalysis.signal;
    const action = signal?.action;
    const confidence = signal?.confidence ? Math.round(signal.confidence * 100) : 0;
    const plan = aiAnalysis.trade_plan;

    if (!action || !lastCandleRef.current) return;

    const latestTime = Number(lastCandleRef.current.time) as UTCTimestamp;
    const markers: SeriesMarker<UTCTimestamp>[] = [];

    if (action === 'BUY_LONG') {
      markers.push({
        time: latestTime,
        position: 'belowBar',
        color: '#00C087',
        shape: 'arrowUp',
        text: `AI 看多 (${confidence}%) 杠杆:${plan?.suggested_leverage || 3}x`,
      });
    } else if (action === 'SELL_SHORT') {
      markers.push({
        time: latestTime,
        position: 'aboveBar',
        color: '#F6465D',
        shape: 'arrowDown',
        text: `AI 看空 (${confidence}%) 杠杆:${plan?.suggested_leverage || 3}x`,
      });
    } else if (action === 'CLOSE_POSITION') {
      markers.push({
        time: latestTime,
        position: 'aboveBar',
        color: '#F59E0B',
        shape: 'circle',
        text: 'AI 建议止盈/平仓',
      });
    }

    try {
      candleSeriesRef.current.setMarkers(markers);
    } catch {}
  }, [aiAnalysis, activeSymbol]);

  /**
   * 加载历史 K 线与刷新数据
   */
  const loadKlines = useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    const currentSeq = ++loadReqSeqRef.current;
    const currentSymbol = activeSymbolRef.current;
    const currentTf = activeTimeframeRef.current;

    setLoading(true);

    try {
      let klines: KlineCandle[] = [];
      try {
        klines = await marketApi.getKline(currentSymbol, currentTf, 150);
      } catch {
        klines = generateFallbackKlines(currentTf, 150);
      }

      if (
        currentSeq !== loadReqSeqRef.current ||
        activeSymbolRef.current !== currentSymbol ||
        activeTimeframeRef.current !== currentTf
      ) {
        return;
      }

      if (!klines || klines.length === 0) {
        klines = generateFallbackKlines(currentTf, 150);
      }

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
        if (rawTs !== undefined && rawTs !== null) {
          const numTs = typeof rawTs === 'string' ? Number(rawTs) : Number(rawTs);
          if (!isNaN(numTs) && numTs > 0) {
            const sec = (numTs > 10000000000 ? Math.floor(numTs / 1000) : Math.floor(numTs)) as UTCTimestamp;
            const op = Number(k.open);
            const hi = Number(k.high);
            const lo = Number(k.low);
            const cl = Number(k.close);
            if (!isNaN(op) && !isNaN(hi) && !isNaN(lo) && !isNaN(cl)) {
              rawCandles.push({
                time: sec,
                open: op,
                high: hi,
                low: lo,
                close: cl,
                volume: Number(k.volume || 0),
              });
            }
          }
        }
      });

      rawCandles.sort((a, b) => Number(a.time) - Number(b.time));

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

      if (formattedCandles.length > 0 && candleSeriesRef.current) {
        currentCandlesRef.current = formattedCandles;
        candleSeriesRef.current.setData(formattedCandles);
        lastCandleRef.current = { ...formattedCandles[formattedCandles.length - 1] };

        // 渲染 EMA
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

        // 渲染当前副图指标
        applySubIndicatorData(formattedCandles, formattedVolumes);

        // 更新头部看板
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

        // 渲染辅助线与打点
        try {
          updatePriceOverlays();
          updateAIMarkers();
        } catch {}

        // 视图自适应居中
        chartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      console.error('[Chart] 加载 K 线失败:', err);
    } finally {
      if (currentSeq === loadReqSeqRef.current) {
        setLoading(false);
      }
    }
  }, [showEma, applySubIndicatorData]);

  /**
   * 初始化与挂载 lightweight-charts 图表
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth || 600;
    const initialHeight = container.clientHeight || 380;

    const chart = createChart(container, {
      width: initialWidth,
      height: initialHeight,
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
          top: 0.08,
          bottom: 0.25,
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

    // 2. 副图：成交量系列
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume_scale',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.80, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // 3. 副图：RSI(14)
    const rsiSeries = chart.addLineSeries({
      color: '#A855F7',
      lineWidth: 1,
      priceScaleId: 'rsi_scale',
    });
    rsiSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0.02 },
    });
    rsiSeriesRef.current = rsiSeries;

    // RSI 70/30 参考线
    try {
      rsiSeries.createPriceLine({
        price: 70,
        color: 'rgba(239, 68, 68, 0.4)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: '超买 70',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: 'rgba(16, 185, 129, 0.4)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: '超卖 30',
      });
    } catch {}

    // 4. 副图：MACD (12, 26, 9)
    const macdDifSeries = chart.addLineSeries({
      color: '#38BDF8',
      lineWidth: 1,
      priceScaleId: 'macd_scale',
    });
    const macdDeaSeries = chart.addLineSeries({
      color: '#FBBF24',
      lineWidth: 1,
      priceScaleId: 'macd_scale',
    });
    const macdHistSeries = chart.addHistogramSeries({
      priceScaleId: 'macd_scale',
    });

    macdDifSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0.02 } });
    macdDeaSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0.02 } });
    macdHistSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0.02 } });

    macdDifSeriesRef.current = macdDifSeries;
    macdDeaSeriesRef.current = macdDeaSeries;
    macdHistSeriesRef.current = macdHistSeries;

    // 5. EMA 均线系列
    const ema20Series = chart.addLineSeries({
      color: '#FBBF24',
      lineWidth: 1,
      priceLineVisible: false,
    });
    const ema50Series = chart.addLineSeries({
      color: '#38BDF8',
      lineWidth: 1,
      priceLineVisible: false,
    });
    const ema200Series = chart.addLineSeries({
      color: '#F472B6',
      lineWidth: 1,
      priceLineVisible: false,
    });

    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;
    ema200SeriesRef.current = ema200Series;

    // 6. 十字光标移动事件
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) return;
      const cData = param.seriesData.get(candleSeries) as CandlestickData;
      if (cData) {
        const vData = param.seriesData.get(volumeSeries) as HistogramData;
        const rData = param.seriesData.get(rsiSeries) as LineData;
        const difData = param.seriesData.get(macdDifSeries) as LineData;
        const deaData = param.seriesData.get(macdDeaSeries) as LineData;
        const histData = param.seriesData.get(macdHistSeries) as HistogramData;

        const dateStr = new Date(Number(param.time) * 1000).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        const changePct = ((cData.close - cData.open) / (cData.open || 1)) * 100;

        setCurrentOhlc({
          time: dateStr,
          open: cData.open,
          high: cData.high,
          low: cData.low,
          close: cData.close,
          volume: vData?.value || 0,
          changePct,
        });

        if (rData) setCurrentRsiVal(rData.value);
        if (difData && deaData) {
          setCurrentMacdVal({
            dif: difData.value,
            dea: deaData.value,
            hist: histData?.value || 0,
          });
        }
      }
    });

    // 7. 自适应监听
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0) {
        chartRef.current.applyOptions({ width, height: height || 380 });
      }
    });
    resizeObserver.observe(container);

    // 8. 挂载完成后立即触发首次数据加载
    requestAnimationFrame(() => {
      loadKlines();
    });

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // 当标的或周期切换时，立即重新加载 K 线
  useEffect(() => {
    lastCandleRef.current = null;
    currentCandlesRef.current = [];
    setCurrentOhlc(null);
    setCurrentRsiVal(null);
    setCurrentMacdVal(null);
    loadKlines();
  }, [activeSymbol, activeTimeframe, loadKlines]);

  // 当持仓或 AI 研判变化时，更新图表辅助线与标记
  useEffect(() => {
    updatePriceOverlays();
  }, [updatePriceOverlays]);

  useEffect(() => {
    updateAIMarkers();
  }, [updateAIMarkers]);

  // 当副图指标切换时，重新渲染副图数据
  useEffect(() => {
    if (currentCandlesRef.current.length > 0) {
      const volumes: HistogramData[] = currentCandlesRef.current.map((c) => ({
        time: c.time,
        value: 0,
        color: c.close >= c.open ? 'rgba(0, 192, 135, 0.4)' : 'rgba(246, 70, 93, 0.4)',
      }));
      applySubIndicatorData(currentCandlesRef.current, volumes);
    }
  }, [subIndicator, applySubIndicatorData]);

  // WebSocket 实时 K 线频道监听
  useEffect(() => {
    const handleKlinePush = (payload: any) => {
      if (!payload.data || !candleSeriesRef.current) return;
      const candle: KlineCandle = payload.data;
      const rawTs = candle.timestamp ?? candle.time ?? (candle as any).ts;
      if (!rawTs) return;
      const numTs = typeof rawTs === 'string' ? Number(rawTs) : Number(rawTs);
      if (isNaN(numTs) || numTs <= 0) return;
      const sec = (numTs > 10000000000 ? Math.floor(numTs / 1000) : Math.floor(numTs)) as UTCTimestamp;
      const updated: CandlestickData = {
        time: sec,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
      };
      lastCandleRef.current = updated;
      try {
        candleSeriesRef.current.update(updated);

        if (candle.volume !== undefined) {
          const volVal = Number(candle.volume || 0);
          volumeSeriesRef.current?.update({
            time: sec,
            value: volVal,
            color: updated.close >= updated.open ? 'rgba(0, 192, 135, 0.4)' : 'rgba(246, 70, 93, 0.4)',
          });
        }
      } catch {}

      const dateStr = new Date(Number(sec) * 1000).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const changePct = ((updated.close - updated.open) / (updated.open || 1)) * 100;
      setCurrentOhlc({
        time: dateStr,
        open: updated.open,
        high: updated.high,
        low: updated.low,
        close: updated.close,
        volume: Number(candle.volume || 0),
        changePct,
      });
    };

    const klineChannel = `kline:${activeSymbol}:${activeTimeframe}`;
    wsService.subscribe(klineChannel, handleKlinePush);

    return () => {
      wsService.unsubscribe(klineChannel, handleKlinePush);
    };
  }, [activeSymbol, activeTimeframe]);

  // 实时 Ticker 更新与 K 线/成交量/OHLC 动态跳动
  useEffect(() => {
    if (!ticker || !ticker.last_price || ticker.symbol !== activeSymbol || !candleSeriesRef.current || !lastCandleRef.current) {
      return;
    }
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
      if (Number(lastCandleRef.current.time) === Number(barTime)) {
        const updated: CandlestickData = {
          time: barTime,
          open: lastCandleRef.current.open,
          high: Math.max(lastCandleRef.current.high, p),
          low: Math.min(lastCandleRef.current.low, p),
          close: p,
        };
        lastCandleRef.current = updated;
        candleSeriesRef.current.update(updated);

        const volVal = ticker.volume_24h ? Math.max(50, Math.round(ticker.volume_24h / 500)) : 100;
        volumeSeriesRef.current?.update({
          time: barTime,
          value: volVal,
          color: updated.close >= updated.open ? 'rgba(0, 192, 135, 0.4)' : 'rgba(246, 70, 93, 0.4)',
        });

        const dateStr = new Date(Number(barTime) * 1000).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        const changePct = ((updated.close - updated.open) / (updated.open || 1)) * 100;
        setCurrentOhlc({
          time: dateStr,
          open: updated.open,
          high: updated.high,
          low: updated.low,
          close: updated.close,
          volume: volVal,
          changePct,
        });
      } else if (Number(barTime) > Number(lastCandleRef.current.time)) {
        const prevClose = lastCandleRef.current.close;
        const newBar: CandlestickData = {
          time: barTime,
          open: prevClose,
          high: Math.max(prevClose, p),
          low: Math.min(prevClose, p),
          close: p,
        };
        lastCandleRef.current = newBar;
        candleSeriesRef.current.update(newBar);

        const volVal = ticker.volume_24h ? Math.max(50, Math.round(ticker.volume_24h / 500)) : 100;
        volumeSeriesRef.current?.update({
          time: barTime,
          value: volVal,
          color: newBar.close >= newBar.open ? 'rgba(0, 192, 135, 0.4)' : 'rgba(246, 70, 93, 0.4)',
        });
      }
    } catch {
      // 忽略实时更新异常
    }
  }, [ticker, activeSymbol, activeTimeframe]);

  return (
    <div className="flex flex-col h-full w-full rounded-lg border border-bg-border bg-bg-secondary overflow-hidden shadow-lg">
      {/* 1. 图表顶部控制栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bg-border bg-bg-secondary shrink-0">
        {/* 左侧：周期切换与主图指标 */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          {supportedTimeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setActiveTimeframe(tf.value)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                activeTimeframe === tf.value
                  ? 'bg-trade-ai text-white shadow-sm shadow-trade-ai/30 font-bold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              }`}
            >
              {tf.label}
            </button>
          ))}

          <div className="h-4 w-px bg-bg-border mx-1 shrink-0" />

          {/* EMA 均线开关 */}
          <button
            onClick={() => setShowEma(!showEma)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
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
            className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              showOverlays
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                : 'text-text-muted hover:text-text-secondary bg-bg-elevated'
            }`}
            title="持仓均价、止盈止损与 AI 支撑阻力线"
          >
            {showOverlays ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Overlay</span>
          </button>

          <div className="h-4 w-px bg-bg-border mx-1 shrink-0" />

          {/* 副图指标切换按钮组 */}
          <div className="flex items-center bg-bg-elevated rounded p-0.5 space-x-0.5 border border-bg-border/60">
            {(['VOL', 'RSI', 'MACD'] as SubIndicatorType[]).map((sub) => (
              <button
                key={sub}
                onClick={() => setSubIndicator(sub)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                  subIndicator === sub
                    ? 'bg-blue-600/30 text-blue-400 font-bold border border-blue-500/40 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        {/* 右侧：刷新与全屏工具 */}
        <div className="flex items-center space-x-2 shrink-0">
          {loading && (
            <span className="flex items-center text-[10px] text-text-muted">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin text-trade-ai" />
              加载中...
            </span>
          )}

          <button
            onClick={() => loadKlines()}
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="刷新图表"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="自适应缩放"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. OHLCV 与副图指标实时数据悬浮条 */}
      {currentOhlc && (
        <div className="flex flex-wrap items-center justify-between px-3 py-1 bg-bg-primary/50 text-[11px] font-mono-num border-b border-bg-border/60 shrink-0">
          <div className="flex items-center space-x-3">
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
            {subIndicator === 'VOL' && (
              <span>
                <span className="text-text-muted">Vol: </span>
                <span className="text-text-secondary">{(currentOhlc.volume ?? 0).toLocaleString()}</span>
              </span>
            )}
            {subIndicator === 'RSI' && currentRsiVal !== null && (
              <span className="text-purple-400 font-semibold">
                <span className="text-text-muted">RSI(14): </span>
                {currentRsiVal.toFixed(1)}
              </span>
            )}
            {subIndicator === 'MACD' && currentMacdVal !== null && (
              <div className="flex items-center space-x-2">
                <span className="text-sky-400">DIF: {currentMacdVal.dif.toFixed(2)}</span>
                <span className="text-amber-400">DEA: {currentMacdVal.dea.toFixed(2)}</span>
                <span className={currentMacdVal.hist >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  MACD: {currentMacdVal.hist.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* EMA 图例 */}
          {showEma && (
            <div className="hidden md:flex items-center space-x-2 text-[10px]">
              <span className="flex items-center text-amber-400">
                <span className="w-2 h-0.5 bg-amber-400 mr-1" />
                EMA(20)
              </span>
              <span className="flex items-center text-sky-400">
                <span className="w-2 h-0.5 bg-sky-400 mr-1" />
                EMA(50)
              </span>
              <span className="flex items-center text-pink-400">
                <span className="w-2 h-0.5 bg-pink-400 mr-1" />
                EMA(200)
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3. 图表核心画布容器 */}
      <div className="relative flex-1 w-full min-h-[300px] bg-bg-secondary overflow-hidden">
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
};
