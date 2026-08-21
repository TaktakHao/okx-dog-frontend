/**
 * @file OrderForm.tsx
 * @description OKX-Dog 专业交易下单控制台组件
 * 支持 SPOT / SWAP 切换、LIMIT / MARKET 切换、1-50x 杠杆调节滑块与硬顶校验、快捷仓位比例 (25%, 50%, 75%, 100%)、
 * TP/SL 盈亏比实时预估、保证金占用计算、前置硬风控校验与不可绕过的 Panic Button 紧急撤单全平
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { tradeApi, riskApi } from '../services/api';
import { InstrumentType, OrderType, OrderSide, PosSide, OrderCreateRequest } from '../types';
import { getBaseCurrency } from '../utils/symbolHelper';

export const OrderForm: React.FC = () => {
  const {
    activeSymbol,
    ticker,
    balance,
    isLiveMode,
    selectedPrice,
    setSelectedPrice,
    adoptedOrderParams,
    setAdoptedOrderParams,
    setPositions,
    setBalance,
    setOrders,
    riskStatus,
    riskRules,
    triggerPanicLock,
  } = useAppStore();



  // 交易模式配置
  const [instType, setInstType] = useState<InstrumentType>('SWAP');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [side, setSide] = useState<OrderSide>('buy');
  const [leverage, setLeverage] = useState<number>(3);

  // 表单输入
  const [price, setPrice] = useState<string>('');
  const [size, setSize] = useState<string>('');
  const [enableTPSL, setEnableTPSL] = useState<boolean>(true);
  const [tpPrice, setTpPrice] = useState<string>('');
  const [slPrice, setSlPrice] = useState<string>('');

  // 交互与提交状态
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Panic Button 二次确认状态
  const [isPanicModalOpen, setIsPanicModalOpen] = useState<boolean>(false);
  const [panicMasterPassword, setPanicMasterPassword] = useState<string>('');
  const [isPanicExecuting, setIsPanicExecuting] = useState<boolean>(false);
  const [panicResultMsg, setPanicResultMsg] = useState<string | null>(null);

  const getSymbolDefaultPrice = (sym: string) => {
    if (sym.includes('BTC')) return 63428.0;
    if (sym.includes('ETH')) return 2680.0;
    if (sym.includes('SOL')) return 188.0;
    if (sym.includes('XAU') || sym.includes('PAXG')) return 2650.0;
    if (sym.includes('NVDA')) return 128.5;
    if (sym.includes('TSLA')) return 245.0;
    if (sym.includes('EUR')) return 1.085;
    if (sym.includes('ONDO')) return 0.725;
    return 100.0;
  };

  // 1. 初始化与标的切换时更新价格
  useEffect(() => {
    if (ticker?.last_price) {
      setPrice(ticker.last_price.toFixed(ticker.last_price >= 100 ? 1 : 4));
    } else {
      const def = getSymbolDefaultPrice(activeSymbol);
      setPrice(def.toFixed(def >= 100 ? 1 : 4));
    }
  }, [activeSymbol, ticker?.last_price]);

  // 2. 响应盘口点选价格回填
  useEffect(() => {
    if (selectedPrice !== null) {
      setPrice(selectedPrice.toFixed(selectedPrice >= 100 ? 1 : 4));
      setSelectedPrice(null); // 消费后置空
    }
  }, [selectedPrice, setSelectedPrice]);

  // 3. 响应 AI 副驾驶一键采纳参数回填
  useEffect(() => {
    if (adoptedOrderParams) {
      setInstType('SWAP');
      setSide(adoptedOrderParams.action === 'SELL_SHORT' ? 'sell' : 'buy');
      if (adoptedOrderParams.entry_price) {
        const ep = adoptedOrderParams.entry_price;
        setPrice(ep.toFixed(ep >= 100 ? 1 : 4));
      }
      if (adoptedOrderParams.suggested_leverage) {
        setLeverage(Math.min(adoptedOrderParams.suggested_leverage, riskRules.max_leverage || 5));
      }
      if (adoptedOrderParams.take_profit_target_1) {
        const tp = adoptedOrderParams.take_profit_target_1;
        setTpPrice(tp.toFixed(tp >= 100 ? 1 : 4));
      }
      if (adoptedOrderParams.stop_loss_price) {
        const sl = adoptedOrderParams.stop_loss_price;
        setSlPrice(sl.toFixed(sl >= 100 ? 1 : 4));
      }
      setEnableTPSL(true);
      setAdoptedOrderParams(null); // 消费后置空
    }
  }, [adoptedOrderParams, riskRules, setAdoptedOrderParams]);

  // 计算名义价值、保证金与风控校验
  const numPrice = parseFloat(price) || ticker?.last_price || getSymbolDefaultPrice(activeSymbol);
  const numSize = parseFloat(size) || 0;
  const notionalUsdt = numPrice * numSize;
  const requiredMargin = leverage > 0 ? notionalUsdt / leverage : notionalUsdt;
  const availMargin = balance?.available_margin_usdt !== undefined ? balance.available_margin_usdt : (isLiveMode ? 0.0 : 10000.0);


  // 实时盈亏比计算 (R:R Ratio)
  const { riskRewardRatio, tpProfitUsdt, slLossUsdt } = useMemo(() => {
    const tp = parseFloat(tpPrice);
    const sl = parseFloat(slPrice);
    if (!tp || !sl || !numPrice || !numSize) {
      return { riskRewardRatio: null, tpProfitUsdt: 0, slLossUsdt: 0 };
    }

    const isBuy = side === 'buy';
    const profitDistance = isBuy ? tp - numPrice : numPrice - tp;
    const lossDistance = isBuy ? numPrice - sl : sl - numPrice;

    if (lossDistance <= 0 || profitDistance <= 0) {
      return { riskRewardRatio: null, tpProfitUsdt: 0, slLossUsdt: 0 };
    }

    const rr = Number((profitDistance / lossDistance).toFixed(2));
    const profit = profitDistance * numSize;
    const loss = lossDistance * numSize;

    return {
      riskRewardRatio: rr,
      tpProfitUsdt: Number(profit.toFixed(2)),
      slLossUsdt: Number(loss.toFixed(2)),
    };
  }, [tpPrice, slPrice, numPrice, numSize, side]);

  // 快捷仓位比例计算
  const handleRatioClick = (ratio: number) => {
    if (!numPrice || numPrice <= 0) return;
    const maxAffordableNotional = availMargin * leverage * 0.95; // 预留 5% 缓冲
    const targetNotional = maxAffordableNotional * ratio;
    const calculatedSize = (targetNotional / numPrice).toFixed(3);
    setSize(calculatedSize);
  };

  /**
   * 提交普通下单
   */
  const handlePlaceOrder = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. 本地硬风控前置校验
    if (riskStatus === 'PANIC_LOCKED' || riskStatus === 'CIRCUIT_BROKEN') {
      setErrorMsg('系统当前处于硬风控熔断锁死状态，禁止提交任何开仓委托！');
      return;
    }

    if (!numSize || numSize <= 0) {
      setErrorMsg('请输入有效的委托数量');
      return;
    }

    if (orderType === 'limit' && (!numPrice || numPrice <= 0)) {
      setErrorMsg('限价单必须输入有效的委托价格');
      return;
    }

    if (notionalUsdt > (riskRules.max_order_usdt || 1000)) {
      setErrorMsg(
        `【硬风控拦截】单笔名义金额 $${notionalUsdt.toFixed(
          2
        )} 超出系统设定的单笔上限 $${riskRules.max_order_usdt} USDT！`
      );
      return;
    }

    if (leverage > (riskRules.max_leverage || 5)) {
      setErrorMsg(
        `【硬风控拦截】选择杠杆 ${leverage}x 超出系统硬锁最高限制 ${riskRules.max_leverage}x！`
      );
      return;
    }

    if (requiredMargin > availMargin) {
      setErrorMsg(`可用保证金不足 (需 $${requiredMargin.toFixed(2)}, 可用 $${availMargin.toFixed(2)})`);
      return;
    }

    setIsSubmitting(true);
    const posSide: PosSide = instType === 'SWAP' ? (side === 'buy' ? 'long' : 'short') : 'net';

    const orderPayload: OrderCreateRequest = {
      symbol: activeSymbol,
      inst_type: instType,
      side,
      pos_side: posSide,
      order_type: orderType,
      size: numSize,
      price: orderType === 'limit' ? numPrice : null,
      leverage: instType === 'SWAP' ? leverage : 1,
      tp_trigger_price: enableTPSL && tpPrice ? parseFloat(tpPrice) : null,
      sl_trigger_price: enableTPSL && slPrice ? parseFloat(slPrice) : null,
      copilot_mode: 'MANUAL',
    };

    try {
      await tradeApi.placeOrder(orderPayload);

      // 立即刷新活跃持仓、账户资产与挂单列表
      const [posRes, balRes, ordRes] = await Promise.allSettled([
        tradeApi.getPositions(),
        tradeApi.getAccountBalance(),
        tradeApi.getOrders(),
      ]);
      if (posRes.status === 'fulfilled') setPositions(posRes.value);
      if (balRes.status === 'fulfilled') setBalance(balRes.value);
      if (ordRes.status === 'fulfilled') setOrders(ordRes.value);

      setSuccessMsg(`订单委托提交成功！(${side === 'buy' ? '买入做多' : '卖出做空'} ${numSize} ${getBaseCurrency(activeSymbol)})`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {

      const msg = err instanceof Error ? err.message : '下单提交失败';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 触发最高优先级 Panic Button (Cancel-Before-Close)
   */
  const handleExecutePanic = async () => {
    if (!panicMasterPassword) {
      setPanicResultMsg('请输入主密码以完成紧急熔断确认！');
      return;
    }

    setIsPanicExecuting(true);
    setPanicResultMsg(null);

    try {
      const resp = await riskApi.triggerPanicButton({
        master_password: panicMasterPassword,
        confirm_phrase: 'PANIC_CLOSE_ALL',
        target: 'ALL',
        cancel_all_orders: true,
        close_all_positions: true,
        reason: '交易员手动触发交易面板 Panic Button 紧急避险',
      });

      triggerPanicLock(resp.message || 'Panic Button 紧急避险');
      setPanicResultMsg(resp.message || '紧急撤单全平指令已成功执行，系统已进入锁死保护状态！');
      setTimeout(() => {
        setIsPanicModalOpen(false);
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '熔断执行异常';
      setPanicResultMsg(`执行失败: ${msg}`);
    } finally {
      setIsPanicExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full rounded-lg border border-bg-border bg-bg-secondary p-3.5 space-y-3 overflow-y-auto shadow-lg select-none">
      {/* 1. 顶部模式切换 (现货 / 永续合约) */}
      <div className="flex items-center justify-between pb-2 border-b border-bg-border">
        <div className="flex items-center space-x-1 bg-bg-elevated p-0.5 rounded-lg border border-bg-border">
          <button
            onClick={() => setInstType('SWAP')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              instType === 'SWAP'
                ? 'bg-trade-ai text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            永续合约 (SWAP)
          </button>
          <button
            onClick={() => setInstType('SPOT')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              instType === 'SPOT'
                ? 'bg-trade-ai text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            现货交易 (SPOT)
          </button>
        </div>

        {/* 限价 / 市价单切换 */}
        <div className="flex items-center space-x-1 bg-bg-elevated p-0.5 rounded-lg border border-bg-border text-xs">
          <button
            onClick={() => setOrderType('limit')}
            className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
              orderType === 'limit' ? 'bg-bg-border text-text-primary font-bold' : 'text-text-muted'
            }`}
          >
            限价 (LIMIT)
          </button>
          <button
            onClick={() => setOrderType('market')}
            className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
              orderType === 'market' ? 'bg-bg-border text-text-primary font-bold' : 'text-text-muted'
            }`}
          >
            市价 (MARKET)
          </button>
        </div>
      </div>

      {/* 2. 杠杆滑块 (仅合约有效) */}
      {instType === 'SWAP' && (
        <div className="bg-bg-elevated/50 p-2.5 rounded-lg border border-bg-border space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-muted flex items-center space-x-1">
              <Sliders className="w-3 h-3 text-trade-ai" />
              <span>合约杠杆倍数</span>
            </span>
            <div className="flex items-center space-x-1 font-mono">
              <span className="font-bold text-trade-ai text-sm">{leverage}x</span>
              <span className="text-[10px] text-text-muted">
                (系统硬顶 ≤{riskRules.max_leverage || 5}x)
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="1"
              max={Math.min(50, riskRules.max_leverage || 5)}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full accent-trade-ai cursor-pointer"
            />
          </div>

          {/* 常用杠杆快捷按钮 */}
          <div className="flex justify-between text-[10px] font-mono text-text-muted pt-1">
            {[1, 2, 3, 5].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLeverage(lvl)}
                className={`px-2 py-0.5 rounded border ${
                  leverage === lvl
                    ? 'bg-trade-ai/20 text-trade-ai border-trade-ai/40 font-bold'
                    : 'border-bg-border hover:text-text-primary'
                }`}
              >
                {lvl}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. 价格与数量输入 */}
      <div className="space-y-2 text-xs">
        {/* 价格输入 */}
        <div>
          <div className="flex justify-between text-text-muted mb-1 text-[11px]">
            <span>委托价格</span>
            <span>USDT</span>
          </div>
          <div className="relative">
            <input
              type="number"
              disabled={orderType === 'market'}
              value={orderType === 'market' ? '以最优市价成交' : price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-sm font-mono-num text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai disabled:opacity-60"
            />
          </div>
        </div>

        {/* 数量输入 */}
        <div>
          <div className="flex justify-between text-text-muted mb-1 text-[11px]">
            <span>委托数量</span>
            <span className="font-mono text-text-secondary">{getBaseCurrency(activeSymbol)}</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="0.00"
              className="w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-sm font-mono-num text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai"
            />
          </div>
        </div>

        {/* 快捷比例按钮 (25%, 50%, 75%, 100%) */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[0.25, 0.5, 0.75, 1.0].map((ratio) => (
            <button
              key={ratio}
              onClick={() => handleRatioClick(ratio)}
              className="py-1 rounded bg-bg-elevated hover:bg-bg-border border border-bg-border text-[11px] font-mono text-text-secondary hover:text-text-primary transition-colors"
            >
              {ratio * 100}%
            </button>
          ))}
        </div>
      </div>

      {/* 4. 止盈止损 (TP/SL) 与盈亏比预估 */}
      <div className="rounded-lg bg-bg-elevated/40 border border-bg-border p-2.5 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enableTPSL}
              onChange={(e) => setEnableTPSL(e.target.checked)}
              className="rounded accent-trade-ai"
            />
            <span className="font-semibold text-text-primary text-[11px]">附带止盈止损 (TP/SL)</span>
          </label>

          {riskRewardRatio && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-trade-ai/20 text-trade-ai border border-trade-ai/30">
              预估盈亏比 {riskRewardRatio} : 1
            </span>
          )}
        </div>

        {enableTPSL && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-[10px] text-trade-up font-semibold">止盈价 (TP)</span>
              <input
                type="number"
                value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="高于开仓价"
                className="w-full bg-bg-elevated border border-bg-border rounded px-2 py-1 text-xs font-mono-num text-text-primary mt-1 focus:outline-none focus:border-trade-up"
              />
              {tpProfitUsdt > 0 && (
                <div className="text-[9px] text-trade-up mt-0.5">预估 +${tpProfitUsdt}</div>
              )}
            </div>

            <div>
              <span className="text-[10px] text-trade-down font-semibold">止损价 (SL)</span>
              <input
                type="number"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="低于开仓价"
                className="w-full bg-bg-elevated border border-bg-border rounded px-2 py-1 text-xs font-mono-num text-text-primary mt-1 focus:outline-none focus:border-trade-down"
              />
              {slLossUsdt > 0 && (
                <div className="text-[9px] text-trade-down mt-0.5">预估 -${slLossUsdt}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. 资金与风控实时信息 */}
      <div className="bg-bg-primary/50 p-2.5 rounded-lg border border-bg-border/60 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-text-muted">名义总金额:</span>
          <span className="font-mono-num text-text-primary font-semibold">
            ${(notionalUsdt || 0).toFixed(2)} USDT
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">预计占用保证金:</span>
          <span className="font-mono-num text-text-primary font-semibold">
            ${(requiredMargin || 0).toFixed(2)} USDT
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">账户可用资金:</span>
          <span className="font-mono-num text-trade-up font-semibold">
            ${(availMargin || 0).toFixed(2)} USDT
          </span>
        </div>
      </div>

      {/* 6. 错误或成功提示 */}
      {errorMsg && (
        <div className="p-2 rounded bg-trade-down/15 border border-trade-down text-trade-down text-[11px] flex items-center space-x-1.5">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-2 rounded bg-trade-up/15 border border-trade-up text-trade-up text-[11px] flex items-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 7. 双向买卖下单大按钮 */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => {
            setSide('buy');
            handlePlaceOrder();
          }}
          disabled={isSubmitting || riskStatus === 'PANIC_LOCKED'}
          className="py-3 rounded-lg bg-trade-up hover:bg-trade-up/90 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-trade-up/20 transition-all flex items-center justify-center space-x-1 cursor-pointer active:scale-[0.99]"
        >
          <TrendingUp className="w-4 h-4" />
          <span>买入 / 开多 (LONG)</span>
        </button>

        <button
          onClick={() => {
            setSide('sell');
            handlePlaceOrder();
          }}
          disabled={isSubmitting || riskStatus === 'PANIC_LOCKED'}
          className="py-3 rounded-lg bg-trade-down hover:bg-trade-down/90 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-trade-down/20 transition-all flex items-center justify-center space-x-1 cursor-pointer active:scale-[0.99]"
        >
          <TrendingDown className="w-4 h-4" />
          <span>卖出 / 开空 (SHORT)</span>
        </button>
      </div>

      {/* 8. 醒目的 Panic Button (紧急撤单全平熔断) */}
      <div className="pt-2 border-t border-bg-border">
        <button
          onClick={() => setIsPanicModalOpen(true)}
          className="w-full py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 group cursor-pointer"
        >
          <Flame className="w-4 h-4 group-hover:animate-bounce" />
          <span>PANIC BUTTON (紧急撤单全平)</span>
        </button>
      </div>

      {/* 9. Panic Button 紧急全平二次确认弹窗 */}
      {isPanicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-xl border border-trade-down bg-bg-secondary p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 text-trade-down">
              <AlertOctagon className="w-6 h-6 animate-pulse" />
              <h3 className="font-bold text-base">触发最高优先级 PANIC 熔断</h3>
            </div>

            <div className="p-3 rounded bg-trade-down/10 border border-trade-down/30 text-xs text-text-secondary leading-relaxed space-y-1">
              <p className="font-bold text-trade-down">【Cancel-Before-Close 强制避险保护】</p>
              <p>1. 系统将以微秒级并行并发撤销 OKX 账户内所有未成交挂单。</p>
              <p>2. 随后以 IOC 市价全平所有多空活跃持仓。</p>
              <p>3. 系统将立即锁死进入只读安全模式，杜绝任何后续亏损扩大。</p>
            </div>

            {panicResultMsg && (
              <div className="p-2.5 rounded bg-bg-elevated border border-trade-down text-xs text-trade-down font-medium">
                {panicResultMsg}
              </div>
            )}

            <div className="space-y-2 text-xs">
              <label className="text-text-muted">请输入交易员主密码以确认熔断执行：</label>
              <input
                type="password"
                value={panicMasterPassword}
                onChange={(e) => setPanicMasterPassword(e.target.value)}
                placeholder="输入本地主密码"
                className="w-full bg-bg-elevated border border-bg-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-trade-down"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setIsPanicModalOpen(false);
                  setPanicResultMsg(null);
                }}
                disabled={isPanicExecuting}
                className="px-4 py-2 rounded-lg bg-bg-elevated hover:bg-bg-border text-text-secondary hover:text-text-primary text-xs font-medium"
              >
                取消
              </button>
              <button
                onClick={handleExecutePanic}
                disabled={isPanicExecuting}
                className="px-5 py-2 rounded-lg bg-trade-down hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-trade-down/30 flex items-center space-x-1.5"
              >
                {isPanicExecuting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isPanicExecuting ? '紧急全平执行中...' : '确认立即全平并锁死'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
