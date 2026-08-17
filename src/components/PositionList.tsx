/**
 * @file PositionList.tsx
 * @description OKX-Dog 实时活跃持仓、当前挂单与历史成交综合管理面板
 * 支持三大 Tab 切换：活跃持仓 (带 TP/SL 调整与快捷平仓)、当前挂单 (带撤单)、历史成交战绩明细
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Clock,
  History,
  Layers,
  FileText,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { tradeApi } from '../services/api';
import { PositionModel, PositionTPSLRequest, OrderModel } from '../types';

export const PositionList: React.FC = () => {
  const { positions, setPositions, orders, setOrders, riskStatus } = useAppStore();

  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [loading, setLoading] = useState(false);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);

  // 调整止盈止损弹窗状态
  const [selectedPosForTPSL, setSelectedPosForTPSL] = useState<PositionModel | null>(null);
  const [tpslTp, setTpslTp] = useState<string>('');
  const [tpslSl, setTpslSl] = useState<string>('');
  const [tpslSubmitting, setTpslSubmitting] = useState(false);
  const [tpslMsg, setTpslMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // 平仓确认弹窗状态
  const [closeTargetPos, setCloseTargetPos] = useState<PositionModel | null>(null);
  const [closeType, setCloseType] = useState<'market' | 'limit'>('market');
  const [closePrice, setClosePrice] = useState<string>('');
  const [closeSize, setCloseSize] = useState<string>('');
  const [closing, setClosing] = useState(false);

  // 撤单处理状态
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);

  /**
   * 刷新当前 Tab 对应数据
   */
  const handleRefreshData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'positions') {
        const data = await tradeApi.getPositions();
        setPositions(Array.isArray(data) ? data : []);
      } else if (activeTab === 'orders') {
        const orderList = await tradeApi.getOrders();
        setOrders(Array.isArray(orderList) ? orderList : []);
      } else if (activeTab === 'history') {
        const historyList = await tradeApi.getHistory();
        setClosedTrades(Array.isArray(historyList) ? historyList : []);
      }
    } catch (err) {
      console.warn('[PositionList] 刷新数据异常:', err);
    } finally {
      setLoading(false);
    }
  };

  // 切换 Tab 时自动拉取对应数据
  useEffect(() => {
    handleRefreshData();
  }, [activeTab]);

  // 定时刷新活跃持仓与挂单
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeTab === 'positions') {
        tradeApi.getPositions().then((res) => setPositions(Array.isArray(res) ? res : [])).catch(() => {});
      } else if (activeTab === 'orders') {
        tradeApi.getOrders().then((res) => setOrders(Array.isArray(res) ? res : [])).catch(() => {});
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [activeTab, setPositions, setOrders]);

  /**
   * 打开调整 TP/SL 弹窗
   */
  const openTPSLModal = (pos: PositionModel) => {
    setSelectedPosForTPSL(pos);
    setTpslTp(pos.tp_trigger_price ? String(pos.tp_trigger_price) : '');
    setTpslSl(pos.sl_trigger_price ? String(pos.sl_trigger_price) : '');
    setTpslMsg(null);
  };

  /**
   * 提交调整 TP/SL
   */
  const handleSaveTPSL = async () => {
    if (!selectedPosForTPSL) return;
    setTpslSubmitting(true);
    setTpslMsg(null);

    const payload: PositionTPSLRequest = {
      symbol: selectedPosForTPSL.symbol,
      pos_side: selectedPosForTPSL.pos_side,
      tp_trigger_price: tpslTp ? parseFloat(tpslTp) : null,
      sl_trigger_price: tpslSl ? parseFloat(tpslSl) : null,
    };

    try {
      await tradeApi.setPositionTPSL(payload);
      setPositions(
        positions.map((p) =>
          p.pos_id === selectedPosForTPSL.pos_id || p.id === selectedPosForTPSL.id
            ? { ...p, tp_trigger_price: payload.tp_trigger_price, sl_trigger_price: payload.sl_trigger_price }
            : p
        )
      );
      setTpslMsg({ text: '止盈止损参数已成功更新！', isError: false });
      setTimeout(() => {
        setSelectedPosForTPSL(null);
        setTpslMsg(null);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新 TP/SL 失败';
      setTpslMsg({ text: msg, isError: true });
    } finally {
      setTpslSubmitting(false);
    }
  };

  /**
   * 打开快捷平仓弹窗
   */
  const openCloseModal = (pos: PositionModel, type: 'market' | 'limit') => {
    setCloseTargetPos(pos);
    setCloseType(type);
    setClosePrice(type === 'limit' ? String(pos.mark_price) : '');
    setCloseSize(String(pos.pos_size));
  };

  /**
   * 执行平仓操作
   */
  const handleExecuteClose = async () => {
    if (!closeTargetPos) return;
    setClosing(true);

    try {
      await tradeApi.closePosition({
        symbol: closeTargetPos.symbol,
        pos_side: closeTargetPos.pos_side,
        order_type: closeType,
        price: closeType === 'limit' ? parseFloat(closePrice) : null,
        size: parseFloat(closeSize) || null,
      });

      // 从列表中剔除已平仓位并刷新持仓与资产
      setPositions(
        positions.filter(
          (p) => p.pos_id !== closeTargetPos.pos_id && p.id !== closeTargetPos.id
        )
      );
      setCloseTargetPos(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '平仓执行失败';
      alert(`平仓失败: ${msg}`);
    } finally {
      setClosing(false);
    }
  };

  /**
   * 撤单操作
   */
  const handleCancelOrder = async (order: OrderModel) => {
    const oid = order.okx_order_id || order.client_order_id;
    setCancelingOrderId(oid);
    try {
      await tradeApi.cancelOrder({
        symbol: order.symbol,
        order_id: oid,
        client_order_id: order.client_order_id,
      });
      setOrders(orders.filter((o) => o.client_order_id !== order.client_order_id && o.okx_order_id !== oid));
    } catch (err) {
      console.warn('撤单失败:', err);
    } finally {
      setCancelingOrderId(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full rounded-lg border border-bg-border bg-bg-secondary overflow-hidden shadow-lg select-none">
      {/* 1. 顶部 Tab 切换与操作栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-bg-border bg-bg-secondary shrink-0">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeTab === 'positions'
                ? 'bg-bg-elevated text-trade-ai border border-bg-border shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>活跃持仓 ({positions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-bg-elevated text-trade-ai border border-bg-border shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>当前挂单/委托 ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-bg-elevated text-trade-ai border border-bg-border shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>历史成交记录 ({closedTrades.length})</span>
          </button>
        </div>

        <button
          onClick={handleRefreshData}
          disabled={loading}
          className="flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-bg-elevated border border-transparent hover:border-bg-border transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-trade-ai' : ''}`} />
          <span>刷新数据</span>
        </button>
      </div>

      {/* 2. 内容主体 */}
      <div className="flex-1 overflow-auto text-xs">
        {/* Tab 1: 活跃持仓 */}
        {activeTab === 'positions' && (
          <>
            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted py-10 space-y-1.5">
                <Layers className="w-7 h-7 text-text-muted/40" />
                <span className="text-sm font-medium">当前暂无活跃持仓</span>
                <span className="text-[11px] text-text-muted/80">可通过左侧下单控制台或 AI 智能交易副驾驶一键开仓</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse font-mono-num">
                <thead>
                  <tr className="border-b border-bg-border bg-bg-primary/50 text-[10px] font-mono text-text-muted">
                    <th className="py-2 px-3 font-medium">标的 / 方向</th>
                    <th className="py-2 px-3 font-medium">持仓量</th>
                    <th className="py-2 px-3 font-medium">开仓均价</th>
                    <th className="py-2 px-3 font-medium">最新标记价</th>
                    <th className="py-2 px-3 font-medium">未实现盈亏 (ROI)</th>
                    <th className="py-2 px-3 font-medium">预估强平价</th>
                    <th className="py-2 px-3 font-medium">保证金</th>
                    <th className="py-2 px-3 font-medium">止盈 / 止损</th>
                    <th className="py-2 px-3 font-medium text-right">平仓操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-border/60">
                  {positions.map((pos) => {
                    const isLong = pos.pos_side?.toLowerCase() === 'long';
                    const upl = pos.upl ?? 0;
                    const uplRatio = (pos.upl_ratio ?? 0) * 100;
                    const isProfitable = upl >= 0;

                    return (
                      <tr key={pos.pos_id || pos.id} className="hover:bg-bg-elevated/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-1.5 font-bold">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                isLong ? 'bg-trade-up/15 text-trade-up border border-trade-up/30' : 'bg-trade-down/15 text-trade-down border border-trade-down/30'
                              }`}
                            >
                              {isLong ? '做多' : '做空'} {pos.leverage}x
                            </span>
                            <span className="text-text-primary text-xs">{pos.symbol}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-text-primary">
                          {pos.pos_size} <span className="text-[10px] text-text-muted">张/币</span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary">${(pos.avg_price ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-semibold text-text-primary">${(pos.mark_price ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-bold">
                          <span className={isProfitable ? 'text-trade-up' : 'text-trade-down'}>
                            {isProfitable ? '+' : ''}${upl.toFixed(2)} ({isProfitable ? '+' : ''}{uplRatio.toFixed(2)}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-trade-warning font-medium">
                          {pos.liquidation_price ? `$${(pos.liquidation_price).toLocaleString()}` : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary">
                          ${(pos.margin ?? 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col text-[10px] space-y-0.5">
                            <span className="text-trade-up font-mono">
                              TP: {pos.tp_trigger_price ? `$${pos.tp_trigger_price}` : '--'}
                            </span>
                            <span className="text-trade-down font-mono">
                              SL: {pos.sl_trigger_price ? `$${pos.sl_trigger_price}` : '--'}
                            </span>
                            <button
                              onClick={() => openTPSLModal(pos)}
                              className="text-trade-ai hover:underline text-[9px] text-left cursor-pointer"
                            >
                              [修改]
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => openCloseModal(pos, 'market')}
                              disabled={riskStatus === 'PANIC_LOCKED'}
                              className="px-2.5 py-1 rounded bg-bg-elevated hover:bg-trade-down hover:text-white border border-bg-border text-text-secondary text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              市价全平
                            </button>
                            <button
                              onClick={() => openCloseModal(pos, 'limit')}
                              disabled={riskStatus === 'PANIC_LOCKED'}
                              className="px-2.5 py-1 rounded bg-bg-elevated hover:bg-bg-border border border-bg-border text-text-secondary text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              限价平仓
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Tab 2: 当前挂单 / 委托 */}
        {activeTab === 'orders' && (
          <>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted py-10 space-y-1.5">
                <FileText className="w-7 h-7 text-text-muted/40" />
                <span className="text-sm font-medium">当前暂无未成交挂单</span>
                <span className="text-[11px] text-text-muted/80">提交的限价挂单或条件委托将在此处显示</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse font-mono-num">
                <thead>
                  <tr className="border-b border-bg-border bg-bg-primary/50 text-[10px] font-mono text-text-muted">
                    <th className="py-2 px-3 font-medium">委托单号</th>
                    <th className="py-2 px-3 font-medium">标的 / 类型</th>
                    <th className="py-2 px-3 font-medium">方向 / 杠杆</th>
                    <th className="py-2 px-3 font-medium">委托价</th>
                    <th className="py-2 px-3 font-medium">委托量 / 已成交</th>
                    <th className="py-2 px-3 font-medium">名义金额</th>
                    <th className="py-2 px-3 font-medium">状态</th>
                    <th className="py-2 px-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-border/60">
                  {orders.map((ord) => {
                    const isBuy = ord.side?.toLowerCase() === 'buy';
                    const isCanceling = cancelingOrderId === ord.okx_order_id || cancelingOrderId === ord.client_order_id;

                    return (
                      <tr key={ord.client_order_id || ord.okx_order_id} className="hover:bg-bg-elevated/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-text-muted">
                          {ord.client_order_id || ord.okx_order_id}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-text-primary">{ord.symbol}</div>
                          <div className="text-[10px] text-text-muted uppercase">{ord.order_type}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isBuy ? 'bg-trade-up/15 text-trade-up' : 'bg-trade-down/15 text-trade-down'
                            }`}
                          >
                            {isBuy ? '买入' : '卖出'} {ord.pos_side?.toUpperCase()} {ord.leverage}x
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-text-primary">
                          ${(ord.price ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          {ord.sz} / <span className="text-trade-ai font-semibold">{ord.filled_sz ?? 0}</span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary">
                          ${(ord.notional_usdt ?? ((ord.price ?? 0) * (ord.sz ?? 0))).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-bg-elevated text-trade-ai border border-trade-ai/30">
                            {ord.state || '已提交'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleCancelOrder(ord)}
                            disabled={isCanceling}
                            className="px-2.5 py-1 rounded bg-bg-elevated hover:bg-trade-down hover:text-white border border-bg-border text-text-secondary text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            {isCanceling ? '撤单中...' : '撤销'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Tab 3: 历史成交记录 */}
        {activeTab === 'history' && (
          <>
            {closedTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted py-10 space-y-1.5">
                <History className="w-7 h-7 text-text-muted/40" />
                <span className="text-sm font-medium">暂无历史平仓记录</span>
                <span className="text-[11px] text-text-muted/80">已完成平仓的订单与盈亏归因将在此归档</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse font-mono-num">
                <thead>
                  <tr className="border-b border-bg-border bg-bg-primary/50 text-[10px] font-mono text-text-muted">
                    <th className="py-2 px-3 font-medium">平仓时间</th>
                    <th className="py-2 px-3 font-medium">标的 / 方向</th>
                    <th className="py-2 px-3 font-medium">开仓价 → 平仓价</th>
                    <th className="py-2 px-3 font-medium">数量 / 杠杆</th>
                    <th className="py-2 px-3 font-medium">已实现盈亏 (USDT)</th>
                    <th className="py-2 px-3 font-medium">收益率 (ROI)</th>
                    <th className="py-2 px-3 font-medium text-right">平仓原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-border/60">
                  {closedTrades.map((trade, idx) => {
                    const isLong = trade.pos_side?.toLowerCase() === 'long';
                    const pnl = trade.realized_pnl ?? 0;
                    const roi = trade.roi_pct ?? 0;
                    const isWin = pnl >= 0;

                    return (
                      <tr key={idx} className="hover:bg-bg-elevated/40 transition-colors">
                        <td className="py-2.5 px-3 text-[11px] text-text-muted">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isLong ? 'bg-trade-up/15 text-trade-up' : 'bg-trade-down/15 text-trade-down'
                            }`}
                          >
                            {isLong ? '做多' : '做空'}
                          </span>
                          <span className="ml-1.5 font-bold text-text-primary">{trade.symbol}</span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary">
                          ${(trade.entry_price ?? 0).toLocaleString()} <span className="text-text-muted">➔</span> ${(trade.exit_price ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-text-primary">
                          {trade.size} ({trade.leverage}x)
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          <span className={isWin ? 'text-trade-up' : 'text-trade-down'}>
                            {isWin ? '+' : ''}${pnl.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          <span className={isWin ? 'text-trade-up' : 'text-trade-down'}>
                            {isWin ? '+' : ''}{roi.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[11px] text-text-muted">
                          {trade.reason || '正常平仓'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* 3. 调整止盈止损弹窗 */}
      {selectedPosForTPSL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-bg-border bg-bg-secondary p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-bg-border">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-trade-ai" />
                <span className="font-bold text-sm text-text-primary">设置 / 修改止盈止损</span>
              </div>
              <button
                onClick={() => setSelectedPosForTPSL(null)}
                className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tpslMsg && (
              <div
                className={`p-2 rounded text-xs flex items-center space-x-1.5 ${
                  tpslMsg.isError
                    ? 'bg-trade-down/15 border border-trade-down text-trade-down'
                    : 'bg-trade-up/15 border border-trade-up text-trade-up'
                }`}
              >
                {tpslMsg.isError ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{tpslMsg.text}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-muted mb-1">止盈触发价格 (TP Price)</label>
                <input
                  type="number"
                  placeholder="如: 68000"
                  value={tpslTp}
                  onChange={(e) => setTpslTp(e.target.value)}
                  className="w-full rounded bg-bg-elevated border border-bg-border px-3 py-2 text-text-primary font-mono outline-none focus:border-trade-up"
                />
              </div>

              <div>
                <label className="block text-text-muted mb-1">止损触发价格 (SL Price)</label>
                <input
                  type="number"
                  placeholder="如: 61500"
                  value={tpslSl}
                  onChange={(e) => setTpslSl(e.target.value)}
                  className="w-full rounded bg-bg-elevated border border-bg-border px-3 py-2 text-text-primary font-mono outline-none focus:border-trade-down"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedPosForTPSL(null)}
                className="px-3 py-1.5 rounded bg-bg-elevated text-text-muted hover:text-text-primary text-xs"
              >
                取消
              </button>
              <button
                onClick={handleSaveTPSL}
                disabled={tpslSubmitting}
                className="px-4 py-1.5 rounded bg-trade-ai hover:bg-trade-ai/90 text-white font-bold text-xs"
              >
                {tpslSubmitting ? '保存中...' : '确认保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 平仓弹窗 */}
      {closeTargetPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-bg-border bg-bg-secondary p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-bg-border">
              <span className="font-bold text-sm text-text-primary">
                {closeType === 'market' ? '市价快速平仓' : '限价平仓'} - {closeTargetPos.symbol}
              </span>
              <button
                onClick={() => setCloseTargetPos(null)}
                className="p-1 rounded text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {closeType === 'limit' && (
                <div>
                  <label className="block text-text-muted mb-1">平仓委托价格</label>
                  <input
                    type="number"
                    value={closePrice}
                    onChange={(e) => setClosePrice(e.target.value)}
                    className="w-full rounded bg-bg-elevated border border-bg-border px-3 py-2 text-text-primary font-mono outline-none focus:border-trade-ai"
                  />
                </div>
              )}

              <div>
                <label className="block text-text-muted mb-1">平仓数量 (当前持仓: {closeTargetPos.pos_size})</label>
                <input
                  type="number"
                  value={closeSize}
                  onChange={(e) => setCloseSize(e.target.value)}
                  className="w-full rounded bg-bg-elevated border border-bg-border px-3 py-2 text-text-primary font-mono outline-none focus:border-trade-ai"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setCloseTargetPos(null)}
                className="px-3 py-1.5 rounded bg-bg-elevated text-text-muted hover:text-text-primary text-xs"
              >
                取消
              </button>
              <button
                onClick={handleExecuteClose}
                disabled={closing}
                className="px-4 py-1.5 rounded bg-trade-down hover:bg-red-700 text-white font-bold text-xs"
              >
                {closing ? '平仓中...' : '确认平仓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

