/**
 * @file AICopilotCard.tsx
 * @description OKX-Dog AI 智能交易副驾驶决策卡片组件
 * 支持 <think> 思维链折叠/展开与打字机流式渐显渲染
 * 结构化展示信号置信度、入场区间、TP/SL、多周期共振理由与一键采纳下单交互弹窗
 */

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  MinusCircle,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Zap,
  ArrowRight,
  X,
  Target,
  ShieldAlert,
  Settings,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { aiApi, tradeApi } from '../services/api';
import { SignalAction, AIAdoptPayload } from '../types';
import {
  getBaseCurrency,
  getSymbolBadge,
  formatPrice,
} from '../utils/symbolHelper';

export const AICopilotCard: React.FC = () => {
  const {
    activeSymbol,
    activeTimeframe,
    ticker,
    positions,
    balance,
    isLiveMode,
    aiAnalysis,
    setAIAnalysis,
    isAiAnalyzing,
    setIsAiAnalyzing,
    setAdoptedOrderParams,
    setPositions,
    setBalance,
    setOrders,
    openSecurityModal,
    llmConfig,
    riskStatus,
    riskRules,
  } = useAppStore();




  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [displayedThinking, setDisplayedThinking] = useState('');
  const [isAdoptModalOpen, setIsAdoptModalOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // 🤖 全自动量化巡检与事件驱动触发引擎状态
  const [isAutoPilotEnabled, setIsAutoPilotEnabled] = useState(true);
  const [autoTriggerReason, setAutoTriggerReason] = useState<string | null>(null);
  const lastAnalyzedPriceRef = React.useRef<number>(0);
  const lastAnalysisTimeRef = React.useRef<number>(Date.now());
  const isTriggeringRef = React.useRef<boolean>(false);

  // 直接一键开仓状态提示
  const [directSuccessMsg, setDirectSuccessMsg] = useState<string | null>(null);
  const [directErrorMsg, setDirectErrorMsg] = useState<string | null>(null);
  const [isDirectSubmitting, setIsDirectSubmitting] = useState(false);

  // 采纳下单弹窗内的可调参数
  const [adoptOrderType, setAdoptOrderType] = useState<'market' | 'limit'>('market');
  const [adoptSize, setAdoptSize] = useState('0.1');
  const [adoptLeverage, setAdoptLeverage] = useState(3);
  const [adoptEntryPrice, setAdoptEntryPrice] = useState<number>(ticker?.last_price || 63550);

  // 打字机渐显思维链效果
  useEffect(() => {
    if (!aiAnalysis?.thinking_process) {
      setDisplayedThinking('');
      return;
    }

    const fullText = aiAnalysis.thinking_process.replace(/<\/?think>/g, '').trim();
    let currentIdx = 0;
    setDisplayedThinking('');

    const interval = setInterval(() => {
      if (currentIdx < fullText.length) {
        setDisplayedThinking((prev) => prev + fullText.slice(currentIdx, currentIdx + 4));
        currentIdx += 4;
      } else {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [aiAnalysis?.thinking_process]);

  // 💡 智能动态仓位计算器：严格基于实盘剩余可用资金 / 模拟沙盒净值与止损距离科学计算
  const getSmartPositionSize = (curPx: number, slPrice: number, levOverride?: number) => {
    const rawAvail = balance?.available_margin_usdt !== undefined ? balance.available_margin_usdt : (isLiveMode ? 0 : 10000);
    const rawEquity = balance?.total_equity_usdt !== undefined ? balance.total_equity_usdt : (isLiveMode ? 0 : 10000);
    const effectiveFunds = Math.max(0, rawAvail > 0 ? rawAvail : rawEquity);
    const effLev = levOverride || Math.min(aiAnalysis?.trade_plan?.suggested_leverage || adoptLeverage || 3, riskRules.max_leverage || 5);
    const riskRatio = 0.02;
    const riskBudgetUsdt = Math.max(1.0, effectiveFunds * riskRatio);
    const stopDistance = Math.abs(curPx - slPrice);
    const safeStopDistance = Math.max(stopDistance, curPx * 0.008); // 至少 0.8% 止损跨度

    // 科学开仓币数 = 风险预算金额 / 止损绝对距离
    let calcCoins = riskBudgetUsdt / safeStopDistance;
    let notional = calcCoins * curPx;

    // 可用资金与杠杆允许的最大开仓上限 (预留 5% 缓冲，防止保证金不足被 OKX 拒绝)
    const maxMarginBudget = effectiveFunds * 0.95;
    const maxAffordableNotional = maxMarginBudget * effLev;

    // 硬风控限额强力封顶 (max_order_usdt) 与 可用保证金上限双重约束
    const maxOrderCap = (riskRules.max_order_usdt && riskRules.max_order_usdt > 100) ? riskRules.max_order_usdt : 50000;
    const finalNotionalCap = Math.min(maxOrderCap * 0.95, maxAffordableNotional > 0 ? maxAffordableNotional : 10);

    if (notional > finalNotionalCap) {
      notional = finalNotionalCap;
      calcCoins = notional / curPx;
    }

    const precision = curPx >= 1000 ? 3 : curPx >= 10 ? 2 : 1;
    const factor = Math.pow(10, precision);
    let formattedCoins = Math.floor(calcCoins * factor) / factor;
    if (formattedCoins <= 0 && effectiveFunds > 5) {
      formattedCoins = curPx >= 1000 ? 0.001 : 0.1;
    }
    const realNotional = Number((formattedCoins * curPx).toFixed(2));
    const requiredMargin = effLev > 0 ? realNotional / effLev : realNotional;

    return {
      coins: formattedCoins,
      notional: realNotional,
      requiredMargin: Number(requiredMargin.toFixed(2)),
      effectiveFunds: Number(effectiveFunds.toFixed(2)),
      riskBudgetUsdt: Number(riskBudgetUsdt.toFixed(2)),
      stopDistance: Number(safeStopDistance.toFixed(1)),
      riskPctText: '2.0%',
    };
  };



  // 记录上次已初始化的分析 ID，避免因 ticker WebSocket 持续推流导致用户表单参数被无限重置
  const lastInitializedAnalysisIdRef = React.useRef<string | null>(null);

  // 当 AI 研判更新时初始化采纳参数 (仅在生成新分析时初始化一次)
  useEffect(() => {
    if (aiAnalysis?.trade_plan) {
      const currentId = aiAnalysis.analysis_id || (aiAnalysis as any).analysis_uuid || 'DEFAULT_ANALYSIS';
      if (lastInitializedAnalysisIdRef.current === currentId) {
        return;
      }
      lastInitializedAnalysisIdRef.current = currentId;

      const plan = aiAnalysis.trade_plan;
      const refPrice = ticker?.last_price || 100;
      const entryLow = plan.entry_range?.[0] ?? refPrice;
      const entryHigh = plan.entry_range?.[1] ?? entryLow;
      const midEntry = (entryLow + entryHigh) / 2;

      setAdoptEntryPrice(Number(midEntry.toFixed(refPrice >= 100 ? 1 : 4)));
      setAdoptLeverage(Math.min(plan.suggested_leverage || 3, riskRules.max_leverage || 5));

      // 依据智能风险预算模型自动初始化开仓数量
      const slPx = plan.stop_loss_price || (midEntry * 0.985);
      const smartSizing = getSmartPositionSize(midEntry, slPx);
      setAdoptSize(String(smartSizing.coins));
    }
  }, [aiAnalysis?.analysis_id, (aiAnalysis as any)?.analysis_uuid]);

  /**
   * 触发 AI 策略研判（支持记录触发原因与强制触发）
   */
  const triggerAnalysisWithReason = async (reason?: string, force: boolean = false) => {
    if (!force && (isTriggeringRef.current || isAiAnalyzing)) return;
    isTriggeringRef.current = true;
    setIsAiAnalyzing(true);
    if (reason) setAutoTriggerReason(reason);
    lastAnalysisTimeRef.current = Date.now();
    if (ticker?.last_price) lastAnalyzedPriceRef.current = ticker.last_price;

    try {
      const result = await aiApi.triggerAnalysis({
        symbol: activeSymbol,
        timeframe: activeTimeframe,
        include_thinking: true,
      });
      if (result) {
        setAIAnalysis(result);
      }
    } catch (err) {
      console.warn('[AI] 触发研判异常:', err);
      // 失败退避惩罚：推迟下一次自动触发时间 45 秒，杜绝请求雪崩
      lastAnalysisTimeRef.current = Date.now() + 45000;
    } finally {
      setIsAiAnalyzing(false);
      isTriggeringRef.current = false;
      if (reason) {
        setTimeout(() => setAutoTriggerReason(null), 6000);
      }
    }
  };

  /**
   * 手动触发 AI 重新研判
   */
  const handleTriggerAnalysis = () => {
    triggerAnalysisWithReason('交易员手动触发', true);
  };

  // 0. 当标的切换时，重置上次研判基准价格与冷却时间
  useEffect(() => {
    lastAnalyzedPriceRef.current = ticker && ticker.symbol === activeSymbol ? ticker.last_price : 0;
    lastAnalysisTimeRef.current = Date.now();
  }, [activeSymbol]);

  // 1. 事件驱动触发：市价突破 / 偏离阈值自动重新生成 (冷却 60 秒)
  useEffect(() => {
    if (!isAutoPilotEnabled || !ticker?.last_price || ticker.symbol !== activeSymbol || isTriggeringRef.current) return;
    const p = ticker.last_price;
    if (lastAnalyzedPriceRef.current <= 0) {
      lastAnalyzedPriceRef.current = p;
      return;
    }
    const diffPct = Math.abs(p - lastAnalyzedPriceRef.current) / lastAnalyzedPriceRef.current;
    if (Date.now() - lastAnalysisTimeRef.current > 60000 && diffPct >= 0.015) {
      triggerAnalysisWithReason(`价格偏离 ${(diffPct * 100).toFixed(1)}% 动态自愈重算`);
    }
  }, [ticker?.last_price, ticker?.symbol, activeSymbol, isAutoPilotEnabled]);

  // 2. 事件驱动触发：持仓浮盈达标或防守预警自动触发调仓决策 (冷却 60 秒)
  useEffect(() => {
    if (!isAutoPilotEnabled || isTriggeringRef.current || !Array.isArray(positions)) return;
    const pos = positions.find((p) => p && p.symbol === activeSymbol && (p.pos_size ?? 0) > 0);
    if (pos && pos.upl_ratio !== undefined) {
      const ratio = pos.upl_ratio;
      if (Date.now() - lastAnalysisTimeRef.current > 60000 && (ratio >= 0.03 || ratio <= -0.02)) {
        const tag = ratio > 0 ? `浮盈达标 (+${(ratio * 100).toFixed(1)}%) 调仓建议` : `持仓防守预警 (${(ratio * 100).toFixed(1)}%) 动态止损`;
        triggerAnalysisWithReason(tag);
      }
    }
  }, [positions, isAutoPilotEnabled, activeSymbol]);

  // 3. 定时心跳巡检：每 120 秒自动评估一次盘面
  useEffect(() => {
    if (!isAutoPilotEnabled) return;
    const interval = setInterval(() => {
      if (Date.now() - lastAnalysisTimeRef.current >= 120000 && !isTriggeringRef.current) {
        triggerAnalysisWithReason('周期心跳自动巡检');
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [isAutoPilotEnabled, activeSymbol, activeTimeframe]);

  /**
   * 执行一键采纳下单
   */
  const handleExecuteAdoptedOrder = async () => {

    if (!aiAnalysis) return;
    setOrderError(null);
    setOrderSuccess(null);
    setSubmittingOrder(true);

    const plan = aiAnalysis.trade_plan || (aiAnalysis as any).action_plan;
    const rawAction = aiAnalysis.signal?.action || 'BUY_LONG';
    const isShort = rawAction === 'SELL_SHORT';
    const isLong = !isShort;
    const finalAction = isShort ? 'SELL_SHORT' : 'BUY_LONG';
    const curPx = ticker?.last_price || adoptEntryPrice || 63550;
    const finalPrice = adoptOrderType === 'market' ? curPx : adoptEntryPrice;

    // 严密检查并自适应纠正 TP1 与 SL，杜绝因反向点位引发秒级误平仓
    let slPrice = plan?.stop_loss_price;
    let tp1Price = plan?.take_profit_levels?.[0]?.price;
    let tp2Price = plan?.take_profit_levels?.[1]?.price;

    if (isLong) {
      if (!slPrice || slPrice <= 0 || slPrice >= finalPrice) {
        slPrice = finalPrice * 0.985;
      }
      if (!tp1Price || tp1Price <= 0 || tp1Price <= finalPrice) {
        tp1Price = finalPrice * 1.025;
      }
    } else {
      if (!slPrice || slPrice <= 0 || slPrice <= finalPrice) {
        slPrice = finalPrice * 1.015;
      }
      if (!tp1Price || tp1Price <= 0 || tp1Price >= finalPrice) {
        tp1Price = finalPrice * 0.975;
      }
    }

    const payload: AIAdoptPayload = {
      symbol: activeSymbol,
      action: finalAction,
      entry_price: finalPrice,
      selected_entry_price: finalPrice,
      stop_loss_price: Number(slPrice.toFixed(finalPrice >= 100 ? 1 : 4)),
      take_profit_target_1: tp1Price ? Number(tp1Price.toFixed(finalPrice >= 100 ? 1 : 4)) : undefined,
      take_profit_target_2: tp2Price ? Number(tp2Price.toFixed(finalPrice >= 100 ? 1 : 4)) : undefined,
      suggested_leverage: adoptLeverage,
      leverage: adoptLeverage,
      order_type: adoptOrderType,
      confidence_score: Math.round((aiAnalysis.signal?.confidence ?? 0.8) * 100),
      analysis_id: aiAnalysis.analysis_id || (aiAnalysis as any).analysis_uuid || 'AI_MANUAL',
      notional_usdt: Number((finalPrice * parseFloat(adoptSize || '0.01')).toFixed(2)),
    };

    try {
      // 1. 同步注入全局 OrderForm
      setAdoptedOrderParams(payload);

      // 2. 调用后端 API 提交下单
      await tradeApi.adoptAIPlan(payload);

      // 3. 立即刷新活跃持仓、账户资产与挂单列表
      const [posRes, balRes, ordRes] = await Promise.allSettled([
        tradeApi.getPositions(),
        tradeApi.getAccountBalance(),
        tradeApi.getOrders(),
      ]);
      if (posRes.status === 'fulfilled') setPositions(posRes.value);
      if (balRes.status === 'fulfilled') setBalance(balRes.value);
      if (ordRes.status === 'fulfilled') setOrders(ordRes.value);

      setOrderSuccess(`AI 交易计划已成功提交！(${adoptOrderType === 'market' ? '市价即时成交' : '限价挂单'})`);
      setTimeout(() => {
        setIsAdoptModalOpen(false);
        setOrderSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '下单提交异常';
      setOrderError(msg);
    } finally {
      setSubmittingOrder(false);
    }
  };

  /**
   * ⚡ 一键直接开仓：无需弹窗确认，自动按 AI 决策与市价立刻下单并开仓
   */
  const handleDirectAutoAdopt = async () => {
    if (!aiAnalysis) return;
    setDirectErrorMsg(null);
    setDirectSuccessMsg(null);
    setIsDirectSubmitting(true);

    const plan = aiAnalysis.trade_plan || (aiAnalysis as any).action_plan;
    const rawAction = aiAnalysis.signal?.action || 'BUY_LONG';
    const isShort = rawAction === 'SELL_SHORT';
    const isLong = !isShort;
    const finalAction = isShort ? 'SELL_SHORT' : 'BUY_LONG';
    const curPx = ticker?.last_price || 63550;
    const lev = plan?.suggested_leverage || 3;

    let slPrice = plan?.stop_loss_price;
    let tp1Price = plan?.take_profit_levels?.[0]?.price;
    let tp2Price = plan?.take_profit_levels?.[1]?.price;

    if (isLong) {
      if (!slPrice || slPrice <= 0 || slPrice >= curPx) {
        slPrice = curPx * 0.985;
      }
      if (!tp1Price || tp1Price <= 0 || tp1Price <= curPx) {
        tp1Price = curPx * 1.025;
      }
    } else {
      if (!slPrice || slPrice <= 0 || slPrice <= curPx) {
        slPrice = curPx * 1.015;
      }
      if (!tp1Price || tp1Price <= 0 || tp1Price >= curPx) {
        tp1Price = curPx * 0.975;
      }
    }

    // 依据 2% 风险预算与止损距离智能核算最佳开仓币数 (基于实盘剩余资金与杠杆上限)
    const smartSizing = getSmartPositionSize(curPx, slPrice, lev);
    const finalSize = smartSizing.coins;
    const notional = smartSizing.notional;


    const payload: AIAdoptPayload = {
      symbol: activeSymbol,
      action: finalAction,
      entry_price: curPx,
      selected_entry_price: curPx,
      stop_loss_price: Number(slPrice.toFixed(curPx >= 100 ? 1 : 4)),
      take_profit_target_1: tp1Price ? Number(tp1Price.toFixed(curPx >= 100 ? 1 : 4)) : undefined,
      take_profit_target_2: tp2Price ? Number(tp2Price.toFixed(curPx >= 100 ? 1 : 4)) : undefined,
      suggested_leverage: lev,
      leverage: lev,
      order_type: 'market',
      confidence_score: Math.round((aiAnalysis.signal?.confidence ?? 0.8) * 100),
      analysis_id: aiAnalysis.analysis_id || (aiAnalysis as any).analysis_uuid || 'AI_DIRECT',
      notional_usdt: notional,
    };

    try {
      setAdoptedOrderParams(payload);
      await tradeApi.adoptAIPlan(payload);

      const [posRes, balRes, ordRes] = await Promise.allSettled([
        tradeApi.getPositions(),
        tradeApi.getAccountBalance(),
        tradeApi.getOrders(),
      ]);
      if (posRes.status === 'fulfilled') setPositions(posRes.value);
      if (balRes.status === 'fulfilled') setBalance(balRes.value);
      if (ordRes.status === 'fulfilled') setOrders(ordRes.value);

      const actionText = isLong ? '买入开多' : '卖出开空';
      setDirectSuccessMsg(`⚡ AI 策略已自动市价开仓！(${actionText} ${finalSize} ${getBaseCurrency(activeSymbol)} @ $${formatPrice(curPx, activeSymbol)}, 名义 $${notional} USDT)`);
      setTimeout(() => setDirectSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '自动下单失败';
      setDirectErrorMsg(msg);
      setTimeout(() => setDirectErrorMsg(null), 4000);
    } finally {
      setIsDirectSubmitting(false);
    }
  };


  // 渲染信号方向徽章

  const renderSignalBadge = (action?: SignalAction) => {
    switch (action) {
      case 'BUY_LONG':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-trade-up/15 text-trade-up border border-trade-up/30">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            建议做多 (BUY_LONG)
          </span>
        );
      case 'SELL_SHORT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-trade-down/15 text-trade-down border border-trade-down/30">
            <TrendingDown className="w-3.5 h-3.5 mr-1" />
            建议做空 (SELL_SHORT)
          </span>
        );
      case 'CLOSE_POSITION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            建议平仓 (CLOSE)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-500/15 text-text-secondary border border-gray-500/30">
            <MinusCircle className="w-3.5 h-3.5 mr-1" />
            建议观望 (HOLD_WAIT)
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full rounded-lg border border-bg-border bg-bg-secondary p-3.5 space-y-3 overflow-y-auto shadow-lg select-none">
      {/* 1. 标题与大模型状态 */}
      <div className="flex items-center justify-between pb-2 border-b border-bg-border">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-6 rounded bg-gradient-to-tr from-trade-ai to-purple-600 flex items-center justify-center text-white shadow-sm shadow-trade-ai/30">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text-primary flex items-center space-x-1">
              <span>AI 智能交易副驾驶</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="font-mono text-text-secondary ml-1 font-normal">[{activeSymbol}]</span>
              {(() => {
                const badge = getSymbolBadge(activeSymbol);
                return (
                  <span className={`text-[9px] px-1 py-0.2 rounded border font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                );
              })()}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-trade-ai font-mono font-medium">
                {llmConfig?.llm_model || aiAnalysis?.model_used || 'deepseek-reasoner'}
              </span>
              <button
                type="button"
                onClick={() => openSecurityModal('llm')}
                className="text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
                title="配置大模型 API 与模型参数"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* 自动巡检状态切换 */}
          <button
            type="button"
            onClick={() => setIsAutoPilotEnabled(!isAutoPilotEnabled)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-mono font-medium transition-all cursor-pointer ${
              isAutoPilotEnabled
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-bg-elevated text-text-muted border border-bg-border'
            }`}
            title="开启/关闭 定时与价格异动自动计算 AI 策略"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isAutoPilotEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'}`} />
            <span>{isAutoPilotEnabled ? '巡检: 开' : '巡检: 关'}</span>
          </button>

          <button
            onClick={handleTriggerAnalysis}
            disabled={isAiAnalyzing}
            className="flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-trade-ai/20 hover:bg-trade-ai/30 text-trade-ai border border-trade-ai/40 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            title="实时推理当前标的多周期行情并更新量化策略"
          >
            <RefreshCw className={`w-3 h-3 ${isAiAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAiAnalyzing ? '推理中...' : '重新研判'}</span>
          </button>
        </div>
      </div>

      {/* 自动操盘守护指引条 */}
      <div className="px-2.5 py-1.5 rounded-lg bg-bg-elevated border border-bg-border/80 text-[11px] flex items-center justify-between text-text-muted">
        <span className="flex items-center space-x-1.5">
          <Bot className="w-3.5 h-3.5 text-trade-ai shrink-0" />
          <span>7x24h 脱机多标的量化操盘由右侧 AutoPilot 独立守护</span>
        </span>
        <span className="text-[10px] text-text-muted font-mono">
          此处支持主观深度研判与一键采纳
        </span>
      </div>


      {/* 自动触发归因动态横条 */}
      {autoTriggerReason && (
        <div className="px-2.5 py-1 rounded bg-trade-ai/15 border border-trade-ai/30 text-trade-ai text-[11px] font-mono flex items-center space-x-1.5 animate-in fade-in">
          <Zap className="w-3 h-3 text-amber-300 animate-bounce" />
          <span>⚡ {autoTriggerReason}</span>
        </div>
      )}


      {/* 2. 核心信号与置信度 */}
      {aiAnalysis && (
        <div className="rounded-lg bg-bg-elevated/70 border border-bg-border p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            {renderSignalBadge(aiAnalysis.signal.action)}

            <div className="flex items-center space-x-1.5 text-xs font-mono">
              <span className="text-text-muted text-[11px]">置信度:</span>
              <span className="px-1.5 py-0.5 rounded bg-trade-ai/20 text-trade-ai font-bold border border-trade-ai/30">
                {Math.round(aiAnalysis.signal.confidence * 100)}%
              </span>
            </div>
          </div>

          {/* 研判核心摘要 */}
          <p className="text-xs text-text-secondary leading-relaxed bg-bg-primary/40 p-2 rounded border border-bg-border/60">
            {aiAnalysis.reasoning_summary}
          </p>

          {/* 建议交易计划核心点位 */}
          {(() => {
            const plan = aiAnalysis.trade_plan || (aiAnalysis as any).action_plan;
            const refPrice = ticker?.last_price || 63428.0;
            const entryLow = plan?.entry_range?.[0] ?? Number((refPrice * 0.995).toFixed(refPrice >= 100 ? 1 : 4));
            const entryHigh = plan?.entry_range?.[1] ?? Number((refPrice * 1.002).toFixed(refPrice >= 100 ? 1 : 4));
            const sl = plan?.stop_loss_price ?? Number((refPrice * 0.985).toFixed(refPrice >= 100 ? 1 : 4));
            const tp1 = plan?.take_profit_levels?.[0]?.price ?? Number((refPrice * 1.025).toFixed(refPrice >= 100 ? 1 : 4));
            const rr = plan?.risk_reward_ratio ?? 2.0;
            const lev = plan?.suggested_leverage ?? 3;

            return (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-bg-primary/50 p-2 rounded border border-bg-border/60">
                  <div className="text-[10px] text-text-muted">建议入场区间</div>
                  <div className="font-mono-num font-semibold text-text-primary mt-0.5">
                    ${entryLow.toLocaleString()} - ${entryHigh.toLocaleString()}
                  </div>
                </div>

                <div className="bg-bg-primary/50 p-2 rounded border border-bg-border/60">
                  <div className="text-[10px] text-text-muted">硬止损防御 (SL)</div>
                  <div className="font-mono-num font-semibold text-trade-down mt-0.5">
                    ${sl.toLocaleString()}
                  </div>
                </div>

                <div className="bg-bg-primary/50 p-2 rounded border border-bg-border/60">
                  <div className="text-[10px] text-text-muted">第一止盈目标 (TP1)</div>
                  <div className="font-mono-num font-semibold text-trade-up mt-0.5">
                    ${tp1.toLocaleString()} (50%)
                  </div>
                </div>

                <div className="bg-bg-primary/50 p-2 rounded border border-bg-border/60">
                  <div className="text-[10px] text-text-muted">理论盈亏比 / 杠杆</div>
                  <div className="font-mono-num font-semibold text-trade-ai mt-0.5">
                    {rr} : 1 ({lev}x)
                  </div>
                </div>
              </div>
            );
          })()}


        </div>
      )}

      {/* 3. 多周期共振与量化理由折叠 */}
      {aiAnalysis?.timeframe_analysis && (
        <div className="rounded-lg bg-bg-elevated/40 border border-bg-border p-2.5 space-y-1.5 text-xs">
          <div className="text-[11px] font-semibold text-text-muted flex items-center space-x-1">
            <Sliders className="w-3 h-3 text-trade-ai" />
            <span>多周期趋势共振</span>
          </div>

          <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center pt-1">
            {Object.entries(aiAnalysis.timeframe_analysis).map(([tfKey, detail]) => {
              const label = tfKey.replace('tf_', '').toUpperCase();
              const isBull = detail.trend === 'BULLISH';
              return (
                <div
                  key={tfKey}
                  className={`py-1 rounded border ${
                    isBull
                      ? 'bg-trade-up/10 text-trade-up border-trade-up/30'
                      : 'bg-trade-down/10 text-trade-down border-trade-down/30'
                  }`}
                >
                  <div className="font-bold">{label}</div>
                  <div className="text-[9px] scale-90">{isBull ? '多头' : '空头'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. <think> 思维链打字机折叠栏 */}
      {aiAnalysis?.thinking_process && (
        <div className="rounded-lg border border-trade-ai/30 bg-trade-ai/5 overflow-hidden">
          <button
            onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-trade-ai hover:bg-trade-ai/10 transition-colors"
          >
            <span className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>AI 深度思维链推导 (<span className="font-mono">CoT</span>)</span>
            </span>
            {isThinkingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isThinkingExpanded && (
            <div className="p-3 border-t border-trade-ai/20 bg-bg-primary/80 font-mono text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {displayedThinking || '正在加载思维链推导...'}
            </div>
          )}
        </div>
      )}

      {/* 5. 核心操作：直接开仓与自定义采纳 */}
      {directSuccessMsg && (
        <div className="p-2.5 rounded bg-trade-up/15 border border-trade-up text-trade-up text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{directSuccessMsg}</span>
        </div>
      )}
      {directErrorMsg && (
        <div className="p-2.5 rounded bg-trade-down/15 border border-trade-down text-trade-down text-xs flex items-center space-x-2 animate-in fade-in">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{directErrorMsg}</span>
        </div>
      )}

      {/* 智能动态仓位计算展示 */}
      {aiAnalysis && (() => {
        const cur = ticker?.last_price || 63550;
        const sl = aiAnalysis.trade_plan?.stop_loss_price || cur * 0.985;
        const lev = Math.min(aiAnalysis.trade_plan?.suggested_leverage || adoptLeverage || 3, riskRules.max_leverage || 5);
        const sizing = getSmartPositionSize(cur, sl, lev);
        return (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-bg-elevated/70 border border-bg-border/60 text-[11px]">
            <span className="text-text-muted flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-trade-ai" />
              <span>智能建仓 ({isLiveMode ? '实盘' : '模拟'} 2% 风险):</span>
            </span>
            <span className="font-mono font-bold text-text-primary">
              {sizing.coins} {getBaseCurrency(activeSymbol)}
              <span className="text-text-muted font-normal ml-1">
                (~${sizing.notional} USDT | 占用保 ${sizing.requiredMargin} U)
              </span>
            </span>
          </div>
        );
      })()}


      <div className="flex items-center space-x-2 pt-0.5">
        <button
          onClick={handleDirectAutoAdopt}
          disabled={riskStatus === 'PANIC_LOCKED' || !aiAnalysis || isDirectSubmitting}
          className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-trade-ai to-indigo-600 hover:from-trade-ai/90 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-trade-ai/20 transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-[0.99]"
          title="无需弹窗确认，一键按 AI 研判方向与 2% 风险预算智能市价自动开仓"
        >
          <Zap className={`w-4 h-4 ${isDirectSubmitting ? 'animate-spin' : 'text-amber-300'}`} />
          <span>{isDirectSubmitting ? '正在自动撮合下单...' : '⚡ 一键智能开仓 (市价直通)'}</span>
        </button>

        <button
          onClick={() => setIsAdoptModalOpen(true)}
          disabled={riskStatus === 'PANIC_LOCKED' || !aiAnalysis}
          className="px-3 py-2.5 rounded-lg bg-bg-elevated hover:bg-bg-border border border-bg-border text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
          title="自定义委托数量、杠杆与限价点位"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>参数</span>
        </button>
      </div>


      {/* 6. 一键采纳二次确认弹窗 */}
      {isAdoptModalOpen && aiAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-bg-border bg-bg-secondary p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between pb-3 border-b border-bg-border">
              <div className="flex items-center space-x-2">
                <div className="h-7 w-7 rounded-lg bg-trade-ai/20 text-trade-ai flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-text-primary">采纳 AI 交易计划 (二次确认)</span>
              </div>
              <button
                onClick={() => setIsAdoptModalOpen(false)}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 提示信息 */}
            {orderError && (
              <div className="p-2.5 rounded bg-trade-down/15 border border-trade-down text-trade-down text-xs flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{orderError}</span>
              </div>
            )}
            {orderSuccess && (
              <div className="p-2.5 rounded bg-trade-up/15 border border-trade-up text-trade-up text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{orderSuccess}</span>
              </div>
            )}

            {/* 参数表单 */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-bg-border">
                <span className="text-text-muted">标的与方向</span>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-text-primary">{activeSymbol}</span>
                  {renderSignalBadge(aiAnalysis.signal.action)}
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-bg-border">
                <span className="text-text-muted">撮合执行方式</span>
                <div className="flex items-center space-x-1 bg-bg-elevated p-0.5 rounded border border-bg-border">
                  <button
                    type="button"
                    onClick={() => setAdoptOrderType('market')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      adoptOrderType === 'market' ? 'bg-trade-ai text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    市价即时成交
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdoptOrderType('limit')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      adoptOrderType === 'limit' ? 'bg-trade-ai text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    限价挂单
                  </button>
                </div>
              </div>

              {adoptOrderType === 'limit' ? (
                <div className="flex justify-between items-center py-1 border-b border-bg-border">
                  <span className="text-text-muted">限价入场价 (USDT)</span>
                  <input
                    type="number"
                    value={adoptEntryPrice}
                    onChange={(e) => setAdoptEntryPrice(parseFloat(e.target.value) || 0)}
                    className="w-32 bg-bg-elevated border border-bg-border rounded px-2 py-1 font-mono-num text-right text-text-primary focus:outline-none focus:border-trade-ai"
                  />
                </div>
              ) : (
                <div className="flex justify-between items-center py-1 border-b border-bg-border">
                  <span className="text-text-muted">预估成交市价</span>
                  <span className="font-mono-num font-bold text-text-primary">
                    ~${(ticker?.last_price || 63550).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-1 border-b border-bg-border">
                <div className="flex items-center space-x-1.5">
                  <span className="text-text-muted">委托数量 ({getBaseCurrency(activeSymbol)})</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = adoptOrderType === 'market' ? (ticker?.last_price || 63550) : adoptEntryPrice;
                      const sl = aiAnalysis.trade_plan?.stop_loss_price || (cur * 0.985);
                      const smart = getSmartPositionSize(cur, sl, adoptLeverage);
                      setAdoptSize(String(smart.coins));

                    }}
                    className="px-1.5 py-0.5 rounded bg-trade-ai/15 hover:bg-trade-ai/30 text-trade-ai text-[10px] font-semibold cursor-pointer transition-colors"
                    title="按账户 2% 风险预算与止损距离自动推导"
                  >
                    ⚡ 智能仓位
                  </button>
                </div>
                <input
                  type="number"
                  step="0.005"
                  value={adoptSize}
                  onChange={(e) => setAdoptSize(e.target.value)}
                  className="w-32 bg-bg-elevated border border-bg-border rounded px-2 py-1 font-mono-num text-right text-text-primary focus:outline-none focus:border-trade-ai"
                />
              </div>



              <div className="flex justify-between items-center py-1 border-b border-bg-border">
                <span className="text-text-muted">杠杆倍数</span>
                <div className="flex items-center space-x-2 font-mono">
                  <input
                    type="range"
                    min="1"
                    max={riskRules.max_leverage || 5}
                    value={adoptLeverage}
                    onChange={(e) => setAdoptLeverage(parseInt(e.target.value))}
                    className="w-24 accent-trade-ai"
                  />
                  <span className="font-bold text-text-primary w-6 text-right">{adoptLeverage}x</span>
                </div>
              </div>

              <div className="bg-bg-primary/60 p-3 rounded space-y-1.5 border border-bg-border/60">
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-muted">预设止损价 (SL):</span>
                  <span className="font-mono-num text-trade-down font-semibold">
                    ${(aiAnalysis.trade_plan?.stop_loss_price ?? (aiAnalysis as any).action_plan?.stop_loss_price ?? (adoptEntryPrice * 0.985)).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-muted">第一止盈目标 (TP1):</span>
                  <span className="font-mono-num text-trade-up font-semibold">
                    ${(aiAnalysis.trade_plan?.take_profit_levels?.[0]?.price ?? (aiAnalysis as any).action_plan?.take_profit_levels?.[0]?.price ?? (adoptEntryPrice * 1.025)).toLocaleString()} (50%)
                  </span>
                </div>
                {(() => {
                  const estPx = adoptOrderType === 'market' ? (ticker?.last_price || adoptEntryPrice || 63550) : adoptEntryPrice;
                  const numSz = parseFloat(adoptSize) || 0;
                  const notionalVal = (estPx * numSz).toFixed(2);
                  const marginVal = (parseFloat(notionalVal) / Math.max(1, adoptLeverage)).toFixed(2);
                  const currentAvail = balance?.available_margin_usdt !== undefined ? balance.available_margin_usdt : (isLiveMode ? 0.0 : 10000.0);
                  const isExceeded = parseFloat(marginVal) > currentAvail;
                  return (
                    <>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-text-muted">当前可用保证金:</span>
                        <span className="font-mono-num text-text-primary font-bold">
                          ${currentAvail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT {isLiveMode ? '【实盘】' : '【模拟】'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-text-muted">名义总金额 (USDT):</span>
                        <span className="font-mono-num text-text-primary font-bold">
                          ${notionalVal}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-text-muted">预计占用保证金:</span>
                        <span className={`font-mono-num font-semibold ${isExceeded ? 'text-trade-down' : 'text-trade-ai'}`}>
                          ${marginVal} USDT ({adoptLeverage}x) {isExceeded ? '(超出可用余额)' : ''}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>




              {/* 硬风控合规提示 */}
              <div className="flex items-center space-x-1.5 text-[11px] text-text-muted">
                <ShieldCheck className="w-3.5 h-3.5 text-trade-up" />
                <span>此订单将经过单笔限额、单日亏损与最大杠杆硬风控验证</span>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setIsAdoptModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-bg-elevated hover:bg-bg-border text-text-secondary hover:text-text-primary text-xs font-medium"
              >
                取消
              </button>
              <button
                onClick={handleExecuteAdoptedOrder}
                disabled={submittingOrder}
                className="px-5 py-2 rounded-lg bg-trade-ai hover:bg-trade-ai/90 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-trade-ai/30 flex items-center space-x-1.5"
              >
                {submittingOrder ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                <span>{submittingOrder ? '提交硬风控中...' : '确认并执行下单'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
