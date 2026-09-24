/**
 * @file App.tsx
 * @description OKX-Dog 个人量化智能交易终端 - 主工作台
 * 极具金融质感的暗黑专业交易界面 (Sleek Dark Theme)
 * 整合 K 线图表、深度订单簿、实时逐笔成交、AI 智能副驾驶、下单控制台与持仓列表
 */

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Flame,
  AlertOctagon,
  Layers,
  Activity,
  ChevronDown,
  Clock,
  Radio,
  Bot,
  Sliders,
  Gamepad2,
  Coins,
  AlertTriangle,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { wsService } from './services/websocket';
import { marketApi, tradeApi, systemApi, aiApi, autoPilotApi, newsApi } from './services/api';
import { SecurityModal } from './components/SecurityModal';
import { PaperConfigModal } from './components/PaperConfigModal';
import { SymbolSelectorModal } from './components/SymbolSelectorModal';
import { BacktestModal } from './components/BacktestModal';
import { NewsFeedModal } from './components/NewsFeedModal';
import { DailyReviewModal } from './components/DailyReviewModal';
import { ConsensusModal } from './components/ConsensusModal';
import { QuantStudioModal } from './components/QuantStudioModal';
import { AgentTeamModal } from './components/AgentTeamModal';
import { OpsMetricsModal } from './components/OpsMetricsModal';
import { TradingChart } from './components/TradingChart';
import { OrderBook } from './components/OrderBook';
import { TradeList } from './components/TradeList';
import { AICopilotCard } from './components/AICopilotCard';
import { AutoPilotCard } from './components/AutoPilotCard';
import { PositionList } from './components/PositionList';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  getBaseCurrency,
  isTradFiSymbol,
  formatPrice,
} from './utils/symbolHelper';

export const App: React.FC = () => {
  const {
    isLiveMode,
    setLiveMode,
    apiKeyMasked,
    llmConfig,
    openSecurityModal,
    openPaperModal,
    isStudioModalOpen,
    openStudioModal,
    closeStudioModal,
    riskStatus,
    triggerPanicLock,
    resetRiskLock,
    circuitBreakReason,
    activeSymbol,
    setActiveSymbol,
    focusSymbols,
    focusMode,
    setFocusMode,
    removeFocusSymbol,
    focusTickers,
    updateFocusTicker,
    ticker,
    setTicker,
    setBalance,
    setPositions,
    setOrders,
    setIndicators,
    setAIAnalysis,
    setIsAiAnalyzing,
    setAutoPilotStatus,
    setAutoPilotHistory,
    balance,
  } = useAppStore();


  const [headerPanicConfirm, setHeaderPanicConfirm] = useState(false);
  const [rightTab, setRightTab] = useState<'orderbook' | 'trades'>('orderbook');
  const [isWsConnected, setIsWsConnected] = useState(true);
  const [isLiveConfirmModalOpen, setIsLiveConfirmModalOpen] = useState(false);
  const [liveMasterPassword, setLiveMasterPassword] = useState('');
  const [modeSwitchLoading, setModeSwitchLoading] = useState(false);
  const [modeSwitchError, setModeSwitchError] = useState<string | null>(null);

  const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);
  const [isBacktestModalOpen, setIsBacktestModalOpen] = useState(false);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [isDailyReviewModalOpen, setIsDailyReviewModalOpen] = useState(false);
  const [isConsensusModalOpen, setIsConsensusModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isOpsMetricsModalOpen, setIsOpsMetricsModalOpen] = useState(false);
  const [latestNewsSnippet, setLatestNewsSnippet] = useState<string>('【实时情报】全网主流加密与宏观资讯感知中枢就绪');

  // 定时刷新最新 1 条情报摘要
  useEffect(() => {
    const fetchNewsSnippet = () => {
      newsApi.getFeed(3)
        .then((res) => {
          if (res?.news && res.news.length > 0) {
            const first = res.news[0];
            const prefix = first.urgency === 'P0' ? '🚨 [突发黑天鹅] ' : first.urgency === 'P1' ? '⚡ [重要情报] ' : '📰 [宏观情报] ';
            setLatestNewsSnippet(`${prefix}${first.title}`);
          }
        })
        .catch(() => {});
    };
    fetchNewsSnippet();
    const timer = setInterval(fetchNewsSnippet, 15000);
    return () => clearInterval(timer);
  }, []);

  // 快捷键支持 (Ctrl+P / Cmd+P 打开标的搜索弹窗)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsSymbolModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. 全局 WebSocket 连接建立与基础账户频道常驻监听
  useEffect(() => {
    wsService.connect();

    const handlePositions = (payload: any) => {
      if (payload.data) setPositions(payload.data as any);
    };
    const handleAccount = (payload: any) => {
      if (payload.data) setBalance(payload.data as any);
    };
    const handleOrders = (payload: any) => {
      if (payload.data) {
        tradeApi.getOrders().then((ordList) => setOrders(Array.isArray(ordList) ? ordList : [])).catch(() => {});
      }
    };

    wsService.subscribe('positions', handlePositions);
    wsService.subscribe('account', handleAccount);
    wsService.subscribe('orders', handleOrders);

    const checkTimer = setInterval(() => {
      setIsWsConnected(wsService.getStatus());
    }, 3000);

    return () => {
      clearInterval(checkTimer);
      wsService.unsubscribe('positions', handlePositions);
      wsService.unsubscribe('account', handleAccount);
      wsService.unsubscribe('orders', handleOrders);
      wsService.disconnect();
    };
  }, [setPositions, setBalance, setOrders]);

  // 1.1 动态标的行情订阅 (仅更新频道，不断开底层连接)
  useEffect(() => {
    const handleActiveTicker = (payload: any) => {
      if (payload.data && (!payload.data.symbol || payload.data.symbol === activeSymbol)) {
        setTicker(payload.data as any);
      }
    };
    wsService.subscribe(`ticker:${activeSymbol}`, handleActiveTicker);

    const focusHandlers: Record<string, (payload: any) => void> = {};
    focusSymbols.forEach((sym) => {
      const handler = (payload: any) => {
        if (payload.data && (!payload.data.symbol || payload.data.symbol === sym)) {
          updateFocusTicker(payload.data as any);
        }
      };
      focusHandlers[sym] = handler;
      wsService.subscribe(`ticker:${sym}`, handler);
    });

    // 通知后端订阅专注标的
    marketApi.subscribeFocus(focusSymbols).catch(() => {});

    return () => {
      wsService.unsubscribe(`ticker:${activeSymbol}`, handleActiveTicker);
      Object.entries(focusHandlers).forEach(([sym, handler]) => {
        wsService.unsubscribe(`ticker:${sym}`, handler);
      });
    };
  }, [activeSymbol, focusSymbols.join(','), setTicker, updateFocusTicker]);

  // 2. 初始化与模式切换时拉取账户资产、最新行情、多周期指标与实时 AI 研判
  useEffect(() => {
    let isMounted = true;
    const currentSymbol = activeSymbol;

    const initData = async () => {
      try {
        setIsAiAnalyzing(true);
        const [tk, bal, pos, ord, ind, ai] = await Promise.allSettled([
          marketApi.getTicker(activeSymbol),
          tradeApi.getAccountBalance(),
          tradeApi.getPositions(),
          tradeApi.getOrders(activeSymbol),
          marketApi.getIndicators(activeSymbol),
          aiApi.triggerAnalysis({ symbol: activeSymbol, timeframe: '1h' }),
        ]);

        if (!isMounted) return;

        if (tk.status === 'fulfilled' && tk.value && tk.value.symbol === currentSymbol) {
          setTicker(tk.value);
        }
        if (bal.status === 'fulfilled') setBalance(bal.value);
        if (pos.status === 'fulfilled') setPositions(Array.isArray(pos.value) ? pos.value : []);
        if (ord.status === 'fulfilled') setOrders(Array.isArray(ord.value) ? ord.value : []);
        if (ind.status === 'fulfilled' && ind.value && ind.value.symbol === currentSymbol) {
          setIndicators(ind.value);
        }
        if (ai.status === 'fulfilled' && ai.value && ai.value.symbol === currentSymbol) {
          setAIAnalysis(ai.value);
        }
      } catch (err) {
        console.warn('初始化数据拉取异常:', err);
      } finally {
        if (isMounted) setIsAiAnalyzing(false);
      }
    };

    initData();
    return () => {
      isMounted = false;
    };
  }, [activeSymbol, isLiveMode, setTicker, setBalance, setPositions, setOrders, setIndicators, setAIAnalysis, setIsAiAnalyzing]);

  // 3. 定时主动轮询账户资产 (每 5 秒)，保障即便在长连接空闲期实盘资产也 100% 准确同步
  useEffect(() => {
    const balanceTimer = setInterval(() => {
      tradeApi.getAccountBalance()
        .then((bal) => {
          if (bal) setBalance(bal);
        })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(balanceTimer);
  }, [isLiveMode, setBalance]);

  // 切换单标的专注模式 vs 多标的池模式
  const handleToggleFocusMode = async () => {
    const nextMode = focusMode === 'SINGLE_SYMBOL' ? 'MULTI_SYMBOL_POOL' : 'SINGLE_SYMBOL';
    setFocusMode(nextMode);
    try {
      await autoPilotApi.updateConfig({
        focus_mode: nextMode,
        symbol: activeSymbol,
        focus_symbols: focusSymbols,
      });
    } catch (err) {
      console.warn('更新自动操盘模式失败:', err);
    }
  };

  // 顶部 Panic 快捷全平点击
  const handleHeaderPanic = () => {
    if (!headerPanicConfirm) {
      setHeaderPanicConfirm(true);
      setTimeout(() => setHeaderPanicConfirm(false), 4000);
    } else {
      triggerPanicLock('交易员点击顶部 Panic Button 触发紧急避险');
      setHeaderPanicConfirm(false);
    }
  };

  // 模式切换处理
  const handleToggleModeClick = () => {
    if (!isLiveMode) {
      setIsLiveConfirmModalOpen(true);
      setModeSwitchError(null);
      setLiveMasterPassword('');
    } else {
      handleSwitchToDemo();
    }
  };

  const handleSwitchToDemo = async () => {
    setModeSwitchLoading(true);
    setPositions([]);
    setOrders([]);
    try {
      await systemApi.switchMode(false);
      setLiveMode(false);
      const [bal, pos, ord, apStatus, apHistory] = await Promise.allSettled([
        tradeApi.getAccountBalance(),
        tradeApi.getPositions(),
        tradeApi.getOrders(),
        autoPilotApi.getStatus(),
        autoPilotApi.getHistory(),
      ]);
      if (bal.status === 'fulfilled') setBalance(bal.value);
      if (pos.status === 'fulfilled') setPositions(Array.isArray(pos.value) ? pos.value : []);
      if (ord.status === 'fulfilled') setOrders(Array.isArray(ord.value) ? ord.value : []);
      if (apStatus.status === 'fulfilled' && apStatus.value) setAutoPilotStatus(apStatus.value);
      if (apHistory.status === 'fulfilled' && apHistory.value) setAutoPilotHistory(apHistory.value);
    } catch (err) {
      console.warn('切换到模拟模式异常:', err);
    } finally {
      setModeSwitchLoading(false);
    }
  };

  const handleConfirmSwitchToLive = async () => {
    setModeSwitchLoading(true);
    setModeSwitchError(null);
    setPositions([]);
    setOrders([]);
    try {
      await systemApi.switchMode(true, liveMasterPassword);
      setLiveMode(true);
      setIsLiveConfirmModalOpen(false);
      setLiveMasterPassword('');
      const [bal, pos, ord, apStatus, apHistory] = await Promise.allSettled([
        tradeApi.getAccountBalance(),
        tradeApi.getPositions(),
        tradeApi.getOrders(),
        autoPilotApi.getStatus(),
        autoPilotApi.getHistory(),
      ]);
      if (bal.status === 'fulfilled') setBalance(bal.value);
      if (pos.status === 'fulfilled') setPositions(Array.isArray(pos.value) ? pos.value : []);
      if (ord.status === 'fulfilled') setOrders(Array.isArray(ord.value) ? ord.value : []);
      if (apStatus.status === 'fulfilled' && apStatus.value) setAutoPilotStatus(apStatus.value);
      if (apHistory.status === 'fulfilled' && apHistory.value) setAutoPilotHistory(apHistory.value);
    } catch (err: any) {
      setModeSwitchError(err.message || '切换至实盘模式失败，请检查主密码');
    } finally {
      setModeSwitchLoading(false);
    }
  };


  return (
    <div className="flex h-screen w-screen flex-col bg-bg-primary text-text-primary overflow-hidden font-sans select-none">
      {/* 1. 顶部全局金融级导航与行情状态栏 */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-bg-border bg-bg-secondary px-3">
        {/* 左侧：Logo & Focus Bar 专注标的栏 & 24h 实时行情 */}
        <div className="flex items-center space-x-3 overflow-hidden">
          {/* Logo */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-trade-ai to-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-trade-ai/20 text-sm">
              🐕
            </div>
            <span className="font-bold text-xs tracking-tight text-text-primary hidden sm:inline">
              OKX-Dog
            </span>
          </div>

          <div className="h-4 w-px bg-bg-border shrink-0" />

          {/* 标的选择器入口 */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => setIsSymbolModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-bg-elevated border border-bg-border hover:border-trade-ai transition-all text-xs group cursor-pointer shadow-sm"
              title="点击打开全景标的与 TradFi 探索 (Ctrl+P / Cmd+P)"
            >
              <Search className="w-3.5 h-3.5 text-text-muted group-hover:text-trade-ai transition-colors" />
              <span className="font-bold font-mono text-text-primary">{activeSymbol}</span>
              {isTradFiSymbol(activeSymbol) ? (
                <span className="rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-0.2 text-[9px] font-medium">
                  TradFi
                </span>
              ) : (
                <span className="rounded bg-trade-ai/20 text-trade-ai px-1 py-0.2 text-[9px] font-mono">
                  永续
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-text-muted group-hover:text-text-primary transition-colors" />
            </button>
          </div>

          {/* 🎯 交互式 Focus Bar 专注标的栏 */}
          <div className="hidden md:flex items-center space-x-1.5 pl-1 overflow-x-auto no-scrollbar py-0.5">
            {/* 专注模式切换胶囊 */}
            <button
              onClick={handleToggleFocusMode}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                focusMode === 'SINGLE_SYMBOL'
                  ? 'bg-purple-950/60 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-900/20'
                  : 'bg-blue-950/60 text-blue-300 border-blue-500/40'
              }`}
              title="点击切换量化专注模式：单标的深度加仓量化 vs 多标的池轮巡"
            >
              <span>{focusMode === 'SINGLE_SYMBOL' ? '🎯 单币专注' : '🌐 组合池'}</span>
            </button>

            {/* 专注标的列表 Pills */}
            {focusSymbols.map((sym) => {
              const isCur = activeSymbol === sym;
              const isTradFi = isTradFiSymbol(sym);
              const symTicker = focusTickers[sym] || (isCur ? ticker : null);
              const chg = symTicker?.change_24h_pct;
              const lastPx = symTicker?.last_price;

              return (
                <div
                  key={sym}
                  className={`group relative flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-mono transition-all border cursor-pointer ${
                    isCur
                      ? 'bg-trade-ai/20 text-white font-bold border-trade-ai shadow-sm shadow-trade-ai/20'
                      : 'bg-bg-elevated/80 text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-bg-border/60'
                  }`}
                  onClick={() => setActiveSymbol(sym)}
                  title={`点击切换至 ${sym}`}
                >
                  <span>{isTradFi ? '🏛️' : '🪙'}</span>
                  <span>{getBaseCurrency(sym)}</span>
                  {lastPx !== undefined && (
                    <span className="text-[10px] text-text-muted hidden xl:inline">
                      ${formatPrice(lastPx, sym)}
                    </span>
                  )}
                  {chg !== undefined && (
                    <span
                      className={`text-[9px] font-semibold ${
                        chg >= 0 ? 'text-trade-up' : 'text-trade-down'
                      }`}
                    >
                      {chg >= 0 ? '+' : ''}
                      {chg.toFixed(1)}%
                    </span>
                  )}
                  {focusSymbols.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFocusSymbol(sym);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 ml-0.5 transition-opacity"
                      title="移出关注池"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {/* 快速添加专注标的按钮 */}
            <button
              onClick={() => setIsSymbolModalOpen(true)}
              className="flex items-center justify-center w-5 h-5 rounded-lg bg-bg-elevated/60 hover:bg-trade-ai/20 hover:text-trade-ai text-text-muted border border-bg-border text-xs transition cursor-pointer"
              title="添加更多专注标的 (TradFi / 加密资产)"
            >
              +
            </button>
          </div>

          {/* 24h Ticker 行情滚动条 */}
          {ticker && (
            <div className="hidden lg:flex items-center space-x-4 text-xs font-mono-num pl-1">
              <div>
                <span
                  className={`text-sm font-bold ${
                    (ticker.change_24h_pct ?? 0) >= 0 ? 'text-trade-up' : 'text-trade-down'
                  }`}
                >
                  ${formatPrice(ticker.last_price, activeSymbol)}
                </span>
                <span
                  className={`ml-1 text-[11px] font-medium ${
                    (ticker.change_24h_pct ?? 0) >= 0 ? 'text-trade-up' : 'text-trade-down'
                  }`}
                >
                  {(ticker.change_24h_pct ?? 0) >= 0 ? '+' : ''}
                  {(ticker.change_24h_pct ?? 0).toFixed(2)}%
                </span>
              </div>

              <div className="hidden xl:flex items-center space-x-3 text-[11px] text-text-muted">
                <span>
                  高: <span className="text-text-primary">${formatPrice(ticker.high_24h, activeSymbol)}</span>
                </span>
                <span>
                  低: <span className="text-text-primary">${formatPrice(ticker.low_24h, activeSymbol)}</span>
                </span>
                <span>
                  24h量: <span className="text-text-primary">{(ticker.volume_24h ?? 0).toLocaleString()}</span>
                </span>
                {ticker.funding_rate !== undefined && (
                  <span className="flex items-center text-text-secondary">
                    <Clock className="w-3 h-3 mr-1 text-trade-ai" />
                    费率: {((ticker.funding_rate ?? 0.0001) * 100).toFixed(4)}%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 中间：环境模式切换与风控守卫状态胶囊 */}
        <div className="flex items-center space-x-2">
          {/* 实盘 / 沙盒切换控制 */}
          <div className="flex items-center bg-bg-elevated p-0.5 rounded-lg border border-bg-border">
            <button
              type="button"
              onClick={() => {
                if (isLiveMode) handleSwitchToDemo();
              }}
              className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                !isLiveMode
                  ? 'bg-trade-ai text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 mr-0.5" />
              <span>模拟操盘 (DEMO)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isLiveMode) handleToggleModeClick();
              }}
              className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                isLiveMode
                  ? 'bg-trade-up text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full mr-1 bg-current animate-pulse" />
              <span>真实实盘 (LIVE)</span>
            </button>
          </div>

          {/* 模拟操盘模式专属：初始资金配置入口 */}
          {!isLiveMode && (
            <button
              type="button"
              onClick={openPaperModal}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 transition-all cursor-pointer"
              title="配置模拟初始资金与查看胜率"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>模拟资金配置</span>
            </button>
          )}

          {/* 硬风控状态 */}
          {riskStatus === 'NORMAL' ? (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-bg-elevated text-text-secondary border border-bg-border">
              <ShieldCheck className="w-3 h-3 mr-1 text-trade-up" />
              硬风控守卫中
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-trade-down/20 text-trade-down border border-trade-down animate-pulse">
              <AlertOctagon className="w-3 h-3 mr-1" />
              硬风控熔断锁死
            </span>
          )}

          {/* 运维监控与对账中枢指示胶囊 (点击开启运维大屏) */}
          <button
            type="button"
            onClick={() => setIsOpsMetricsModalOpen(true)}
            className="hidden xl:flex items-center space-x-2 px-3 py-1 rounded-lg text-[11px] font-medium bg-bg-elevated hover:bg-bg-elevated/80 border border-bg-border hover:border-trade-ai/40 text-text-secondary hover:text-text-primary transition cursor-pointer shadow-xs"
            title="点击查看底层网络延迟、手续费节省率与账本对账详情"
          >
            <Radio
              className={`w-3 h-3 ${
                isWsConnected ? 'text-trade-up animate-pulse' : 'text-trade-warning'
              }`}
            />
            <span className="font-mono-num">{isWsConnected ? '🟢 网络极速' : '重连中'}</span>
            <span className="text-bg-border">|</span>
            <span className="text-amber-400 font-semibold" title="Smart Pegging 自动贴盘挂单，省 60%+ 交易手续费">⚡ 贴盘省手续费 (100%)</span>
            <span className="text-bg-border">|</span>
            <span className="text-emerald-400 flex items-center gap-1" title="每 60 秒自动与 OKX 账户核验对账，消除幽灵持仓">
              <CheckCircle2 className="w-3 h-3" /> 账本自动同步
            </span>
          </button>
        </div>

        {/* 顶部中央：实时宏观与加密异动情报动态滚动胶囊 */}
        <div 
          onClick={() => setIsNewsModalOpen(true)}
          className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-300 text-xs font-medium max-w-[360px] truncate cursor-pointer transition-all hover:scale-[1.01] shadow-sm shadow-blue-500/5"
          title="点击查看全网宏观情报与突发快讯流"
        >
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping shrink-0" />
          <span className="truncate">{latestNewsSnippet}</span>
        </div>

        {/* 右侧：极简快捷工具组、凭证设置、大模型配置与 Panic Button */}
        <div className="flex items-center space-x-1.5">
          {/* 核心快捷工具组 (极简收纳，去除不必要的专业干扰) */}
          <div className="flex items-center space-x-1 border-r border-bg-border pr-1.5">
            <button
              onClick={() => setIsTeamModalOpen(true)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-950/60 to-purple-950/60 hover:from-indigo-900/80 hover:to-purple-900/80 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-semibold transition cursor-pointer shadow-sm shadow-indigo-500/10"
              title="AI 决策层员工档案与实战带单战绩"
            >
              <span>👥 AI 员工</span>
            </button>

            {/* 更多高级工具折叠菜单 (回测、复盘、博弈等专业功能收拢，避免界面杂乱) */}
            <div className="relative group">
              <button
                type="button"
                className="flex items-center space-x-0.5 px-2 py-1 rounded bg-bg-elevated hover:bg-bg-border text-text-muted hover:text-text-primary text-xs font-medium border border-bg-border transition cursor-pointer"
                title="专业投研与扩展工具箱"
              >
                <span>更多工具</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-bg-panel border border-bg-border shadow-xl p-1 hidden group-hover:flex flex-col space-y-0.5 z-50">
                <button
                  onClick={() => setIsBacktestModalOpen(true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-emerald-400 hover:bg-emerald-950/30 flex items-center space-x-2 transition"
                >
                  <span>📊 历史回测</span>
                </button>
                <button
                  onClick={() => setIsDailyReviewModalOpen(true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-purple-400 hover:bg-purple-950/30 flex items-center space-x-2 transition"
                >
                  <span>📖 每日复盘</span>
                </button>
                <button
                  onClick={() => setIsConsensusModalOpen(true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-indigo-400 hover:bg-indigo-950/30 flex items-center space-x-2 transition"
                >
                  <span>🤖 多模型博弈</span>
                </button>
                <button
                  onClick={openStudioModal}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-cyan-400 hover:bg-cyan-950/30 flex items-center space-x-2 transition"
                >
                  <span>✨ 策略实验室</span>
                </button>
                <button
                  onClick={() => setIsNewsModalOpen(true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-blue-400 hover:bg-blue-950/30 flex items-center space-x-2 transition"
                >
                  <span>📰 全球情报</span>
                </button>
              </div>
            </div>
          </div>

          {/* OKX 凭证配置按钮 */}
          <button
            onClick={() => openSecurityModal('okx')}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium bg-bg-elevated hover:bg-bg-border text-text-primary border border-bg-border transition-colors cursor-pointer"
            title="点击管理 OKX API Key"
          >
            <Lock className="w-3 h-3 text-trade-up" />
            <span className="hidden sm:inline font-mono text-trade-up font-bold">
              {apiKeyMasked || '未配置'}
            </span>
          </button>

          {/* 大模型配置按钮 */}
          <button
            onClick={() => openSecurityModal('llm')}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium bg-bg-elevated hover:bg-bg-border text-text-primary border border-bg-border transition-colors cursor-pointer"
            title="点击管理大模型 API 与模型参数"
          >
            <Bot className="w-3 h-3 text-trade-ai" />
            <span className="hidden sm:inline font-mono text-trade-ai font-bold truncate max-w-[80px]">
              {llmConfig?.llm_model || 'DeepSeek'}
            </span>
          </button>

          {/* 硬风控安全锁按钮 */}
          <button
            onClick={() => openSecurityModal('risk')}
            className="hidden md:flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium bg-bg-elevated hover:bg-bg-border text-text-secondary hover:text-text-primary border border-bg-border transition-colors cursor-pointer"
            title="点击调整硬风控参数"
          >
            <Sliders className="w-3 h-3 text-trade-warning" />
          </button>

          {/* 顶部 Panic Button 快捷熔断 */}
          <button
            onClick={handleHeaderPanic}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer ${
              headerPanicConfirm
                ? 'bg-trade-down text-white ring-2 ring-red-400 animate-bounce'
                : 'bg-red-500/10 hover:bg-trade-down text-trade-down hover:text-white border border-red-500/30'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{headerPanicConfirm ? '再次点击确认全平！' : 'PANIC'}</span>
          </button>
        </div>
      </header>

      {/* 2. 熔断警报横幅 (触发时显示) */}
      {riskStatus === 'PANIC_LOCKED' && (
        <div className="bg-trade-down/20 border-b border-trade-down px-4 py-2 flex items-center justify-between text-xs text-trade-down font-medium">
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              【紧急风控锁死】系统已触发全平熔断保护：{circuitBreakReason || '异常避险'}。所有开仓已被物理锁死。
            </span>
          </div>
          <button
            onClick={resetRiskLock}
            className="px-2.5 py-0.5 rounded bg-trade-down text-white text-[10px] font-bold hover:bg-red-700 transition-colors"
          >
            解除熔断锁死
          </button>
        </div>
      )}

      {/* 3. 核心交易工作台网格主体 (三栏金融级终端布局) */}
      <main className="flex-1 grid grid-cols-12 gap-2 p-2 overflow-hidden">
        
        {/* 左栏 (3列 / 宽 25%)：资产概览与下单控制台 */}
        <section className="col-span-12 md:col-span-4 lg:col-span-3 flex flex-col space-y-2 overflow-hidden">
          {/* 资产看板微卡 */}
          {(() => {
            const totalEquity = balance?.total_equity_usdt !== undefined && balance.total_equity_usdt !== null
              ? balance.total_equity_usdt
              : (isLiveMode ? 0.0 : 10000.0);
            const todayRealized = balance?.today_realized_pnl_usdt ?? 0.0;
            const upl = balance?.unrealized_pnl_usdt ?? 0.0;
            const todayPnl = todayRealized + upl;
            const todayRatio = balance?.today_pnl_ratio !== undefined
              ? balance.today_pnl_ratio * 100
              : (totalEquity > 0 ? (todayPnl / totalEquity) * 100 : 0.0);
            const isPnlPositive = todayPnl >= 0;
            const availMargin = balance?.available_margin_usdt !== undefined && balance.available_margin_usdt !== null
              ? balance.available_margin_usdt
              : (isLiveMode ? 0.0 : 10000.0);
            const usedMargin = balance?.used_margin_usdt ?? 0.0;

            return (
              <div className="rounded-lg border border-bg-border bg-bg-secondary p-3 flex flex-col shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-semibold text-text-muted">
                      {isLiveMode ? 'OKX 实盘账户总权益' : '模拟操盘沙盒总权益'} (USDT)
                    </span>
                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-medium ${isLiveMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                      {isLiveMode ? '实盘' : '模拟'}
                    </span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${balance?.is_warning_margin ? 'bg-trade-down/20 text-trade-down border border-trade-down/40' : 'bg-trade-up/15 text-trade-up'}`}>
                    {balance?.is_warning_margin ? '保证金警告' : '风控安全'}
                  </span>
                </div>
                <div className="font-mono-num text-2xl font-bold text-text-primary">
                  ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-bg-border/60 font-mono-num">
                  <div>
                    <span className="text-text-muted text-[10px] block">今日综合盈亏:</span>
                    <span className={`font-semibold ${isPnlPositive ? 'text-trade-up' : 'text-trade-down'}`}>
                      {isPnlPositive ? '+' : ''}${todayPnl.toFixed(2)} ({isPnlPositive ? '+' : ''}{todayRatio.toFixed(2)}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] block">持仓浮动盈亏:</span>
                    <span className={`font-semibold ${upl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                      {upl >= 0 ? '+' : ''}${upl.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-bg-border/40 text-text-muted font-mono-num">
                  <span>可用: <span className="text-text-primary font-semibold">${availMargin.toFixed(2)}</span></span>
                  <span>占用: <span className="text-text-secondary font-semibold">${usedMargin.toFixed(2)}</span></span>
                </div>
              </div>
            );
          })()}



          {/* AI 全自动量化操盘控制与收益中枢 */}
          <div className="flex-1 overflow-hidden">
            <ErrorBoundary fallbackTitle="自动量化操盘控制面板加载异常">
              <AutoPilotCard />
            </ErrorBoundary>
          </div>
        </section>

        {/* 中栏 (6列 / 宽 50%)：K 线图表与持仓列表 */}
        <section className="col-span-12 md:col-span-8 lg:col-span-6 flex flex-col space-y-2 overflow-hidden">
          {/* 上半部：TradingView Lightweight Charts K 线主图 */}
          <div className="h-[58%] min-h-[320px]">
            <ErrorBoundary fallbackTitle="K 线图表组件加载异常">
              <TradingChart />
            </ErrorBoundary>
          </div>

          {/* 下半部：实时活跃持仓与委托列表 */}
          <div className="flex-1 min-h-[200px]">
            <ErrorBoundary fallbackTitle="持仓委托列表加载异常">
              <PositionList />
            </ErrorBoundary>
          </div>
        </section>

        {/* 右栏 (3列 / 宽 25%)：订单簿/成交流与 AI 智能副驾驶卡片 */}
        <section className="col-span-12 md:col-span-12 lg:col-span-3 flex flex-col space-y-2 overflow-hidden">
          {/* 上半部：盘口深度与成交记录 (带 Tab 切换) */}
          <div className="h-[46%] min-h-[240px] flex flex-col rounded-lg border border-bg-border bg-bg-secondary overflow-hidden">
            <div className="flex items-center justify-between px-2 pt-1 border-b border-bg-border bg-bg-secondary">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setRightTab('orderbook')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition-colors ${
                    rightTab === 'orderbook'
                      ? 'bg-bg-elevated text-text-primary border border-bg-border'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Layers className="w-3 h-3 text-trade-ai" />
                  <span>深度盘口</span>
                </button>
                <button
                  onClick={() => setRightTab('trades')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition-colors ${
                    rightTab === 'trades'
                      ? 'bg-bg-elevated text-text-primary border border-bg-border'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Activity className="w-3 h-3 text-trade-up" />
                  <span>逐笔成交</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <ErrorBoundary fallbackTitle="盘口与成交流加载异常">
                {rightTab === 'orderbook' ? <OrderBook /> : <TradeList />}
              </ErrorBoundary>
            </div>
          </div>

          {/* 下半部：AI 智能副驾驶决策卡片 */}
          <div className="flex-1 min-h-[280px]">
            <ErrorBoundary fallbackTitle="AI 副驾驶决策卡片加载异常">
              <AICopilotCard />
            </ErrorBoundary>
          </div>
        </section>

      </main>

      {/* 凭证配置弹窗 */}
      <ErrorBoundary fallbackTitle="安全配置弹窗加载异常">
        <SecurityModal />
      </ErrorBoundary>

      {/* 模拟操盘沙盒配置与战绩弹窗 */}
      <ErrorBoundary fallbackTitle="模拟操盘配置弹窗加载异常">
        <PaperConfigModal />
      </ErrorBoundary>

      {/* 全景标的检索与 TradFi 探索切换弹窗 */}
      <SymbolSelectorModal
        isOpen={isSymbolModalOpen}
        onClose={() => setIsSymbolModalOpen(false)}
        onSelectSymbol={(sym) => setActiveSymbol(sym)}
      />

      {/* 切换至真实实盘二次安全确认模态框 */}
      {isLiveConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
          <div className="relative w-full max-w-md rounded-xl border border-red-500/40 bg-bg-secondary shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center space-x-3 text-red-500">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">切换为【真实实盘 (LIVE)】模式</h3>
                <p className="text-[11px] text-text-muted">警告：接下来的所有交易委托都将真实触达 OKX 交易所扣减真金白银</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300 leading-relaxed">
              ⚠️ 请确认您已在安全密盒中正确配置并验证了 OKX 实盘 API Key。若需要切换，请输入主保护密码以解密安全密盒：
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-text-secondary font-medium">主保护密码 (Master Password)</label>
              <input
                type="password"
                value={liveMasterPassword}
                onChange={(e) => setLiveMasterPassword(e.target.value)}
                placeholder="请输入用于解密密盒的主密码"
                className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-bg-border text-text-primary text-xs font-mono focus:outline-none focus:border-red-500"
              />
            </div>

            {modeSwitchError && (
              <div className="p-2.5 rounded bg-trade-down/15 border border-trade-down/30 text-trade-down text-xs">
                {modeSwitchError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLiveConfirmModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-text-secondary bg-bg-elevated hover:bg-bg-border transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitchToLive}
                disabled={modeSwitchLoading || !liveMasterPassword}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors shadow-lg shadow-red-600/25 cursor-pointer"
              >
                {modeSwitchLoading ? '验证中...' : '确认开启实盘'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. v3.0 核心全景模态窗挂载 */}
      <BacktestModal
        isOpen={isBacktestModalOpen}
        onClose={() => setIsBacktestModalOpen(false)}
        defaultSymbol={activeSymbol}
      />
      <NewsFeedModal
        isOpen={isNewsModalOpen}
        onClose={() => setIsNewsModalOpen(false)}
      />
      <DailyReviewModal
        isOpen={isDailyReviewModalOpen}
        onClose={() => setIsDailyReviewModalOpen(false)}
      />
      <ConsensusModal
        isOpen={isConsensusModalOpen}
        onClose={() => setIsConsensusModalOpen(false)}
        activeSymbol={activeSymbol}
      />
      {/* 9. v3.5 AI Quant Studio 策略实验室模态窗挂载 */}
      <QuantStudioModal
        isOpen={isStudioModalOpen}
        onClose={closeStudioModal}
      />
      {/* 10. v3.6 AI 决策员工看板模态窗挂载 */}
      <AgentTeamModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
      />
      {/* 11. 极简量化运维监控看板与对账中心模态窗挂载 */}
      <OpsMetricsModal
        isOpen={isOpsMetricsModalOpen}
        onClose={() => setIsOpsMetricsModalOpen(false)}
      />
    </div>
  );
};
export default App;

