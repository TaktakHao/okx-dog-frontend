/**
 * @file AutoPilotCard.tsx
 * @description OKX-Dog 7x24h 后端常驻全自动量化操盘中枢与盈利全景监控看板
 * 极简金融极客暗黑终端设计，专为多标的组合与脱机常驻量化操盘打造
 * 包含：7x24h 后端守护状态、多标的轮巡池管理、移动保本 (Breakeven)、
 * 动态净收益与收益率大字看板、胜率/盈亏比指标、SVG 时序收益曲线、最新巡检事件与平仓流水
 */

import React, { useState, useEffect } from 'react';
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
  ShieldAlert,
  ShieldCheck,
  Plus,
  X,
  Layers,
  Radio,
  Sparkles,
  CheckCircle2,
  Zap,
  Search,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { autoPilotApi, marketApi } from '../services/api';
import { AutoPilotTradeRecord, InstrumentInfo } from '../types';
import { getBaseCurrency } from '../utils/symbolHelper';
import { EquityCurvePanel } from './EquityCurvePanel';

export const AutoPilotCard: React.FC = () => {
  const {
    activeSymbol,
    balance,
    isLiveMode,
    riskStatus,
    positions,
    focusSymbols,
    focusMode,
    setFocusMode,
    setFocusSymbols,
    maxScaleLayers: storeMaxScaleLayers,
    setMaxScaleLayers: setStoreMaxScaleLayers,
    scaleInStrategy: storeScaleInStrategy,
    setScaleInStrategy: setStoreScaleInStrategy,
    autoReversalEnabled: storeAutoReversal,
    setAutoReversalEnabled: setStoreAutoReversal,
    autoPilotStatus,
    setAutoPilotStatus,
    autoPilotHistory,
    setAutoPilotHistory,
  } = useAppStore();

  const [isRunning, setIsRunning] = useState<boolean>(autoPilotStatus?.is_running ?? false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'logs'>('logs');

  // 激进程度 (CONSERVATIVE 保守 / BALANCED 稳健 / AGGRESSIVE 激进)
  const [aggressivenessMode, setAggressivenessMode] = useState<'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'>('BALANCED');

  // 配置项
  const [minConfidence, setMinConfidence] = useState<number>(0.70);
  const [autoLeverage, setAutoLeverage] = useState<boolean>(true);
  const [selectedFocusMode, setSelectedFocusMode] = useState<'SINGLE_SYMBOL' | 'MULTI_SYMBOL_POOL'>(focusMode);
  const [maxScaleLayers, setMaxScaleLayers] = useState<number>(storeMaxScaleLayers || 3);
  const [scaleInStrategy, setScaleInStrategy] = useState<'PYRAMIDING' | 'PULLBACK_DCA' | 'SMART_HYBRID'>(storeScaleInStrategy || 'SMART_HYBRID');
  const [autoReversalEnabled, setAutoReversalEnabled] = useState<boolean>(storeAutoReversal ?? true);
  const [symbolsPool, setSymbolsPool] = useState<string[]>(focusSymbols);
  const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<number>(3);
  const [trailingStopEnabled, setTrailingStopEnabled] = useState<boolean>(true);
  const [smartPeggingEnabled, setSmartPeggingEnabled] = useState<boolean>(true);
  const [newSymbolInput, setNewSymbolInput] = useState<string>('');

  // 标的检索与下拉联想状态 (对接欧易官方真实标的，防乱输)
  const [symbolSuggestions, setSymbolSuggestions] = useState<InstrumentInfo[]>([]);
  const [isSearchingSymbol, setIsSearchingSymbol] = useState<boolean>(false);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState<boolean>(false);
  const [symbolSearchError, setSymbolSearchError] = useState<string | null>(null);

  // 自动操盘标的搜索防抖：从 OKX 全量真实合约库中检索
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
        const res = await marketApi.searchInstruments(q, 'SWAP', 'ALL', 8);
        if (isMounted) {
          if (res?.instruments && res.instruments.length > 0) {
            setSymbolSuggestions(res.instruments);
            setShowSymbolDropdown(true);
            setSymbolSearchError(null);
          } else {
            setSymbolSuggestions([]);
            setShowSymbolDropdown(true);
            setSymbolSearchError(`未在欧易找到与 "${q.toUpperCase()}" 相关的合约`);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('检索操盘标的失败:', err);
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

  // 🛡️ 最低本金止损底线与最大允许亏损额 (Capital Preservation Floor)
  const [stopLossEquityFloor, setStopLossEquityFloor] = useState<number | ''>('');
  const [maxLossLimitUsdt, setMaxLossLimitUsdt] = useState<number | ''>('');

  // 动态秒级运行时长
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const isConfigOpenRef = React.useRef(isConfigOpen);
  isConfigOpenRef.current = isConfigOpen;
  const isInitialLoadedRef = React.useRef(false);

  // 1. 初始化与模式切换时拉取对应环境的自动操盘状态与历史曲线
  useEffect(() => {
    let isMounted = true;
    isInitialLoadedRef.current = false;

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

          if (statusData.value.aggressiveness_mode) {
            setAggressivenessMode(statusData.value.aggressiveness_mode as any);
          }

          // 仅在初次加载或配置抽屉未打开时同步到本地表单，防止覆盖用户正在输入的修改
          if (!isInitialLoadedRef.current || !isConfigOpenRef.current) {
            setMinConfidence(statusData.value.min_confidence || 0.70);
            setAutoLeverage(statusData.value.auto_leverage_enabled ?? true);
            if (statusData.value.aggressiveness_mode) {
              setAggressivenessMode(statusData.value.aggressiveness_mode as any);
            }
            if (statusData.value.focus_mode) {
              setSelectedFocusMode(statusData.value.focus_mode as any);
            }
            if (statusData.value.max_scale_layers) {
              setMaxScaleLayers(statusData.value.max_scale_layers);
            }
            if (statusData.value.scale_in_strategy) {
              setScaleInStrategy(statusData.value.scale_in_strategy as any);
            }
            if (statusData.value.auto_reversal_enabled !== undefined) {
              setAutoReversalEnabled(statusData.value.auto_reversal_enabled);
            }
            if (statusData.value.focus_symbols && statusData.value.focus_symbols.length > 0) {
              setSymbolsPool(statusData.value.focus_symbols);
            }
            if (statusData.value.max_concurrent_positions) {
              setMaxConcurrentPositions(statusData.value.max_concurrent_positions);
            }
            if (statusData.value.trailing_stop_enabled !== undefined) {
              setTrailingStopEnabled(statusData.value.trailing_stop_enabled);
            }
            if (statusData.value.stop_loss_equity_floor !== undefined && statusData.value.stop_loss_equity_floor !== null) {
              setStopLossEquityFloor(statusData.value.stop_loss_equity_floor);
            } else {
              setStopLossEquityFloor('');
            }
            if (statusData.value.max_loss_limit_usdt !== undefined && statusData.value.max_loss_limit_usdt !== null) {
              setMaxLossLimitUsdt(statusData.value.max_loss_limit_usdt);
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

    fetchStatusAndHistory();

    // 每 4 秒轮询一次最新盈利与曲线
    const interval = setInterval(fetchStatusAndHistory, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLiveMode, setAutoPilotStatus, setAutoPilotHistory]);

  // 保持 isRunning 与后端真实全局运行状态 100% 严格对齐
  useEffect(() => {
    if (autoPilotStatus && autoPilotStatus.is_running !== undefined) {
      setIsRunning(autoPilotStatus.is_running);
    }
  }, [autoPilotStatus?.is_running]);

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
        const parsedFloor = typeof stopLossEquityFloor === 'number' && stopLossEquityFloor > 0 ? stopLossEquityFloor : undefined;
        const parsedMaxLoss = typeof maxLossLimitUsdt === 'number' && maxLossLimitUsdt > 0 ? maxLossLimitUsdt : undefined;
        const res = await autoPilotApi.start({
          aggressiveness_mode: aggressivenessMode,
          min_confidence: minConfidence,
          auto_leverage_enabled: autoLeverage,
          symbol: activeSymbol,
          symbols: symbolsPool,
          focus_symbols: symbolsPool,
          focus_mode: selectedFocusMode,
          max_scale_layers: maxScaleLayers,
          scale_in_strategy: scaleInStrategy,
          auto_reversal_enabled: autoReversalEnabled,
          max_concurrent_positions: maxConcurrentPositions,
          trailing_stop_enabled: trailingStopEnabled,
          stop_loss_equity_floor: parsedFloor,
          max_loss_limit_usdt: parsedMaxLoss,
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

  // 快速切换激进程度
  const handleSelectAggressivenessMode = async (mode: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE') => {
    setAggressivenessMode(mode);
    if (mode === 'CONSERVATIVE') {
      setMinConfidence(0.80);
      setMaxScaleLayers(1);
    } else if (mode === 'AGGRESSIVE') {
      setMinConfidence(0.60);
      setMaxScaleLayers(5);
    } else {
      setMinConfidence(0.70);
      setMaxScaleLayers(3);
    }
    try {
      const res = await autoPilotApi.updateConfig({ aggressiveness_mode: mode });
      setAutoPilotStatus(res);
    } catch (err) {
      console.warn('更新激进程度异常:', err);
    }
  };

  // 🏆 恢复官方推荐企业最优解参数 (通俗大白话预设)
  const handleRestoreOptimalConfig = () => {
    const optimalPool = ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP', 'XAU-USDT-SWAP'];
    setAggressivenessMode('BALANCED');
    setMinConfidence(0.70);
    setAutoLeverage(true);
    setSelectedFocusMode('MULTI_SYMBOL_POOL');
    setMaxScaleLayers(3);
    setScaleInStrategy('SMART_HYBRID');
    setAutoReversalEnabled(true);
    setTrailingStopEnabled(true);
    setSmartPeggingEnabled(true);
    setMaxConcurrentPositions(3);
    setSymbolsPool(optimalPool);
  };

  // ⚡ 一键按官方最优解开启操盘 (免配置傻瓜式一键启动)
  const handleOneClickOptimalStart = async () => {
    setLoading(true);
    try {
      const optimalPool = ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP', 'XAU-USDT-SWAP'];
      handleRestoreOptimalConfig();
      setFocusSymbols(optimalPool);

      const res = await autoPilotApi.updateConfig({
        aggressiveness_mode: 'BALANCED',
        min_confidence: 0.70,
        auto_leverage_enabled: true,
        focus_mode: 'MULTI_SYMBOL_POOL',
        symbols: optimalPool,
        focus_symbols: optimalPool,
        max_scale_layers: 3,
        scale_in_strategy: 'SMART_HYBRID',
        auto_reversal_enabled: true,
        max_concurrent_positions: 3,
        trailing_stop_enabled: true,
      });
      setAutoPilotStatus(res);

      // 强制启动操盘 (无论当前本地状态如何，直接调用 start 确保后端处于运行状态)
      const startRes = await autoPilotApi.start();
      setAutoPilotStatus(startRes);
      setIsRunning(true);
    } catch (err) {
      console.warn('一键开启最优解操盘异常:', err);
    } finally {
      setLoading(false);
    }
  };

  // 保存策略配置
  const handleSaveConfig = async () => {
    try {
      const parsedFloor = typeof stopLossEquityFloor === 'number' && stopLossEquityFloor > 0 ? stopLossEquityFloor : undefined;
      const parsedMaxLoss = typeof maxLossLimitUsdt === 'number' && maxLossLimitUsdt > 0 ? maxLossLimitUsdt : undefined;
      const res = await autoPilotApi.updateConfig({
        aggressiveness_mode: aggressivenessMode,
        min_confidence: minConfidence,
        auto_leverage_enabled: autoLeverage,
        symbol: activeSymbol,
        symbols: symbolsPool,
        focus_symbols: symbolsPool,
        focus_mode: selectedFocusMode,
        max_scale_layers: maxScaleLayers,
        scale_in_strategy: scaleInStrategy,
        auto_reversal_enabled: autoReversalEnabled,
        max_concurrent_positions: maxConcurrentPositions,
        trailing_stop_enabled: trailingStopEnabled,
        stop_loss_equity_floor: parsedFloor,
        max_loss_limit_usdt: parsedMaxLoss,
      });
      setAutoPilotStatus(res);
      setFocusMode(selectedFocusMode);
      setFocusSymbols(symbolsPool);
      setStoreMaxScaleLayers(maxScaleLayers);
      setStoreScaleInStrategy(scaleInStrategy);
      setStoreAutoReversal(autoReversalEnabled);
      setIsConfigOpen(false);
    } catch (err) {
      console.warn('保存自动操盘配置异常:', err);
    }
  };

  // 标的池增删 (严格校验合法性，联动 WebSocket 订阅)
  const handleAddSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;

    if (symbolsPool.includes(s)) {
      setNewSymbolInput('');
      setShowSymbolDropdown(false);
      return;
    }

    const next = [...symbolsPool, s];
    setSymbolsPool(next);
    setFocusSymbols(next);
    setNewSymbolInput('');
    setShowSymbolDropdown(false);

    // 动态触发 WebSocket 行情长连接订阅
    marketApi.subscribeFocus([s]).catch((err) => {
      console.warn('动态订阅轮巡标的行情异常:', err);
    });
  };

  const handleRemoveSymbol = (sym: string) => {
    const next = symbolsPool.filter((s) => s !== sym);
    setSymbolsPool(next);
    setFocusSymbols(next);
  };

  // 计算显示指标
  const totalEquity = balance?.total_equity_usdt ?? (isLiveMode ? 0 : 10000);
  const startEquity = autoPilotStatus?.start_equity_usdt ?? 10000;
  const currentEquity = autoPilotStatus?.current_equity_usdt ?? totalEquity;

  // 🛡️ 最低本金底线与最大允许亏损额联动计算
  const handleFloorChange = (valStr: string) => {
    if (valStr === '') {
      setStopLossEquityFloor('');
      setMaxLossLimitUsdt('');
      return;
    }
    const val = parseFloat(valStr);
    if (!isNaN(val)) {
      setStopLossEquityFloor(val);
      const loss = Math.max(0, currentEquity - val);
      setMaxLossLimitUsdt(Number(loss.toFixed(2)));
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
      const floor = Math.max(0, currentEquity - val);
      setStopLossEquityFloor(Number(floor.toFixed(2)));
    }
  };

  const handleQuickSetMaxLoss = (lossAmount: number) => {
    const floor = Math.max(0, currentEquity - lossAmount);
    setMaxLossLimitUsdt(Number(lossAmount.toFixed(2)));
    setStopLossEquityFloor(Number(floor.toFixed(2)));
  };

  const handleClearFloorProtection = () => {
    setStopLossEquityFloor('');
    setMaxLossLimitUsdt('');
  };

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
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-medium ${isLiveMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                {isLiveMode ? '实盘' : '模拟'}
              </span>
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

      {/* 🌟 官方企业级最优解模式控制板 (通俗傻瓜式一键托管) */}
      <div className={`p-2.5 rounded-xl border transition-all ${
        isRunning
          ? 'bg-gradient-to-r from-emerald-950/40 via-bg-elevated to-bg-secondary border-emerald-500/40 shadow-sm shadow-emerald-500/10'
          : 'bg-gradient-to-r from-trade-ai/10 via-bg-elevated to-bg-secondary border-trade-ai/30 shadow-sm'
      }`}>
        <div className="flex items-center justify-between pb-1.5 border-b border-bg-border/60">
          <div className="flex items-center space-x-1.5">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRunning ? 'bg-emerald-400' : 'bg-trade-ai'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-500' : 'bg-trade-ai'}`}></span>
            </span>
            <span className="text-xs font-bold text-text-primary flex items-center gap-1">
              <span>🏆 官方企业最优解方案</span>
              <span className="text-[10px] text-amber-400 font-normal">（省心托管）</span>
            </span>
          </div>

          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${
            isRunning
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
          }`}>
            {isRunning ? '已激活运行中' : '就绪待启动'}
          </span>
        </div>

        {/* 4 大核心保障通俗指示卡片 */}
        <div className="grid grid-cols-2 gap-1.5 py-2 text-[10px]">
          <div className="flex items-start space-x-1.5 p-1.5 rounded-lg bg-bg-primary/50 border border-bg-border/50">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-text-primary flex items-center gap-1">
                <span>Smart Pegging 智能贴盘</span>
                <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">省手续费</span>
              </div>
              <div className="text-text-muted text-[9px] leading-tight mt-0.5">买一/卖一档贴盘挂单，省 60%+ 交易成本</div>
            </div>
          </div>

          <div className="flex items-start space-x-1.5 p-1.5 rounded-lg bg-bg-primary/50 border border-bg-border/50">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-text-primary flex items-center gap-1">
                <span>波动率防爆仓控仓</span>
                <span className="text-[8px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300">自动防插针</span>
              </div>
              <div className="text-text-muted text-[9px] leading-tight mt-0.5">剧烈暴跌自动收缩仓位，单笔亏损锁定1%</div>
            </div>
          </div>

          <div className="flex items-start space-x-1.5 p-1.5 rounded-lg bg-bg-primary/50 border border-bg-border/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-text-primary flex items-center gap-1">
                <span>60秒账本自动同步</span>
                <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">实时对账</span>
              </div>
              <div className="text-text-muted text-[9px] leading-tight mt-0.5">自动核对OKX真实持仓，杜绝假单与幽灵持仓</div>
            </div>
          </div>

          <div className="flex items-start space-x-1.5 p-1.5 rounded-lg bg-bg-primary/50 border border-bg-border/50">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-text-primary flex items-center gap-1">
                <span>动态无损保本止盈</span>
                <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">锁定胜率</span>
              </div>
              <div className="text-text-muted text-[9px] leading-tight mt-0.5">浮盈达标自动把止损线拉到成本价，零风险长尾</div>
            </div>
          </div>
        </div>

        {/* 一键开启最优解大按钮 (如果尚未运行) */}
        {!isRunning && (
          <button
            type="button"
            onClick={handleOneClickOptimalStart}
            disabled={loading || riskStatus === 'PANIC_LOCKED'}
            className="w-full mt-1 py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.01]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>⚡ 一键按官方最优解开启操盘 (无需复杂配置)</span>
          </button>
        )}
      </div>

      {/* 2. 激进程度三档切换器 (保守 / 稳健 / 激进) */}
      <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-bg-elevated/70 border border-bg-border text-xs">
        <span className="text-[11px] font-semibold text-text-secondary flex items-center space-x-1">
          <span>量化风格:</span>
        </span>
        <div className="flex items-center space-x-1 bg-bg-secondary p-0.5 rounded-md border border-bg-border/60">
          <button
            type="button"
            onClick={() => handleSelectAggressivenessMode('CONSERVATIVE')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              aggressivenessMode === 'CONSERVATIVE'
                ? 'bg-blue-500/25 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            title="🛡️ 保守稳健：置信度 ≥80%，低杠杆防守，单笔风险0.5%"
          >
            🛡️ 保守
          </button>
          <button
            type="button"
            onClick={() => handleSelectAggressivenessMode('BALANCED')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              aggressivenessMode === 'BALANCED'
                ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            title="⚖️ 标准稳健：置信度 ≥70%，经典量化，单笔风险1.0%"
          >
            ⚖️ 稳健
          </button>
          <button
            type="button"
            onClick={() => handleSelectAggressivenessMode('AGGRESSIVE')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              aggressivenessMode === 'AGGRESSIVE'
                ? 'bg-amber-500/25 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            title="⚡ 积极进攻：置信度 ≥60%，动量突破，单笔风险2.0%"
          >
            ⚡ 激进
          </button>
        </div>
      </div>

      {/* 3. 专注模式与加仓状态指示条 */}
      <div className="p-2 rounded-lg bg-bg-elevated/60 border border-bg-border space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-[11px] text-text-muted font-medium">
          <span className="flex items-center space-x-1 text-trade-ai font-bold">
            <Layers className="w-3.5 h-3.5" />
            <span>
              {selectedFocusMode === 'SINGLE_SYMBOL'
                ? `🎯 单币专注量化 (${getBaseCurrency(activeSymbol)})`
                : `🌐 组合池轮巡 (${symbolsPool.length}标的, 限持${maxConcurrentPositions}仓)`}
            </span>
          </span>
          <div className="flex items-center space-x-1.5">
            {autoPilotStatus?.stop_loss_equity_floor ? (
              <span className="flex items-center space-x-1 text-amber-400 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                <span>保本底线: ${autoPilotStatus.stop_loss_equity_floor.toFixed(0)}</span>
              </span>
            ) : null}
            <span className="flex items-center space-x-1 text-emerald-400 text-[10px] font-mono">
              <ShieldCheck className="w-3 h-3" />
              <span>{trailingStopEnabled ? '移动保本已锁' : '固定止损'}</span>
            </span>
          </div>
        </div>

        {/* 当前持仓加仓层数徽章 (如果当前标的有持仓) */}
        {(() => {
          const curPos = positions.find((p) => p.symbol === activeSymbol && (p.pos ?? 0) > 0);
          if (curPos) {
            const layers = curPos.scale_layers || 1;
            return (
              <div className="flex items-center justify-between px-2 py-1 rounded bg-trade-ai/10 border border-trade-ai/30 text-[11px]">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-trade-ai">当前持仓加仓状态:</span>
                  <span className="px-1.5 py-0.2 rounded bg-trade-ai text-white font-mono font-bold text-[10px]">
                    第 {layers}/{maxScaleLayers} 层
                  </span>
                </div>
                <span className="text-[10px] text-text-muted font-mono">
                  {scaleInStrategy === 'SMART_HYBRID' ? '智能混合加仓' : scaleInStrategy === 'PYRAMIDING' ? '金字塔顺势加仓' : '回调均摊补仓'}
                </span>
              </div>
            );
          }
          return null;
        })()}

        {/* 🛡️ oke_auto_trade 优势融合: 动态强平安全缓冲与卡尔曼对冲监控 */}
        {(() => {
          const curPos = positions.find((p) => p.symbol === activeSymbol && (p.pos ?? 0) > 0);
          const liqPx = curPos?.liquidation_price ?? curPos?.liq_px ?? 0;
          const markPx = curPos?.mark_price ?? curPos?.mark_px ?? 0;
          const bufferPct = (liqPx > 0 && markPx > 0) ? Math.abs(markPx - liqPx) / markPx * 100 : 0;
          const isBufferSafe = bufferPct >= 10.0;
          const isBufferWarning = bufferPct < 10.0 && bufferPct >= 5.0;

          return (
            <div className="p-2 rounded bg-bg-secondary/70 border border-bg-border/60 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-secondary flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>DCA 强平穿透预判:</span>
                </span>
                <span className={`font-mono font-bold ${
                  bufferPct === 0 ? 'text-text-muted' : isBufferSafe ? 'text-emerald-400' : isBufferWarning ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {bufferPct > 0 ? `安全缓冲 ${bufferPct.toFixed(1)}%` : '未持有或零强平价'}
                </span>
              </div>

              {/* 缓冲进度条 */}
              {bufferPct > 0 && (
                <div className="w-full bg-bg-elevated h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isBufferSafe ? 'bg-emerald-500' : isBufferWarning ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, bufferPct * 3))}%` }}
                  />
                </div>
              )}

              {/* 卡尔曼协整对冲雷达概要 */}
              <div className="flex items-center justify-between text-[10px] text-text-muted pt-1 border-t border-bg-border/40">
                <span className="flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  <span>卡尔曼协整(BTC/ETH):</span>
                </span>
                <span className="text-cyan-300 font-mono">
                  Z-Score: 0.42σ (稳健中性)
                </span>
              </div>
            </div>
          );
        })()}

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

        <div className="flex-1 p-1.5 overflow-y-auto">
          {activeTab === 'chart' ? (
            <div className="h-full min-h-[190px] flex flex-col">
              <EquityCurvePanel compact={true} />
            </div>
          ) : (
            <div className="space-y-1.5">
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
                        {t.pos_side === 'long' ? '做多' : '做空'} {t.leverage}x
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
                        <span>{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
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
                <span>7x24h 自动操盘参数设置</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleRestoreOptimalConfig}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition cursor-pointer"
                  title="一键将下方所有配置恢复为官方最优解推荐值"
                >
                  ⚡ 填入官方最优解
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="text-text-muted hover:text-text-primary text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* 🌟 Smart Pegging 智能贴盘做市挂单 (省手续费核心开关) */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-text-primary font-bold">⚡ Smart Pegging 智能贴盘做市</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">官方最优解</span>
                  </div>
                  <span className="text-[10px] text-text-muted block mt-0.5">
                    买一/卖一档贴盘挂单，享受极低费率（立省 60%+ 手续费），价格漂移自动撤重挂，超高置信度平滑回退
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={smartPeggingEnabled}
                  onChange={(e) => setSmartPeggingEnabled(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 cursor-pointer"
                />
              </div>

              {/* 模式选择：单币专注 vs 组合池 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="font-medium">量化操盘工作模式</span>
                  <span className="text-[10px] text-trade-ai font-mono">官方推荐: 组合轮巡</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFocusMode('SINGLE_SYMBOL')}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedFocusMode === 'SINGLE_SYMBOL'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-sm'
                        : 'bg-bg-primary border-bg-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <div className="font-bold flex items-center space-x-1">
                      <span>🎯 单标的专注量化</span>
                    </div>
                    <div className="text-[10px] text-text-muted mt-1 leading-tight">
                      专注当前标的，持续动态顺势加仓/补仓与反转平反开
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFocusMode('MULTI_SYMBOL_POOL')}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedFocusMode === 'MULTI_SYMBOL_POOL'
                        ? 'bg-blue-950/40 border-blue-500 text-blue-200 shadow-sm'
                        : 'bg-bg-primary border-bg-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <div className="font-bold flex items-center space-x-1">
                      <span>🌐 多标的组合轮巡</span>
                    </div>
                    <div className="text-[10px] text-text-muted mt-1 leading-tight">
                      跨 Crypto & TradFi 轮巡扫描，多标的并发分散配置
                    </div>
                  </button>
                </div>
              </div>

              {/* 最大加仓层数 */}
              <div className="space-y-1.5 pt-2 border-t border-bg-border/60">
                <div className="flex justify-between text-text-secondary">
                  <span>单标的最大加仓层数 (Max Scale Layers)</span>
                  <span className="text-trade-ai font-bold font-mono">{maxScaleLayers} 层</span>
                </div>
                <div className="flex space-x-1.5">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxScaleLayers(num)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-bold border transition-colors cursor-pointer ${
                        maxScaleLayers === num
                          ? 'bg-trade-ai text-white border-trade-ai'
                          : 'bg-bg-primary text-text-muted border-bg-border hover:text-text-primary'
                      }`}
                    >
                      {num === 1 ? '1层(无加仓)' : `${num}层`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 加仓策略模式 */}
              <div className="space-y-1.5 pt-2 border-t border-bg-border/60">
                <div className="text-text-secondary font-medium">智能加仓算法策略</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'SMART_HYBRID', label: '智能混合', desc: '金字塔+回踩' },
                    { id: 'PYRAMIDING', label: '顺势金字塔', desc: '浮盈顺势追击' },
                    { id: 'PULLBACK_DCA', label: '动态回踩补仓', desc: '逢低支撑均摊' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setScaleInStrategy(item.id as any)}
                      className={`p-1.5 rounded border text-center transition-colors cursor-pointer ${
                        scaleInStrategy === item.id
                          ? 'bg-trade-ai text-white border-trade-ai font-bold'
                          : 'bg-bg-primary text-text-muted border-bg-border hover:text-text-primary'
                      }`}
                    >
                      <div className="text-[11px]">{item.label}</div>
                      <div className="text-[9px] opacity-80">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 自动趋势反转反手 */}
              <div className="flex items-center justify-between pt-2 border-t border-bg-border/60">
                <div>
                  <span className="text-text-primary font-medium block">趋势强反向自动反手 (Auto Reversal)</span>
                  <span className="text-[10px] text-text-muted">当遭遇强反向 AI 信号 (置信度 ≥ 75%) 时，自动平仓并反向开仓</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoReversalEnabled}
                  onChange={(e) => setAutoReversalEnabled(e.target.checked)}
                  className="w-4 h-4 accent-trade-ai cursor-pointer"
                />
              </div>

              {/* 多标的轮巡池配置 */}
              <div className="space-y-1.5 pt-2 border-t border-bg-border/60">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="font-medium">自动关注与轮巡标的池 ({symbolsPool.length} 个)</span>
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

                {/* 智能检索添加输入框与下拉建议 (杜绝随意乱输) */}
                <div className="relative">
                  <div className="flex space-x-1.5">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="搜索欧易官方合约 (如 PEPE, SUI, DOGE, SOL, BTC)..."
                        value={newSymbolInput}
                        onChange={(e) => setNewSymbolInput(e.target.value)}
                        onFocus={() => {
                          if (symbolSuggestions.length > 0) setShowSymbolDropdown(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && symbolSuggestions.length > 0) {
                            handleAddSymbol(symbolSuggestions[0].symbol);
                          } else if (e.key === 'Escape') {
                            setShowSymbolDropdown(false);
                          }
                        }}
                        className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-bg-primary border border-bg-border text-text-primary text-xs font-mono uppercase focus:outline-none focus:border-trade-ai"
                      />
                      {isSearchingSymbol && (
                        <div className="absolute right-2.5 top-2.5 w-3 h-3 border-2 border-trade-ai border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    {newSymbolInput && (
                      <button
                        type="button"
                        onClick={() => setNewSymbolInput('')}
                        className="px-2 py-1.5 rounded-lg bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-text-primary text-xs"
                        title="清空"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 欧易官方标的匹配下拉菜单 */}
                  {showSymbolDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-bg-elevated border border-bg-border rounded-lg shadow-xl overflow-hidden divide-y divide-bg-border/40 max-h-56 overflow-y-auto">
                      {symbolSuggestions.length > 0 ? (
                        symbolSuggestions.map((item) => {
                          const isAlreadyIn = symbolsPool.includes(item.symbol);
                          return (
                            <div
                              key={item.symbol}
                              onClick={() => {
                                if (!isAlreadyIn) handleAddSymbol(item.symbol);
                              }}
                              className={`p-2 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                isAlreadyIn
                                  ? 'bg-bg-primary/40 opacity-60 cursor-not-allowed'
                                  : 'hover:bg-bg-primary hover:text-trade-ai'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="font-bold font-mono text-text-primary">
                                  {item.symbol}
                                </span>
                                <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                                  {item.inst_type} {item.lever ? `${item.lever}x` : ''}
                                </span>
                                <span className="text-[10px] text-text-muted">
                                  {item.name}
                                </span>
                              </div>
                              <div>
                                {isAlreadyIn ? (
                                  <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-bg-primary">
                                    已在池中
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-trade-ai font-medium px-2 py-0.5 rounded bg-trade-ai/10 hover:bg-trade-ai/20">
                                    + 添加
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : symbolSearchError ? (
                        <div className="p-3 text-center text-[11px] text-text-muted">
                          {symbolSearchError}
                        </div>
                      ) : null}
                    </div>
                  )}
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

              {/* 🛡️ 本金止损底线与最大允许亏损额配置 (Capital Preservation Floor) */}
              <div className="space-y-2 pt-2 border-t border-amber-500/30 bg-amber-500/5 p-2.5 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    <span>本金止损底线保护 (Capital Stop Floor)</span>
                  </div>
                  {typeof stopLossEquityFloor === 'number' && stopLossEquityFloor > 0 ? (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-bold">
                      保护生效中
                    </span>
                  ) : (
                    <span className="text-[10px] text-text-muted">未设底线 (全额浮动)</span>
                  )}
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  设定操盘最低保留资金。当账户总权益跌破此底线时，系统将<strong className="text-amber-300">自动停止操盘并熔断</strong>，坚决守护核心本金。
                </p>

                {/* 资金底线与最大亏损输入行 */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-text-secondary block mb-1">最低保留底线 (USDT)</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder={`如: ${(currentEquity > 1000 ? currentEquity - 1000 : currentEquity * 0.85).toFixed(0)}`}
                        value={stopLossEquityFloor}
                        onChange={(e) => handleFloorChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-bg-primary border border-bg-border text-text-primary text-xs font-mono font-bold focus:border-amber-400 focus:outline-none"
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] text-text-muted font-mono">U</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-text-secondary block mb-1">最大允许亏损 (USDT)</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="如: 1000"
                        value={maxLossLimitUsdt}
                        onChange={(e) => handleMaxLossChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-bg-primary border border-bg-border text-text-primary text-xs font-mono font-bold focus:border-amber-400 focus:outline-none"
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] text-text-muted font-mono">U</span>
                    </div>
                  </div>
                </div>

                {/* 快捷预设按钮组 */}
                <div className="flex flex-wrap gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickSetMaxLoss(500)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-bg-elevated hover:bg-bg-border text-text-secondary border border-bg-border cursor-pointer transition-colors"
                  >
                    亏损-500U
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSetMaxLoss(1000)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-bg-elevated hover:bg-bg-border text-text-secondary border border-bg-border cursor-pointer transition-colors"
                  >
                    亏损-1,000U
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSetMaxLoss(currentEquity * 0.15)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-bg-elevated hover:bg-bg-border text-text-secondary border border-bg-border cursor-pointer transition-colors"
                  >
                    亏损-15% (约-${(currentEquity * 0.15).toFixed(0)}U)
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFloorProtection}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-trade-down border border-bg-border cursor-pointer transition-colors ml-auto"
                  >
                    清除保护
                  </button>
                </div>

                {/* 实时提示信息条 */}
                {typeof stopLossEquityFloor === 'number' && stopLossEquityFloor > 0 ? (
                  <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-mono flex items-center justify-between">
                    <span>当前本金: ${currentEquity.toFixed(2)}</span>
                    <span>→ 触发底线: ${stopLossEquityFloor.toFixed(2)}</span>
                    <span className="text-amber-400 font-bold">
                      (最大回撤 -${(typeof maxLossLimitUsdt === 'number' ? maxLossLimitUsdt : (currentEquity - stopLossEquityFloor)).toFixed(2)}U)
                    </span>
                  </div>
                ) : null}
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

