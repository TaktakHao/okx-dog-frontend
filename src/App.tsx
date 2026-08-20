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
} from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { wsService } from './services/websocket';
import { marketApi, tradeApi, systemApi, aiApi } from './services/api';
import { SecurityModal } from './components/SecurityModal';
import { PaperConfigModal } from './components/PaperConfigModal';
import { TradingChart } from './components/TradingChart';
import { OrderBook } from './components/OrderBook';
import { TradeList } from './components/TradeList';
import { AICopilotCard } from './components/AICopilotCard';
import { OrderForm } from './components/OrderForm';
import { PositionList } from './components/PositionList';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  const {
    isLiveMode,
    setLiveMode,
    apiKeyMasked,
    llmConfig,
    openSecurityModal,
    openPaperModal,
    riskStatus,
    triggerPanicLock,
    resetRiskLock,
    circuitBreakReason,
    activeSymbol,
    setActiveSymbol,
    ticker,
    setTicker,
    setBalance,
    setPositions,
    setOrders,
    setIndicators,
    setAIAnalysis,
    setIsAiAnalyzing,
    balance,
  } = useAppStore();


  const [headerPanicConfirm, setHeaderPanicConfirm] = useState(false);
  const [rightTab, setRightTab] = useState<'orderbook' | 'trades'>('orderbook');
  const [isWsConnected, setIsWsConnected] = useState(true);
  const [isLiveConfirmModalOpen, setIsLiveConfirmModalOpen] = useState(false);
  const [liveMasterPassword, setLiveMasterPassword] = useState('');
  const [modeSwitchLoading, setModeSwitchLoading] = useState(false);
  const [modeSwitchError, setModeSwitchError] = useState<string | null>(null);

  const availableSymbols = [
    'BTC-USDT-SWAP',
    'ETH-USDT-SWAP',
    'SOL-USDT-SWAP',
    'DOGE-USDT-SWAP',
  ];

  // 1. 初始化 WebSocket 连接与全局推流订阅
  useEffect(() => {
    wsService.connect();

    // 订阅全局行情、持仓、资产与订单私有频道
    wsService.subscribe(`ticker:${activeSymbol}`, (payload) => {
      if (payload.data) setTicker(payload.data as any);
    });

    wsService.subscribe('positions', (payload) => {
      if (payload.data) setPositions(payload.data as any);
    });

    wsService.subscribe('account', (payload) => {
      if (payload.data) setBalance(payload.data as any);
    });

    wsService.subscribe('orders', (payload) => {
      if (payload.data) {
        tradeApi.getOrders().then((ordList) => setOrders(Array.isArray(ordList) ? ordList : [])).catch(() => {});
      }
    });

    // 监听网络连通状态
    const checkTimer = setInterval(() => {
      setIsWsConnected(wsService.getStatus());
    }, 3000);

    return () => {
      clearInterval(checkTimer);
      wsService.disconnect();
    };
  }, [activeSymbol, setTicker, setPositions, setBalance, setOrders]);

  // 2. 初始化拉取账户资产、最新行情、多周期指标与实时 AI 研判
  useEffect(() => {
    let isMounted = true;
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

        if (tk.status === 'fulfilled') setTicker(tk.value);
        if (bal.status === 'fulfilled') setBalance(bal.value);
        if (pos.status === 'fulfilled') setPositions(pos.value);
        if (ord.status === 'fulfilled') setOrders(ord.value);
        if (ind.status === 'fulfilled') setIndicators(ind.value);
        if (ai.status === 'fulfilled') setAIAnalysis(ai.value);
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
  }, [activeSymbol, setTicker, setBalance, setPositions, setOrders, setIndicators, setAIAnalysis, setIsAiAnalyzing]);

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
      const [bal, pos, ord] = await Promise.allSettled([
        tradeApi.getAccountBalance(),
        tradeApi.getPositions(),
        tradeApi.getOrders(),
      ]);
      if (bal.status === 'fulfilled') setBalance(bal.value);
      if (pos.status === 'fulfilled') setPositions(Array.isArray(pos.value) ? pos.value : []);
      if (ord.status === 'fulfilled') setOrders(Array.isArray(ord.value) ? ord.value : []);
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
      const [bal, pos, ord] = await Promise.allSettled([
        tradeApi.getAccountBalance(),
        tradeApi.getPositions(),
        tradeApi.getOrders(),
      ]);
      if (bal.status === 'fulfilled') setBalance(bal.value);
      if (pos.status === 'fulfilled') setPositions(Array.isArray(pos.value) ? pos.value : []);
      if (ord.status === 'fulfilled') setOrders(Array.isArray(ord.value) ? ord.value : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '切换失败';
      setModeSwitchError(msg);
    } finally {
      setModeSwitchLoading(false);
    }
  };


  return (
    <div className="flex h-screen w-screen flex-col bg-bg-primary text-text-primary overflow-hidden font-sans select-none">
      {/* 1. 顶部全局金融级导航与行情状态栏 */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-bg-border bg-bg-secondary px-3">
        {/* 左侧：Logo & 标的切换 & 24h 实时行情 */}
        <div className="flex items-center space-x-3">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-trade-ai to-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-trade-ai/20 text-sm">
              🐕
            </div>
            <span className="font-bold text-xs tracking-tight text-text-primary hidden sm:inline">
              OKX-Dog
            </span>
          </div>

          <div className="h-4 w-px bg-bg-border" />

          {/* 标的选择下拉 */}
          <div className="relative group">
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-bg-elevated border border-bg-border cursor-pointer hover:border-trade-ai transition-colors">
              <span className="font-bold text-xs text-text-primary">{activeSymbol}</span>
              <span className="rounded bg-trade-ai/20 text-trade-ai px-1 py-0.2 text-[9px] font-mono">永续</span>
              <ChevronDown className="w-3 h-3 text-text-muted" />
            </div>

            {/* 下拉菜单 */}
            <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 w-44 rounded-lg border border-bg-border bg-bg-secondary p-1 shadow-2xl">
              {availableSymbols.map((sym) => (
                <button
                  key={sym}
                  onClick={() => setActiveSymbol(sym)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs font-mono rounded hover:bg-bg-elevated transition-colors ${
                    activeSymbol === sym ? 'text-trade-ai font-bold bg-bg-elevated' : 'text-text-secondary'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
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
                  ${(ticker.last_price ?? 0).toFixed(1)}
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
                  高: <span className="text-text-primary">${(ticker.high_24h ?? 0).toFixed(1)}</span>
                </span>
                <span>
                  低: <span className="text-text-primary">${(ticker.low_24h ?? 0).toFixed(1)}</span>
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

          {/* WS 连通指示 */}
          <span className="hidden md:flex items-center text-[10px] text-text-muted">
            <Radio
              className={`w-3 h-3 mr-1 ${
                isWsConnected ? 'text-trade-up animate-pulse' : 'text-trade-warning'
              }`}
            />
            {isWsConnected ? 'WS 极速' : '重连中'}
          </span>
        </div>

        {/* 右侧：凭证设置、大模型配置、风控与 Panic Button */}
        <div className="flex items-center space-x-2">
          {/* OKX 凭证配置按钮 */}
          <button
            onClick={() => openSecurityModal('okx')}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-bg-elevated hover:bg-bg-border text-text-primary border border-bg-border transition-colors cursor-pointer"
            title="点击管理 OKX API Key"
          >
            <Lock className="w-3 h-3 text-trade-up" />
            <span className="hidden sm:inline">OKX:</span>
            <span className="font-mono text-trade-up font-bold">
              {apiKeyMasked || '未配置'}
            </span>
          </button>

          {/* 大模型配置按钮 */}
          <button
            onClick={() => openSecurityModal('llm')}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-bg-elevated hover:bg-bg-border text-text-primary border border-bg-border transition-colors cursor-pointer"
            title="点击管理大模型 API 与模型参数"
          >
            <Bot className="w-3 h-3 text-trade-ai" />
            <span className="hidden sm:inline">AI:</span>
            <span className="font-mono text-trade-ai font-bold truncate max-w-[90px]">
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
            const totalEquity = balance?.total_equity_usdt ?? 10000.0;
            const todayPnl = (balance?.today_realized_pnl_usdt ?? 0) + (balance?.unrealized_pnl_usdt ?? 0);
            const todayRatio = balance?.today_pnl_ratio !== undefined ? balance.today_pnl_ratio * 100 : ((todayPnl / 10000.0) * 100);
            const isPnlPositive = todayPnl >= 0;
            const availMargin = balance?.available_margin_usdt ?? 10000.0;
            const usedMargin = balance?.used_margin_usdt ?? 0.0;
            const upl = balance?.unrealized_pnl_usdt ?? 0.0;

            return (
              <div className="rounded-lg border border-bg-border bg-bg-secondary p-3 flex flex-col shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-text-muted">总资产权益 (USDT)</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-trade-up/15 text-trade-up font-mono font-medium">
                    {balance?.is_warning_margin ? '保证金警告' : '风控安全'}
                  </span>
                </div>
                <div className="font-mono-num text-2xl font-bold text-text-primary">
                  ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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


          {/* 下单控制面板 */}
          <div className="flex-1 overflow-hidden">
            <ErrorBoundary fallbackTitle="下单控制面板加载异常">
              <OrderForm />
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
    </div>
  );
};
export default App;

