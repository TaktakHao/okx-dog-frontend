/**
 * @file AutoPilotCard.tsx
 * @description OKX-Dog 7x24h 后端常驻全自动量化操盘中枢与盈利全景监控看板
 * 极简金融极客暗黑终端设计，专为多标的组合与脱机常驻量化操盘打造
 * 包含：7x24h 后端守护状态、多标的轮巡池管理、移动保本 (Breakeven)、
 * 动态净收益与收益率大字看板、胜率/盈亏比指标、SVG 时序收益曲线、最新巡检事件与平仓流水
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  TrendingUp,
  Activity,
  Award,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Plus,
  X,
  Layers,
  Radio,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { autoPilotApi } from '../services/api';
import { AutoPilotHistoryPoint, AutoPilotTradeRecord } from '../types';
import { getBaseCurrency } from '../utils/symbolHelper';

export const AutoPilotCard: React.FC = () => {
  const {
    activeSymbol,
    balance,
    isLiveMode,
    riskStatus,
    autoPilotStatus,
    setAutoPilotStatus,
    autoPilotHistory,
    setAutoPilotHistory,
  } = useAppStore();

  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'logs'>('chart');

  // 配置项
  const [minConfidence, setMinConfidence] = useState<number>(0.70);
  const [autoLeverage, setAutoLeverage] = useState<boolean>(true);
  const [symbolsPool, setSymbolsPool] = useState<string[]>([
    'XAU-USDT-SWAP',
    'NVDA-USDT-SWAP',
    'TSLA-USDT-SWAP',
    'ONDO-USDT-SWAP',
    'BTC-USDT-SWAP',
    'ETH-USDT-SWAP',
  ]);
  const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<number>(3);
  const [trailingStopEnabled, setTrailingStopEnabled] = useState<boolean>(true);
  const [newSymbolInput, setNewSymbolInput] = useState<string>('');

  // 动态秒级运行时长
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // 1. 初始化拉取自动操盘状态与历史曲线
  useEffect(() => {
    let isMounted = true;
    const fetchStatusAndHistory = async () => {
      try {
        const [statusData, historyData] = await Promise.allSettled([
          autoPilotApi.getStatus(),
          autoPilotApi.getHistory(),
        ]);
        if (!isMounted) return;

        if (statusData.status === 'fulfilled' && statusData.value) {
          setAutoPilotStatus(statusData.value);
          setIsRunning(statusData.value.is_running);
          setMinConfidence(statusData.value.min_confidence || 0.70);
          setAutoLeverage(statusData.value.auto_leverage_enabled ?? true);
          if (statusData.value.symbols && statusData.value.symbols.length > 0) {
            setSymbolsPool(statusData.value.symbols);
          }
          if (statusData.value.max_concurrent_positions) {
            setMaxConcurrentPositions(statusData.value.max_concurrent_positions);
          }
          if (statusData.value.trailing_stop_enabled !== undefined) {
            setTrailingStopEnabled(statusData.value.trailing_stop_enabled);
          }
        }
        if (historyData.status === 'fulfilled' && historyData.value) {
          setAutoPilotHistory(historyData.value);
        }
      } catch (err) {
        console.warn('拉取自动操盘数据异常:', err);
      }
    };

    fetchStatusAndHistory();

    // 每 4 秒轮询一次最新盈利与曲线
    const interval = setInterval(fetchStatusAndHistory, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [setAutoPilotStatus, setAutoPilotHistory]);

  // 2. 动态计时器：更新累计运行时长
  useEffect(() => {
    if (!autoPilotStatus?.start_time || !isRunning) {
      if (autoPilotStatus?.running_seconds) {
        setElapsedSeconds(autoPilotStatus.running_seconds);
      }
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - (autoPilotStatus.start_time || now)) / 1000));
      setElapsedSeconds(diff);
    }, 1000);

    return () => clearInterval(timer);
  }, [autoPilotStatus?.start_time, isRunning, autoPilotStatus?.running_seconds]);

  // 格式化秒数为 时:分:秒
  const formatElapsedTime = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hours > 0) {
      return `${hours}时 ${mins.toString().padStart(2, '0')}分 ${secs.toString().padStart(2, '0')}秒`;
    }
    return `${mins}分 ${secs.toString().padStart(2, '0')}秒`;
  };

  // 切换开启 / 暂停自动操盘
  const handleToggleAutoPilot = async () => {
    setLoading(true);
    try {
      if (isRunning) {
        const res = await autoPilotApi.stop();
        setIsRunning(false);
        setAutoPilotStatus(res);
      } else {
        const res = await autoPilotApi.start({
          min_confidence: minConfidence,
          auto_leverage_enabled: autoLeverage,
          symbol: activeSymbol,
          symbols: symbolsPool,
          max_concurrent_positions: maxConcurrentPositions,
          trailing_stop_enabled: trailingStopEnabled,
        });
        setIsRunning(true);
        setAutoPilotStatus(res);
        const hist = await autoPilotApi.getHistory();
        setAutoPilotHistory(hist);
      }
    } catch (err) {
      console.warn('切换自动操盘状态异常:', err);
    } finally {
      setLoading(false);
    }
  };

  // 重置基准统计
  const handleResetStats = async () => {
    setLoading(true);
    setIsResetConfirmOpen(false);
    try {
      const res = await autoPilotApi.resetStats();
      setAutoPilotStatus(res);
      setIsRunning(true);
      const hist = await autoPilotApi.getHistory();
      setAutoPilotHistory(hist);
    } catch (err) {
      console.warn('重置自动操盘统计异常:', err);
    } finally {
      setLoading(false);
    }
  };

  // 保存策略配置
  const handleSaveConfig = async () => {
    try {
      const res = await autoPilotApi.updateConfig({
        min_confidence: minConfidence,
        auto_leverage_enabled: autoLeverage,
        symbols: symbolsPool,
        max_concurrent_positions: maxConcurrentPositions,
        trailing_stop_enabled: trailingStopEnabled,
      });
      setAutoPilotStatus(res);
      setIsConfigOpen(false);
    } catch (err) {
      console.warn('保存自动操盘配置异常:', err);
    }
  };

  // 标的池增删
  const handleAddSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    const formatted = s.endsWith('-USDT-SWAP') ? s : `${s.replace('-USDT', '')}-USDT-SWAP`;
    if (!symbolsPool.includes(formatted)) {
      setSymbolsPool([...symbolsPool, formatted]);
    }
    setNewSymbolInput('');
  };

  const handleRemoveSymbol = (sym: string) => {
    setSymbolsPool(symbolsPool.filter((s) => s !== sym));
  };

  // 计算显示指标
  const totalEquity = balance?.total_equity_usdt ?? (isLiveMode ? 0 : 10000);
  const startEquity = autoPilotStatus?.start_equity_usdt ?? 10000;
  const currentEquity = autoPilotStatus?.current_equity_usdt ?? totalEquity;

  const totalPnl = currentEquity - startEquity;
  const totalPnlRatio = startEquity > 0 ? (totalPnl / startEquity) * 100 : 0;
  const isProfitPositive = totalPnl >= 0;

  const realizedPnl = autoPilotStatus?.realized_pnl_usdt ?? 0;
  const unrealizedPnl = balance?.unrealized_pnl_usdt ?? (autoPilotStatus?.unrealized_pnl_usdt ?? 0);
  const winRate = (autoPilotStatus?.win_rate ?? 0) * 100;
  const totalTrades = autoPilotStatus?.total_trades_count ?? 0;
  const winTrades = autoPilotStatus?.winning_trades_count ?? 0;
  const lossTrades = autoPilotStatus?.losing_trades_count ?? 0;
  const profitFactor = autoPilotStatus?.profit_factor ?? (winTrades > 0 ? 2.5 : 0);
  const maxDrawdown = autoPilotStatus?.max_drawdown_pct ?? 0;

  // 渲染时序收益曲线 (SVG 平滑曲线绘制)
  const curvePoints = autoPilotHistory?.curve || [];
  const svgChart = useMemo(() => {
    if (curvePoints.length < 2) {
      return null;
    }
    const width = 280;
    const height = 70;
    const padding = 6;

    const values = curvePoints.map((p: AutoPilotHistoryPoint) => p.total_pnl);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const points = curvePoints.map((p: AutoPilotHistoryPoint, i: number) => {
      const x = padding + (i / (curvePoints.length - 1)) * (width - padding * 2);
      const y = height - padding - ((p.total_pnl - minVal) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const linePath = `M ${points.join(' L ')}`;
    const areaPath = `M ${points[0]} L ${points.join(' L ')} L ${width - padding},${height} L ${padding},${height} Z`;

    const isCurrentProfit = values[values.length - 1] >= 0;
    const strokeColor = isCurrentProfit ? '#00C087' : '#FF3B69';
    const fillColor = isCurrentProfit ? 'rgba(0, 192, 135, 0.15)' : 'rgba(255, 59, 105, 0.15)';

    return {
      linePath,
      areaPath,
      strokeColor,
      fillColor,
      lastPoint: points[points.length - 1].split(','),
      minVal,
      maxVal,
    };
  }, [curvePoints]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-bg-border bg-bg-secondary p-3 space-y-2.5 overflow-y-auto select-none">

      {/* 1. 顶部 7x24h 脱机常驻操盘总控胶囊 */}
      <div className="flex items-center justify-between pb-2 border-b border-bg-border">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg border ${
            isRunning
              ? 'bg-trade-up/15 border-trade-up/30 text-trade-up'
              : 'bg-bg-elevated border-bg-border text-text-muted'
          }`}>
            <Bot className={`w-4 h-4 ${isRunning ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-text-primary">7x24h 脱机量化操盘</span>
              <span className={`flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-medium ${
                isRunning ? 'bg-trade-up/20 text-trade-up' : 'bg-bg-elevated text-text-muted'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isRunning ? 'bg-trade-up animate-ping' : 'bg-text-muted'}`} />
                {isRunning ? '守护运行中' : '已暂停'}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[10px] text-text-muted font-mono-num mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              <span>脱机运行时长: {formatElapsedTime(elapsedSeconds)}</span>
            </div>
          </div>
        </div>

        {/* 右侧控制按钮组 */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className="p-1.5 rounded-lg bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="策略与监控池设置"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="p-1.5 rounded-lg bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-amber-400 transition-colors cursor-pointer"
            title="重置收益统计基准"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleToggleAutoPilot}
            disabled={loading || riskStatus === 'PANIC_LOCKED'}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer ${
              isRunning
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40'
                : 'bg-trade-up hover:bg-emerald-400 text-white shadow-emerald-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3 h-3" />
                <span>暂停</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>启动操盘</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. 多标的轮巡池与移动保本状态指示条 */}
      <div className="p-2 rounded-lg bg-bg-elevated/60 border border-bg-border space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-[11px] text-text-muted font-medium">
          <span className="flex items-center space-x-1 text-trade-ai">
            <Layers className="w-3.5 h-3.5" />
            <span>自动监控池 ({symbolsPool.length} 个标的, 限持 {maxConcurrentPositions} 仓)</span>
          </span>
          <span className="flex items-center space-x-1 text-emerald-400 text-[10px] font-mono">
            <ShieldCheck className="w-3 h-3" />
            <span>{trailingStopEnabled ? '移动保本开启' : '固定止损'}</span>
          </span>
        </div>

        {/* 标的标签列表 */}
        <div className="flex flex-wrap gap-1">
          {symbolsPool.map((sym) => (
            <span
              key={sym}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 border ${
                sym === activeSymbol
                  ? 'bg-trade-ai/20 text-trade-ai border-trade-ai/40 font-bold'
                  : 'bg-bg-secondary text-text-secondary border-bg-border'
              }`}
            >
              <span>{getBaseCurrency(sym)}</span>
              {sym.includes('XAU') || sym.includes('NVDA') || sym.includes('TSLA') ? (
                <span className="text-[8px] px-0.5 rounded bg-amber-500/20 text-amber-300 font-sans">TradFi</span>
              ) : null}
            </span>
          ))}
        </div>

        {/* 后端最近巡检日志 */}
        {autoPilotStatus?.last_patrol_log && (
          <div className="flex items-center space-x-1.5 text-[10px] text-text-muted font-mono pt-1 border-t border-bg-border/40">
            <Radio className="w-3 h-3 text-emerald-400 shrink-0 animate-pulse" />
            <span className="truncate" title={autoPilotStatus.last_patrol_log}>
              {autoPilotStatus.last_patrol_log}
            </span>
          </div>
        )}
      </div>

      {/* 3. 开启以来收益核心大看板 (Auto-Pilot Profit Hero) */}
      <div className="rounded-lg bg-bg-elevated/70 border border-bg-border p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>开启以来累计净盈利 (PnL)</span>
          <span className="font-mono text-[10px]">基准: ${startEquity.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className={`text-2xl font-bold font-mono-num tracking-tight ${
            isProfitPositive ? 'text-trade-up' : 'text-trade-down'
          }`}>
            {isProfitPositive ? '+' : ''}${totalPnl.toFixed(2)}
          </span>
          <span className={`text-sm font-bold font-mono-num ${
            isProfitPositive ? 'text-trade-up' : 'text-trade-down'
          }`}>
            ({isProfitPositive ? '+' : ''}{totalPnlRatio.toFixed(2)}%)
          </span>
        </div>

        {/* 浮动盈亏与已实现盈亏细分 */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-bg-border/50 text-[11px] font-mono-num">
          <div>
            <span className="text-text-muted text-[10px] block">已实现盈亏:</span>
            <span className={`font-semibold ${realizedPnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
              {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-text-muted text-[10px] block">持仓浮动盈亏:</span>
            <span className={`font-semibold ${unrealizedPnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. 关键量化战绩指标四宫格 */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* 胜率 */}
        <div className="p-2 rounded-lg bg-bg-elevated/50 border border-bg-border/60">
          <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>胜率 (Win Rate)</span>
            <Award className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-base font-bold font-mono-num text-text-primary mt-0.5">
            {totalTrades > 0 ? `${winRate.toFixed(1)}%` : '--'}
          </div>
          <div className="text-[10px] text-text-muted font-mono-num">
            {winTrades}胜 / {lossTrades}负 (共{totalTrades}单)
          </div>
        </div>

        {/* 收益因子 */}
        <div className="p-2 rounded-lg bg-bg-elevated/50 border border-bg-border/60">
          <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>收益因子 (PF)</span>
            <TrendingUp className="w-3 h-3 text-trade-ai" />
          </div>
          <div className="text-base font-bold font-mono-num text-text-primary mt-0.5">
            {profitFactor > 0 ? profitFactor.toFixed(2) : '--'}
          </div>
          <div className="text-[10px] text-text-muted font-mono-num">
            最大回撤: {maxDrawdown.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 5. 收益走势折线图 / 自动交易流水 Tab 区域 */}
      <div className="flex-1 flex flex-col min-h-[140px] rounded-lg bg-bg-elevated/40 border border-bg-border overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1 border-b border-bg-border/60 bg-bg-secondary/80">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('chart')}
              className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
                activeTab === 'chart' ? 'bg-bg-elevated text-trade-ai font-bold' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              时序收益曲线
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
                activeTab === 'logs' ? 'bg-bg-elevated text-trade-ai font-bold' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              自动平仓流水 ({autoPilotHistory?.trades?.length || 0})
            </button>
          </div>
          <span className="text-[10px] text-text-muted font-mono">
            {activeTab === 'chart' ? '5s 实时采样' : '最新战绩'}
          </span>
        </div>

        <div className="flex-1 p-2 overflow-y-auto">
          {activeTab === 'chart' ? (
            <div className="h-full flex flex-col justify-between">
              {svgChart ? (
                <div className="w-full flex-1 flex items-center justify-center relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 280 70" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="pnlGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={svgChart.strokeColor} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={svgChart.strokeColor} stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* 0轴基准线 */}
                    <line x1="6" y1="35" x2="274" y2="35" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
                    {/* 渐变填充 */}
                    <path d={svgChart.areaPath} fill="url(#pnlGrad)" />
                    {/* 曲线 */}
                    <path d={svgChart.linePath} fill="none" stroke={svgChart.strokeColor} strokeWidth="2" strokeLinecap="round" />
                    {/* 最新采样点光晕 */}
                    <circle cx={svgChart.lastPoint[0]} cy={svgChart.lastPoint[1]} r="3" fill={svgChart.strokeColor} className="animate-ping opacity-75" />
                    <circle cx={svgChart.lastPoint[0]} cy={svgChart.lastPoint[1]} r="3" fill="#fff" />
                  </svg>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-text-muted text-[11px] space-y-1">
                  <Activity className="w-5 h-5 text-trade-ai/40 animate-pulse" />
                  <span>7x24h 操盘中枢常驻运行中，正在采集收益走势...</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] text-text-muted font-mono pt-1 border-t border-bg-border/30">
                <span>开启基准点</span>
                <span className={isProfitPositive ? 'text-trade-up font-bold' : 'text-trade-down font-bold'}>
                  当前: {isProfitPositive ? '+' : ''}${totalPnl.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {autoPilotHistory?.trades && autoPilotHistory.trades.length > 0 ? (
                autoPilotHistory.trades.slice(0, 10).map((t: AutoPilotTradeRecord, idx: number) => (
                  <div
                    key={t.id || idx}
                    className="p-1.5 rounded bg-bg-secondary border border-bg-border/50 flex items-center justify-between text-[11px] font-mono-num"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                        t.pos_side === 'long' ? 'bg-trade-up/20 text-trade-up' : 'bg-trade-down/20 text-trade-down'
                      }`}>
                        {t.pos_side === 'long' ? '多' : '空'} {t.leverage}x
                      </span>
                      <div className="text-text-primary text-[10px]">
                        <span className="font-bold mr-1">{getBaseCurrency(t.symbol)}</span>
                        ${t.entry_price} → ${t.exit_price}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${t.realized_pnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                        {t.realized_pnl >= 0 ? '+' : ''}${t.realized_pnl.toFixed(2)} ({t.roi_pct >= 0 ? '+' : ''}{t.roi_pct.toFixed(1)}%)
                      </div>
                      <div className="text-[9px] text-text-muted truncate max-w-[110px]" title={t.reason}>
                        {t.reason}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-text-muted text-[11px]">
                  暂无自动平仓战绩，后端常驻协程正在 7x24h 轮巡监控池
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. 策略参数与监控池设置弹窗 */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-md rounded-xl border border-bg-border bg-bg-secondary p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bg-border pb-2">
              <div className="flex items-center space-x-2 text-text-primary font-bold text-sm">
                <Sliders className="w-4 h-4 text-trade-ai" />
                <span>7x24h 自动操盘引擎参数配置</span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="text-text-muted hover:text-text-primary text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* 多标的轮巡池配置 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="font-medium">自动监控轮巡标的池 ({symbolsPool.length} 个)</span>
                  <button
                    type="button"
                    onClick={() => handleAddSymbol(activeSymbol)}
                    className="text-[11px] text-trade-ai hover:underline flex items-center space-x-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加当前标的 ({getBaseCurrency(activeSymbol)})</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-bg-primary border border-bg-border min-h-[50px]">
                  {symbolsPool.map((sym) => (
                    <span
                      key={sym}
                      className="px-2 py-0.5 rounded bg-bg-elevated border border-bg-border text-text-primary text-[11px] font-mono flex items-center space-x-1"
                    >
                      <span>{getBaseCurrency(sym)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSymbol(sym)}
                        className="text-text-muted hover:text-trade-down cursor-pointer ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* 快速添加输入框 */}
                <div className="flex space-x-1.5">
                  <input
                    type="text"
                    placeholder="输入标的代码 (如 XAG, AAPL, SOL)"
                    value={newSymbolInput}
                    onChange={(e) => setNewSymbolInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSymbol(newSymbolInput);
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-bg-primary border border-bg-border text-text-primary text-xs font-mono uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSymbol(newSymbolInput)}
                    className="px-3 py-1.5 rounded-lg bg-bg-elevated hover:bg-bg-border text-text-primary text-xs font-medium cursor-pointer"
                  >
                    添加
                  </button>
                </div>
              </div>

              {/* 最大同时持仓数 */}
              <div className="space-y-1.5 pt-2 border-t border-bg-border/60">
                <div className="flex justify-between text-text-secondary">
                  <span>最大并发持仓数量 (Max Concurrent Positions)</span>
                  <span className="text-trade-ai font-bold font-mono">{maxConcurrentPositions} 仓</span>
                </div>
                <div className="flex space-x-2">
                  {[1, 2, 3, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxConcurrentPositions(num)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-bold border transition-colors cursor-pointer ${
                        maxConcurrentPositions === num
                          ? 'bg-trade-ai text-white border-trade-ai'
                          : 'bg-bg-primary text-text-muted border-bg-border hover:text-text-primary'
                      }`}
                    >
                      {num} 仓
                    </button>
                  ))}
                </div>
              </div>

              {/* 移动保本设置 */}
              <div className="flex items-center justify-between pt-2 border-t border-bg-border/60">
                <div>
                  <span className="text-text-primary font-medium block">动态移动保本 (Breakeven Locked)</span>
                  <span className="text-[10px] text-text-muted">浮盈达到 0.8% 时自动上移止损线至开仓保本价</span>
                </div>
                <input
                  type="checkbox"
                  checked={trailingStopEnabled}
                  onChange={(e) => setTrailingStopEnabled(e.target.checked)}
                  className="w-4 h-4 accent-trade-ai cursor-pointer"
                />
              </div>

              {/* 置信度门槛 */}
              <div className="space-y-1.5 pt-2 border-t border-bg-border/60">
                <div className="flex justify-between text-text-secondary">
                  <span>AI 自动开仓最低置信度门槛</span>
                  <span className="text-trade-ai font-bold font-mono">≥ {(minConfidence * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.60"
                  max="0.90"
                  step="0.05"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  className="w-full accent-trade-ai cursor-pointer"
                />
              </div>

              {/* 自适应智能杠杆 */}
              <div className="flex items-center justify-between pt-2 border-t border-bg-border/60">
                <div>
                  <span className="text-text-primary font-medium block">自适应智能杠杆 (1~5x)</span>
                  <span className="text-[10px] text-text-muted">跟随 AI 建议并在硬风控限额内动态调节</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoLeverage}
                  onChange={(e) => setAutoLeverage(e.target.checked)}
                  className="w-4 h-4 accent-trade-ai cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-bg-border/60">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-bg-elevated hover:bg-bg-border text-text-secondary text-xs cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-4 py-1.5 rounded-lg bg-trade-ai hover:bg-purple-600 text-white font-bold text-xs cursor-pointer shadow-md"
              >
                保存配置并应用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. 重置统计确认弹窗 */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-xs rounded-xl border border-amber-500/40 bg-bg-secondary p-5 shadow-2xl space-y-3">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>重置收益统计基准</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              确定要重置自动操盘统计吗？系统将以当前资金 (${totalEquity.toFixed(2)} USDT) 重新作为基准起跑线，重置累计盈亏与胜率。
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-bg-elevated hover:bg-bg-border text-text-secondary text-xs cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleResetStats}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

