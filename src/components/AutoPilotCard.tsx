/**
 * @file AutoPilotCard.tsx
 * @description OKX-Dog Stage 3A 冻结参数双引擎影子盘 / 自动操盘核心控制面板
 * 极简金融级暗黑终端设计：聚焦 60% 主引擎 B (4H凯尔特纳 + 1D双均线) + 30% 底座引擎 A (期现费率套利) + 10% USDT 安全缓冲
 */

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  TrendingUp,
  Award,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Plus,
  X,
  Radio,
  Sparkles,
  CheckCircle2,
  Zap,
  Search,
  BarChart3,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { autoPilotApi, marketApi, paperApi, tradeApi } from '../services/api';
import { AutoPilotTradeRecord, InstrumentInfo } from '../types';
import { getBaseCurrency } from '../utils/symbolHelper';

const CORE_TOP5_UNIVERSE = [
  'BTC-USDT-SWAP',
  'ETH-USDT-SWAP',
  'SOL-USDT-SWAP',
  'BNB-USDT-SWAP',
  'DOGE-USDT-SWAP',
];

interface AutoPilotCardProps {
  onOpenDualEngine?: () => void;
}

export const AutoPilotCard: React.FC<AutoPilotCardProps> = ({ onOpenDualEngine }) => {
  const {
    activeSymbol,
    setActiveSymbol,
    balance,
    setBalance,
    setPositions,
    isLiveMode,
    riskStatus,
    focusSymbols,
    setFocusMode,
    setFocusSymbols,
    autoPilotStatus,
    setAutoPilotStatus,
    autoPilotHistory,
    setAutoPilotHistory,
  } = useAppStore();

  const [isRunning, setIsRunning] = useState<boolean>(autoPilotStatus?.is_running ?? false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // 双引擎精简可控配置项 (核心策略参数已按 Gate 2 验真基线冻结)
  const [symbolsPool, setSymbolsPool] = useState<string[]>(
    focusSymbols.length > 0 ? focusSymbols : CORE_TOP5_UNIVERSE
  );
  const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<number>(5);
  const [stopLossEquityFloor, setStopLossEquityFloor] = useState<number | ''>('');
  const [maxLossLimitUsdt, setMaxLossLimitUsdt] = useState<number | ''>('');
  const [newSymbolInput, setNewSymbolInput] = useState<string>('');

  // 欧易官方真实合约检索联想
  const [symbolSuggestions, setSymbolSuggestions] = useState<InstrumentInfo[]>([]);
  const [isSearchingSymbol, setIsSearchingSymbol] = useState<boolean>(false);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState<boolean>(false);
  const [symbolSearchError, setSymbolSearchError] = useState<string | null>(null);

  // 运行时长秒表
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const isConfigOpenRef = React.useRef(isConfigOpen);
  isConfigOpenRef.current = isConfigOpen;
  const isInitialLoadedRef = React.useRef(false);

  // 合约检索防抖
  useEffect(() => {
    const q = newSymbolInput.trim();
    if (!q) {
      setSymbolSuggestions([]);
      setShowSymbolDropdown(false);
      setSymbolSearchError(null);
      return;
    }

    let isMounted = true;
    setIsSearchingSymbol(true);
    setSymbolSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await marketApi.searchInstruments(q, 'SWAP', 'CRYPTO', 8);
        if (isMounted) {
          if (res?.instruments && res.instruments.length > 0) {
            setSymbolSuggestions(res.instruments);
            setShowSymbolDropdown(true);
            setSymbolSearchError(null);
          } else {
            setSymbolSuggestions([]);
            setShowSymbolDropdown(true);
            setSymbolSearchError(`未找到与 "${q.toUpperCase()}" 匹配的加密永续合约`);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('检索合约失败:', err);
          setSymbolSuggestions([]);
        }
      } finally {
        if (isMounted) setIsSearchingSymbol(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [newSymbolInput]);

  // 轮询自动操盘状态与流水
  const refreshAll = async () => {
    try {
      const [statusData, historyData] = await Promise.allSettled([
        autoPilotApi.getStatus(),
        autoPilotApi.getHistory(),
      ]);

      if (statusData.status === 'fulfilled' && statusData.value) {
        const st = statusData.value;
        setAutoPilotStatus(st);
        setIsRunning(st.is_running);

        if (!isInitialLoadedRef.current || !isConfigOpenRef.current) {
          if (st.focus_symbols && st.focus_symbols.length > 0) {
            setSymbolsPool(st.focus_symbols);
          }
          if (st.max_concurrent_positions) {
            setMaxConcurrentPositions(st.max_concurrent_positions);
          }
          if (st.stop_loss_equity_floor !== undefined && st.stop_loss_equity_floor !== null) {
            setStopLossEquityFloor(st.stop_loss_equity_floor);
          } else {
            setStopLossEquityFloor('');
          }
          if (st.max_loss_limit_usdt !== undefined && st.max_loss_limit_usdt !== null) {
            setMaxLossLimitUsdt(st.max_loss_limit_usdt);
          } else {
            setMaxLossLimitUsdt('');
          }
          isInitialLoadedRef.current = true;
        }
      }
      if (historyData.status === 'fulfilled' && historyData.value) {
        setAutoPilotHistory(historyData.value);
      }
    } catch (err) {
      console.warn('拉取自动操盘数据异常:', err);
    }
  };

  useEffect(() => {
    isInitialLoadedRef.current = false;
    refreshAll();
    const interval = setInterval(refreshAll, 4000);
    return () => clearInterval(interval);
  }, [isLiveMode]);

  useEffect(() => {
    if (autoPilotStatus && autoPilotStatus.is_running !== undefined) {
      setIsRunning(autoPilotStatus.is_running);
    }
  }, [autoPilotStatus?.is_running]);

  useEffect(() => {
    if (!autoPilotStatus?.start_time || !isRunning) {
      if (autoPilotStatus?.running_seconds) {
        setElapsedSeconds(autoPilotStatus.running_seconds);
      }
      return;
    }
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - (autoPilotStatus.start_time || now)) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [autoPilotStatus?.start_time, isRunning, autoPilotStatus?.running_seconds]);

  const formatElapsedTime = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hours > 0) {
      return `${hours}时 ${mins.toString().padStart(2, '0')}分 ${secs.toString().padStart(2, '0')}秒`;
    }
    return `${mins}分 ${secs.toString().padStart(2, '0')}秒`;
  };

  // 启动 / 暂停双引擎操盘
  const handleToggleAutoPilot = async () => {
    setLoading(true);
    setActionNotice(null);
    try {
      if (isRunning) {
        const res = await autoPilotApi.stop();
        setIsRunning(false);
        setAutoPilotStatus(res);
      } else {
        const targetPool = symbolsPool.length > 0 ? symbolsPool : CORE_TOP5_UNIVERSE;
        const parsedFloor =
          typeof stopLossEquityFloor === 'number' && stopLossEquityFloor > 0 && stopLossEquityFloor < currentEquity
            ? stopLossEquityFloor
            : undefined;
        const res = await autoPilotApi.start({
          aggressiveness_mode: 'BALANCED',
          min_confidence: 0.75,
          auto_leverage_enabled: false,
          symbol: activeSymbol,
          symbols: targetPool,
          focus_symbols: targetPool,
          focus_mode: 'MULTI_SYMBOL_POOL',
          max_scale_layers: 1,
          scale_in_strategy: 'PYRAMIDING',
          auto_reversal_enabled: false,
          max_concurrent_positions: maxConcurrentPositions,
          trailing_stop_enabled: true,
          stop_loss_equity_floor: parsedFloor,
        });
        setIsRunning(res.is_running);
        setAutoPilotStatus(res);
        setFocusMode('MULTI_SYMBOL_POOL');
        setFocusSymbols(targetPool);
        const hist = await autoPilotApi.getHistory();
        setAutoPilotHistory(hist);
      }
    } catch (err) {
      console.warn('切换自动操盘状态异常:', err);
      setActionNotice('切换运行状态失败，请检查后端服务连接');
    } finally {
      setLoading(false);
    }
  };

  // 一键启动 Gate 2 冻结 Top 5 双引擎影子盘
  const handleOneClickOptimalStart = async () => {
    setLoading(true);
    setActionNotice(null);
    try {
      setSymbolsPool(CORE_TOP5_UNIVERSE);
      setMaxConcurrentPositions(5);
      setFocusMode('MULTI_SYMBOL_POOL');
      setFocusSymbols(CORE_TOP5_UNIVERSE);

      // 直接携带完整冻结配置启动，由后端按当前净值自动计算 18% 安全底线，避免旧高点底线秒停
      const startRes = await autoPilotApi.start({
        aggressiveness_mode: 'BALANCED',
        min_confidence: 0.75,
        auto_leverage_enabled: false,
        symbol: 'BTC-USDT-SWAP',
        symbols: CORE_TOP5_UNIVERSE,
        focus_symbols: CORE_TOP5_UNIVERSE,
        focus_mode: 'MULTI_SYMBOL_POOL',
        max_scale_layers: 1,
        scale_in_strategy: 'PYRAMIDING',
        auto_reversal_enabled: false,
        max_concurrent_positions: 5,
        trailing_stop_enabled: true,
      });
      setAutoPilotStatus(startRes);
      setIsRunning(startRes.is_running);
      const hist = await autoPilotApi.getHistory();
      setAutoPilotHistory(hist);
    } catch (err) {
      console.warn('一键开启双引擎影子盘异常:', err);
      setActionNotice('启动失败，请确认后端服务已重启');
    } finally {
      setLoading(false);
    }
  };

  // 一键重置模拟盘为 $10,000 干净基线并启动双引擎影子盘
  const handleCleanResetAndStart = async () => {
    setLoading(true);
    setActionNotice(null);
    try {
      await paperApi.resetAccount(10000);
      const [bal, pos] = await Promise.allSettled([
        tradeApi.getAccountBalance(),
        tradeApi.getPositions(),
      ]);
      if (bal.status === 'fulfilled' && bal.value) setBalance(bal.value);
      if (pos.status === 'fulfilled') setPositions(Array.isArray(pos.value) ? pos.value : []);

      setSymbolsPool(CORE_TOP5_UNIVERSE);
      setMaxConcurrentPositions(5);
      setFocusMode('MULTI_SYMBOL_POOL');
      setFocusSymbols(CORE_TOP5_UNIVERSE);

      const startRes = await autoPilotApi.start({
        aggressiveness_mode: 'BALANCED',
        min_confidence: 0.75,
        auto_leverage_enabled: false,
        symbol: 'BTC-USDT-SWAP',
        symbols: CORE_TOP5_UNIVERSE,
        focus_symbols: CORE_TOP5_UNIVERSE,
        focus_mode: 'MULTI_SYMBOL_POOL',
        max_scale_layers: 1,
        scale_in_strategy: 'PYRAMIDING',
        auto_reversal_enabled: false,
        max_concurrent_positions: 5,
        trailing_stop_enabled: true,
        stop_loss_equity_floor: 8200,
      });
      setAutoPilotStatus(startRes);
      setIsRunning(startRes.is_running);
      const hist = await autoPilotApi.getHistory();
      setAutoPilotHistory(hist);
      setActionNotice('已重置为 $10,000 干净基线并启动 Top 5 双引擎影子盘');
    } catch (err) {
      console.warn('重置并启动影子盘异常:', err);
      setActionNotice('重置或启动异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 重置统计基准
  const handleResetStats = async () => {
    setLoading(true);
    setIsResetConfirmOpen(false);
    try {
      const res = await autoPilotApi.resetStats();
      setAutoPilotStatus(res);
      setIsRunning(res.is_running);
      const hist = await autoPilotApi.getHistory();
      setAutoPilotHistory(hist);
    } catch (err) {
      console.warn('重置自动操盘统计异常:', err);
    } finally {
      setLoading(false);
    }
  };

  // 保存精简配置
  const handleSaveConfig = async () => {
    try {
      const targetPool = symbolsPool.length > 0 ? symbolsPool : CORE_TOP5_UNIVERSE;
      const parsedFloor =
        typeof stopLossEquityFloor === 'number' && stopLossEquityFloor > 0
          ? stopLossEquityFloor
          : undefined;
      const parsedMaxLoss =
        typeof maxLossLimitUsdt === 'number' && maxLossLimitUsdt > 0
          ? maxLossLimitUsdt
          : undefined;
      const res = await autoPilotApi.updateConfig({
        symbol: activeSymbol,
        symbols: targetPool,
        focus_symbols: targetPool,
        focus_mode: 'MULTI_SYMBOL_POOL',
        max_concurrent_positions: maxConcurrentPositions,
        trailing_stop_enabled: true,
        stop_loss_equity_floor: parsedFloor,
        max_loss_limit_usdt: parsedMaxLoss,
      });
      setAutoPilotStatus(res);
      setFocusMode('MULTI_SYMBOL_POOL');
      setFocusSymbols(targetPool);
      setIsConfigOpen(false);
    } catch (err) {
      console.warn('保存配置异常:', err);
    }
  };

  const handleAddSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s || symbolsPool.includes(s)) {
      setNewSymbolInput('');
      setShowSymbolDropdown(false);
      return;
    }
    const next = [...symbolsPool, s];
    setSymbolsPool(next);
    setFocusSymbols(next);
    setNewSymbolInput('');
    setShowSymbolDropdown(false);
    marketApi.subscribeFocus([s]).catch(() => {});
  };

  const handleRemoveSymbol = (sym: string) => {
    if (symbolsPool.length <= 1) return;
    const next = symbolsPool.filter((s) => s !== sym);
    setSymbolsPool(next);
    setFocusSymbols(next);
  };

  // 指标计算
  const totalEquity = balance?.total_equity_usdt ?? (isLiveMode ? 0 : 10000);
  const startEquity = autoPilotStatus?.start_equity_usdt ?? 10000;
  const currentEquity = autoPilotStatus?.current_equity_usdt ?? totalEquity;
  const totalPnl = autoPilotStatus?.total_pnl_usdt ?? (currentEquity - startEquity);
  const totalPnlRatio = (autoPilotStatus?.total_pnl_ratio ?? (startEquity > 0 ? totalPnl / startEquity : 0)) * 100;
  const realizedPnl = autoPilotStatus?.realized_pnl_usdt ?? 0;
  const unrealizedPnl = autoPilotStatus?.unrealized_pnl_usdt ?? (balance?.unrealized_pnl_usdt ?? 0);
  const winRate = (autoPilotStatus?.win_rate ?? 0) * 100;
  const totalTrades = autoPilotStatus?.total_trades_count ?? 0;
  const winTrades = autoPilotStatus?.winning_trades_count ?? 0;
  const lossTrades = autoPilotStatus?.losing_trades_count ?? 0;
  const profitFactor = autoPilotStatus?.profit_factor ?? 0;
  const maxDrawdown = autoPilotStatus?.max_drawdown_pct ?? 0;
  const isProfitPositive = totalPnl >= 0;

  // 检测是否仍残留改造前旧模拟盘大额亏损 (便于一键清空开启干净 Stage 3A 追踪)
  const hasLegacyPaperLoss =
    !isLiveMode && (currentEquity < 8500 || (totalTrades >= 20 && totalPnl < -1000));

  const handleFloorChange = (valStr: string) => {
    if (valStr === '') {
      setStopLossEquityFloor('');
      setMaxLossLimitUsdt('');
      return;
    }
    const val = parseFloat(valStr);
    if (!isNaN(val)) {
      setStopLossEquityFloor(val);
      setMaxLossLimitUsdt(Number(Math.max(0, currentEquity - val).toFixed(2)));
    }
  };

  const handleMaxLossChange = (valStr: string) => {
    if (valStr === '') {
      setMaxLossLimitUsdt('');
      setStopLossEquityFloor('');
      return;
    }
    const val = parseFloat(valStr);
    if (!isNaN(val)) {
      setMaxLossLimitUsdt(val);
      setStopLossEquityFloor(Number(Math.max(0, currentEquity - val).toFixed(2)));
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-bg-border bg-bg-secondary p-3 space-y-2.5 overflow-y-auto">
      {/* 1. 顶部主控标题栏 */}
      <div className="flex items-center justify-between border-b border-bg-border pb-2">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg border ${
            isRunning
              ? 'bg-trade-up/15 text-trade-up border-trade-up/30 animate-pulse'
              : 'bg-trade-ai/15 text-trade-ai border-trade-ai/30'
          }`}>
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h2 className="text-xs font-bold text-text-primary">
                {isLiveMode ? '实盘双引擎自动操盘' : '双引擎影子盘中枢'}
              </h2>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                isLiveMode
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              }`}>
                {isLiveMode ? 'LIVE' : 'SHADOW'}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[10px] text-text-muted font-mono">
              <Clock className="w-2.5 h-2.5" />
              <span>{isRunning ? `已连续运行: ${formatElapsedTime(elapsedSeconds)}` : '参数已冻结 · 等待启动'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className="p-1.5 rounded-lg bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="监控标的池与本金底线设置"
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
            disabled={loading || riskStatus === 'PANIC_LOCKED' || riskStatus === 'CIRCUIT_BROKEN'}
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
                <span>启动</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1.5 旧模拟盘历史亏损防呆提示卡 (一键归零重开 $10,000 干净影子盘) */}
      {hasLegacyPaperLoss && (
        <div className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-500/40 space-y-2">
          <div className="flex items-start space-x-2 text-[11px] text-amber-200 leading-snug">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">检测到旧版模拟盘遗留余额 (${currentEquity.toFixed(0)})</span>
              <p className="text-[10px] text-amber-200/80 mt-0.5">
                历史旧策略亏损拉低了净值，建议一键清零重置为干净 $10,000 基线（18% 停机底线 $8,200），正式开启 Stage 3A 影子盘实况记录。
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={handleCleanResetAndStart}
            className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition cursor-pointer shadow-sm"
          >
            ✨ 重置为 $10,000 干净基线并立即启动双引擎
          </button>
        </div>
      )}

      {actionNotice && (
        <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 flex items-center justify-between">
          <span>{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 2. Gate 2 冻结双引擎组合控制板 */}
      <div className={`p-2.5 rounded-xl border transition-all ${
        isRunning
          ? 'bg-gradient-to-r from-emerald-950/35 via-bg-elevated to-bg-secondary border-emerald-500/40'
          : 'bg-gradient-to-r from-trade-ai/10 via-bg-elevated to-bg-secondary border-trade-ai/30'
      }`}>
        <div className="flex items-center justify-between pb-1.5 border-b border-bg-border/60">
          <div className="flex items-center space-x-1.5">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRunning ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-500' : 'bg-cyan-500'}`} />
            </span>
            <span className="text-xs font-bold text-text-primary">
              ❄️ Gate 2 冻结双引擎
            </span>
          </div>
          <span className="text-[10px] font-mono text-cyan-300">
            60% 趋势 · 30% 套利 · 10% 缓冲
          </span>
        </div>

        {/* 4 大核心工程保障 */}
        <div className="grid grid-cols-2 gap-1.5 py-2 text-[10px]">
          <div className="flex items-start space-x-1.5 p-1.5 rounded-lg bg-bg-primary/50 border border-bg-border/50">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-text-primary">主引擎 B · 双周期趋势</div>
              <div className="text-text-muted text-[9px] leading-tight mt-0.5">4H 凯尔特纳 + 1D 双均线吊灯止损</div>
            </div>
          </div>

          <div className="flex items-start space-x-1.5 p-1.5 rounded-lg bg-bg-primary/50 border border-bg-border/50">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-text-primary">底座引擎 A · 期现套利</div>
              <div className="text-text-muted text-[9px] leading-tight mt-0.5">Delta 中性，低费率自动切 USDT 活期</div>
            </div>
          </div>

          <div className="flex items-start space-x-1.5 p-1.5 rounded-lg bg-bg-primary/50 border border-bg-border/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-text-primary">零裸仓 + 仓位隔离</div>
              <div className="text-text-muted text-[9px] leading-tight mt-0.5">先挂后撤止损，绝不接管外部手动仓</div>
            </div>
          </div>

          <div className="flex items-start space-x-1.5 p-1.5 rounded-lg bg-bg-primary/50 border border-bg-border/50">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-text-primary">实盘行情影子撮合</div>
              <div className="text-text-muted text-[9px] leading-tight mt-0.5">2bps 滑点 + 8h 真实费率闭环结算</div>
            </div>
          </div>
        </div>

        {/* 快捷操作按钮行 */}
        <div className="flex flex-col space-y-1.5">
          {!isRunning && (
            <button
              type="button"
              onClick={handleOneClickOptimalStart}
              disabled={loading || riskStatus === 'PANIC_LOCKED' || riskStatus === 'CIRCUIT_BROKEN'}
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ 一键启动 Top 5 双引擎冻结影子盘</span>
            </button>
          )}
          {onOpenDualEngine && (
            <button
              type="button"
              onClick={onOpenDualEngine}
              className="w-full py-1.5 px-3 rounded-lg bg-bg-primary/70 hover:bg-bg-elevated border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 font-semibold text-[11px] flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>打开双引擎 60/30/10 槽位、验真与套利雷达</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Top 5 监控标的池与实时巡检状态 */}
      <div className="p-2 rounded-lg bg-bg-elevated/60 border border-bg-border space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-bold text-text-secondary">
            Top {symbolsPool.length} 标的池 · 限持 {maxConcurrentPositions} 仓
          </span>
          {autoPilotStatus?.stop_loss_equity_floor ? (
            <span className="flex items-center space-x-1 text-amber-400 font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
              <ShieldAlert className="w-3 h-3" />
              <span>停机底线: ${autoPilotStatus.stop_loss_equity_floor.toFixed(0)}</span>
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {symbolsPool.map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => setActiveSymbol(sym)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer ${
                sym === activeSymbol
                  ? 'bg-trade-ai/20 text-trade-ai border-trade-ai/50 font-bold'
                  : 'bg-bg-secondary text-text-secondary border-bg-border hover:border-text-muted'
              }`}
            >
              {getBaseCurrency(sym)}
            </button>
          ))}
        </div>

        {autoPilotStatus?.last_patrol_log && (
          <div className="flex items-center space-x-1.5 text-[10px] text-text-muted font-mono pt-1 border-t border-bg-border/40">
            <Radio className={`w-3 h-3 shrink-0 ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="truncate" title={autoPilotStatus.last_patrol_log}>
              {autoPilotStatus.last_patrol_log}
            </span>
          </div>
        )}
      </div>

      {/* 4. 累计净收益与核心战绩指标 */}
      <div className="rounded-lg bg-bg-elevated/70 border border-bg-border p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>会话累计净盈亏 (含费率/滑点)</span>
          <span className="font-mono">基准: ${startEquity.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className={`text-xl font-bold font-mono-num tracking-tight ${
            isProfitPositive ? 'text-trade-up' : 'text-trade-down'
          }`}>
            {isProfitPositive ? '+' : ''}${totalPnl.toFixed(2)}
          </span>
          <span className={`text-xs font-bold font-mono-num ${
            isProfitPositive ? 'text-trade-up' : 'text-trade-down'
          }`}>
            ({isProfitPositive ? '+' : ''}{totalPnlRatio.toFixed(2)}%)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-bg-border/50 text-[10px] font-mono-num">
          <div>
            <span className="text-text-muted block">已实现:</span>
            <span className={`font-semibold ${realizedPnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
              {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-text-muted block">持仓浮动:</span>
            <span className={`font-semibold ${unrealizedPnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="p-2 rounded-lg bg-bg-elevated/50 border border-bg-border/60">
          <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>胜率 (Win Rate)</span>
            <Award className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-sm font-bold font-mono-num text-text-primary mt-0.5">
            {totalTrades > 0 ? `${winRate.toFixed(1)}%` : '--'}
          </div>
          <div className="text-[10px] text-text-muted font-mono-num">
            {winTrades}胜 / {lossTrades}负 ({totalTrades}单)
          </div>
        </div>

        <div className="p-2 rounded-lg bg-bg-elevated/50 border border-bg-border/60">
          <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>收益因子 / 回撤</span>
            <TrendingUp className="w-3 h-3 text-trade-ai" />
          </div>
          <div className="text-sm font-bold font-mono-num text-text-primary mt-0.5">
            {profitFactor > 0 ? `PF ${profitFactor.toFixed(2)}` : '--'}
          </div>
          <div className="text-[10px] text-text-muted font-mono-num">
            最大回撤: {maxDrawdown.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 5. 自动平仓流水 (右侧已有独立大号收益曲线，此处不再重复嵌套图表) */}
      <div className="flex-1 flex flex-col min-h-[120px] rounded-lg bg-bg-elevated/40 border border-bg-border overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-bg-border/60 bg-bg-secondary/80 text-[11px]">
          <span className="font-bold text-text-primary">
            自动平仓流水 ({autoPilotHistory?.trades?.length || 0})
          </span>
          <span className="text-[10px] text-text-muted font-mono">4H / 1D 闭合信号</span>
        </div>

        <div className="flex-1 p-1.5 overflow-y-auto space-y-1.5">
          {autoPilotHistory?.trades && autoPilotHistory.trades.length > 0 ? (
            autoPilotHistory.trades.slice(0, 15).map((t: AutoPilotTradeRecord, idx: number) => (
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
                  <div className="text-[9px] text-text-muted flex items-center justify-end space-x-1">
                    <span className="truncate max-w-[90px]" title={t.reason}>{t.reason}</span>
                    <span>•</span>
                    <span>{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-5 text-center text-text-muted text-[11px] leading-relaxed">
              暂无平仓记录 · 4H / 1D 闭合信号驱动低频稳健执行
            </div>
          )}
        </div>
      </div>

      {/* 6. 精简双引擎运行设置弹窗 */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-bg-border bg-bg-secondary p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bg-border pb-2">
              <div className="flex items-center space-x-2 text-text-primary font-bold text-sm">
                <Sliders className="w-4 h-4 text-trade-ai" />
                <span>双引擎安全护栏与标的池设置</span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="text-text-muted hover:text-text-primary text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-[11px] text-cyan-200 leading-relaxed">
              ❄️ <strong>参数已按 Gate 2A 验真基线冻结</strong>：4H 凯尔特纳 (`ema=20, k=2.5, sl=3.0×ATR`) 与 1D 双均线 (`20/50, sl=2.5×ATR`) 严禁运行期人工微调，此处仅开放监控池与全局停机底线。
            </div>

            <div className="space-y-3.5 text-xs">
              {/* 标的池管理 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="font-medium">监控加密永续池 ({symbolsPool.length} 个)</span>
                  <button
                    type="button"
                    onClick={() => setSymbolsPool(CORE_TOP5_UNIVERSE)}
                    className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    恢复 Top 5 官方池
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-bg-primary border border-bg-border min-h-[44px]">
                  {symbolsPool.map((sym) => (
                    <span
                      key={sym}
                      className="px-2 py-0.5 rounded bg-bg-elevated border border-bg-border text-text-primary text-[11px] font-mono flex items-center space-x-1"
                    >
                      <span>{getBaseCurrency(sym)}</span>
                      {symbolsPool.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSymbol(sym)}
                          className="text-text-muted hover:text-trade-down cursor-pointer ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div className="relative">
                  <div className="flex space-x-1.5">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="搜索 OKX 主流加密永续 (如 BTC, ETH, SOL)..."
                        value={newSymbolInput}
                        onChange={(e) => setNewSymbolInput(e.target.value)}
                        onFocus={() => {
                          if (symbolSuggestions.length > 0) setShowSymbolDropdown(true);
                        }}
                        className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-bg-primary border border-bg-border text-text-primary text-xs font-mono uppercase focus:outline-none focus:border-trade-ai"
                      />
                      {isSearchingSymbol && (
                        <div className="absolute right-2.5 top-2.5 w-3 h-3 border-2 border-trade-ai border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddSymbol(activeSymbol)}
                      className="px-2 py-1.5 rounded-lg bg-bg-elevated hover:bg-bg-border text-trade-ai text-[11px] flex items-center space-x-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>当前</span>
                    </button>
                  </div>

                  {showSymbolDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-bg-elevated border border-bg-border rounded-lg shadow-xl overflow-hidden divide-y divide-bg-border/40 max-h-48 overflow-y-auto">
                      {symbolSuggestions.length > 0 ? (
                        symbolSuggestions.map((item) => {
                          const isAlreadyIn = symbolsPool.includes(item.symbol);
                          return (
                            <div
                              key={item.symbol}
                              onClick={() => {
                                if (!isAlreadyIn) handleAddSymbol(item.symbol);
                              }}
                              className={`p-2 flex items-center justify-between text-xs cursor-pointer ${
                                isAlreadyIn ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-primary'
                              }`}
                            >
                              <span className="font-bold font-mono text-text-primary">{item.symbol}</span>
                              <span className="text-[10px] text-trade-ai">{isAlreadyIn ? '已在池中' : '+ 添加'}</span>
                            </div>
                          );
                        })
                      ) : symbolSearchError ? (
                        <div className="p-2.5 text-center text-[11px] text-text-muted">{symbolSearchError}</div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* 最大并发持仓 */}
              <div className="space-y-1.5 pt-2 border-t border-bg-border/60">
                <div className="flex justify-between text-text-secondary">
                  <span>最大并发持仓上限</span>
                  <span className="text-trade-ai font-bold font-mono">{maxConcurrentPositions} 仓</span>
                </div>
                <div className="flex space-x-2">
                  {[2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxConcurrentPositions(num)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-bold border transition cursor-pointer ${
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

              {/* 本金止损底线 */}
              <div className="space-y-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-amber-400 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    <span>全局回撤停机底线 (默认 18%)</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-text-secondary block mb-1">最低保留净值 (USDT)</label>
                    <input
                      type="number"
                      value={stopLossEquityFloor}
                      onChange={(e) => handleFloorChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-bg-primary border border-bg-border text-text-primary text-xs font-mono font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-secondary block mb-1">最大允许回撤额 (USDT)</label>
                    <input
                      type="number"
                      value={maxLossLimitUsdt}
                      onChange={(e) => handleMaxLossChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-bg-primary border border-bg-border text-text-primary text-xs font-mono font-bold focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-amber-300 font-mono">
                  <span>当前净值: ${currentEquity.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => handleFloorChange(String(Number((currentEquity * 0.82).toFixed(2))))}
                    className="underline hover:text-amber-200 cursor-pointer"
                  >
                    重算为当前净值的 82% (${(currentEquity * 0.82).toFixed(0)})
                  </button>
                </div>
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
                保存并应用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. 重置统计基准确认弹窗 */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-xl border border-amber-500/40 bg-bg-secondary p-5 shadow-2xl space-y-3">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>重置收益统计基准</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              将以当前净值 (${totalEquity.toFixed(2)} USDT) 作为新起点重新统计收益，并将 18% 停机底线重置为 ${(totalEquity * 0.82).toFixed(2)}。
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
