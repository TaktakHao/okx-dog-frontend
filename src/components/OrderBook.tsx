/**
 * @file OrderBook.tsx
 * @description OKX-Dog Level-2 深度订单簿组件
 * 20 档买卖盘口渲染、累计深度百分比背景条、requestAnimationFrame 节流缓冲 60 FPS 流畅保障
 * 支持点击价格一键回填至下单控制台、买卖盘口聚合与价差 Spread 实时计算
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Layers, ArrowUp, ArrowDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { marketApi } from '../services/api';
import { OrderBookDepth, OrderBookLevel } from '../types';

export const OrderBook: React.FC = () => {
  const {
    activeSymbol,
    ticker,
    setSelectedPrice,
    orderBook: storeOrderBook,
  } = useAppStore();

  const [viewMode, setViewMode] = useState<'both' | 'bids' | 'asks'>('both');
  const [localOrderBook, setLocalOrderBook] = useState<OrderBookDepth | null>(null);

  // rAF 高频缓冲引用
  const pendingUpdateRef = useRef<OrderBookDepth | null>(null);
  const rafHandleRef = useRef<number | null>(null);

  /**
   * 生成模拟高保真 20 档深度盘口
   */
  const generateFallbackDepth = (basePrice: number): OrderBookDepth => {
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];

    let bidCum = 0;
    let askCum = 0;

    for (let i = 1; i <= 20; i++) {
      const askPrice = Number((basePrice + i * 0.5).toFixed(1));
      const askSize = Number((0.2 + Math.random() * 2.8 + (i % 5 === 0 ? 4.5 : 0)).toFixed(3));
      askCum += askSize;
      asks.push({
        price: askPrice,
        size: askSize,
        cumulative_size: askCum,
        order_count: Math.floor(1 + Math.random() * 8),
      });

      const bidPrice = Number((basePrice - i * 0.5).toFixed(1));
      const bidSize = Number((0.2 + Math.random() * 2.8 + (i % 5 === 0 ? 4.5 : 0)).toFixed(3));
      bidCum += bidSize;
      bids.push({
        price: bidPrice,
        size: bidSize,
        cumulative_size: bidCum,
        order_count: Math.floor(1 + Math.random() * 8),
      });
    }

    return {
      symbol: activeSymbol,
      timestamp: Date.now(),
      bids,
      asks,
    };
  };

  /**
   * 采用 requestAnimationFrame 合并高频 WebSocket 深度推送，维持 60 FPS
   */
  const scheduleUpdate = (newDepth: OrderBookDepth) => {
    pendingUpdateRef.current = newDepth;
    if (!rafHandleRef.current) {
      rafHandleRef.current = requestAnimationFrame(() => {
        if (pendingUpdateRef.current) {
          setLocalOrderBook(pendingUpdateRef.current);
          pendingUpdateRef.current = null;
        }
        rafHandleRef.current = null;
      });
    }
  };

  // 监听 Store 中的 WebSocket 订单簿推送
  useEffect(() => {
    if (storeOrderBook) {
      scheduleUpdate(storeOrderBook);
    }
  }, [storeOrderBook]);

  // 定期拉取或初始化深度
  useEffect(() => {
    let isMounted = true;

    const getSymbolDefaultPrice = (sym: string) => {
      if (sym.includes('BTC')) return 63428.0;
      if (sym.includes('ETH')) return 2680.0;
      if (sym.includes('SOL')) return 188.0;
      return 0.155;
    };

    const fetchDepth = async () => {
      try {
        const depth = await marketApi.getDepth(activeSymbol, 20);
        if (isMounted && depth) {
          scheduleUpdate(depth);
        }
      } catch {
        const base = ticker?.last_price || getSymbolDefaultPrice(activeSymbol);
        if (isMounted) {
          scheduleUpdate(generateFallbackDepth(base));
        }
      }
    };

    fetchDepth();

    // 维持沙盒活跃跳动 (若无真实 WS 推送)
    const timer = setInterval(() => {
      if (!storeOrderBook) {
        const base = ticker?.last_price || getSymbolDefaultPrice(activeSymbol);
        scheduleUpdate(generateFallbackDepth(base));
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(timer);
      if (rafHandleRef.current) {
        cancelAnimationFrame(rafHandleRef.current);
      }
    };
  }, [activeSymbol, storeOrderBook, ticker?.last_price]);

  // 计算买卖盘累计最大深度，用于渲染背景比例条
  const { maxDepth, asksToRender, bidsToRender, spread, spreadPct } = useMemo(() => {
    const getSymbolDefaultPrice = (sym: string) => {
      if (sym.includes('BTC')) return 63428.0;
      if (sym.includes('ETH')) return 2680.0;
      if (sym.includes('SOL')) return 188.0;
      return 0.155;
    };
    const current = localOrderBook || generateFallbackDepth(ticker?.last_price || getSymbolDefaultPrice(activeSymbol));


    const limit = viewMode === 'both' ? 12 : 20;

    // 卖盘：低价在下，高价在上 (按价格升序排序后截取前 limit 档，再反转为降序展示)
    const rawAsks = Array.isArray(current?.asks) ? current.asks : [];
    const sortedAsks = [...rawAsks].sort((a, b) => a.price - b.price).slice(0, limit);
    const asksReversed = [...sortedAsks].reverse();

    // 买盘：高价在上，低价在下 (按价格降序排序)
    const rawBids = Array.isArray(current?.bids) ? current.bids : [];
    const sortedBids = [...rawBids].sort((a, b) => b.price - a.price).slice(0, limit);

    // 计算累计深度
    let aCum = 0;
    const computedAsks = sortedAsks.map((level) => {
      aCum += level.size;
      return { ...level, cumulative_size: aCum };
    });

    let bCum = 0;
    const computedBids = sortedBids.map((level) => {
      bCum += level.size;
      return { ...level, cumulative_size: bCum };
    });

    const maxA = computedAsks.length > 0 ? computedAsks[computedAsks.length - 1].cumulative_size || 1 : 1;
    const maxB = computedBids.length > 0 ? computedBids[computedBids.length - 1].cumulative_size || 1 : 1;
    const overallMax = Math.max(maxA, maxB, 1);

    // 计算买一卖一价差
    const bestBid = sortedBids[0]?.price || 0;
    const bestAsk = sortedAsks[0]?.price || 0;
    const sp = bestAsk > 0 && bestBid > 0 ? Number((bestAsk - bestBid).toFixed(1)) : 0.5;
    const spPct = bestBid > 0 ? Number(((sp / bestBid) * 100).toFixed(3)) : 0.001;

    return {
      maxDepth: overallMax,
      asksToRender: viewMode === 'bids' ? [] : asksReversed,
      bidsToRender: viewMode === 'asks' ? [] : computedBids,
      spread: sp,
      spreadPct: spPct,
    };
  }, [localOrderBook, viewMode, ticker?.last_price]);

  return (
    <div className="flex flex-col h-full w-full rounded-lg border border-bg-border bg-bg-secondary overflow-hidden shadow-lg select-none">
      {/* 1. 标题与模式切换栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bg-border bg-bg-secondary">
        <div className="flex items-center space-x-1.5">
          <Layers className="w-3.5 h-3.5 text-trade-ai" />
          <span className="text-xs font-semibold text-text-primary">订单簿 (Level-2)</span>
        </div>

        {/* 盘口展示模式切换 */}
        <div className="flex items-center space-x-1 bg-bg-elevated p-0.5 rounded border border-bg-border">
          <button
            onClick={() => setViewMode('both')}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
              viewMode === 'both' ? 'bg-bg-border text-text-primary font-bold' : 'text-text-muted hover:text-text-secondary'
            }`}
            title="买卖双向盘口"
          >
            双向
          </button>
          <button
            onClick={() => setViewMode('bids')}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
              viewMode === 'bids' ? 'bg-trade-up/20 text-trade-up font-bold' : 'text-text-muted hover:text-trade-up'
            }`}
            title="仅看买盘"
          >
            买盘
          </button>
          <button
            onClick={() => setViewMode('asks')}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
              viewMode === 'asks' ? 'bg-trade-down/20 text-trade-down font-bold' : 'text-text-muted hover:text-trade-down'
            }`}
            title="仅看卖盘"
          >
            卖盘
          </button>
        </div>
      </div>

      {/* 2. 表头 */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] font-mono text-text-muted border-b border-bg-border/60 bg-bg-primary/40">
        <span>价格 (USDT)</span>
        <span className="text-right">数量 (BTC)</span>
        <span className="text-right">累计深度</span>
      </div>

      {/* 3. 盘口列表区域 */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden text-[11px] font-mono-num p-1">
        {/* 卖盘 Asks (红) */}
        {viewMode !== 'bids' && (
          <div className="flex flex-col justify-end space-y-0.5 overflow-hidden">
            {asksToRender.map((ask) => {
              const depthPct = Math.min(100, Math.max(2, ((ask.cumulative_size || ask.size) / maxDepth) * 100));
              return (
                <div
                  key={`ask-${ask.price}`}
                  onClick={() => setSelectedPrice(ask.price)}
                  className="group relative grid grid-cols-3 px-2 py-0.5 cursor-pointer hover:bg-bg-elevated/80 rounded transition-colors"
                  title="点击将价格填入下单面板"
                >
                  {/* 背景累计深度条 (红) */}
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-trade-down/15 group-hover:bg-trade-down/25 transition-all pointer-events-none"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative z-10 text-trade-down font-medium">{(ask.price ?? 0).toFixed(1)}</span>
                  <span className="relative z-10 text-right text-text-primary">{(ask.size ?? 0).toFixed(3)}</span>
                  <span className="relative z-10 text-right text-text-muted">
                    {((ask.cumulative_size || ask.size) ?? 0).toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 中间：实时最新价与买卖价差 Spread */}
        <div className="my-1 px-2 py-1 bg-bg-elevated/70 border-y border-bg-border flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5">
            <span
              className={`font-bold font-mono-num ${
                (ticker?.change_24h_pct || 0) >= 0 ? 'text-trade-up' : 'text-trade-down'
              }`}
            >
              ${(ticker?.last_price || (activeSymbol.includes('BTC') ? 63428.0 : activeSymbol.includes('ETH') ? 2680.0 : activeSymbol.includes('SOL') ? 188.0 : 0.155)).toFixed(activeSymbol.includes('DOGE') ? 4 : 1)}

            </span>
            {(ticker?.change_24h_pct || 0) >= 0 ? (
              <ArrowUp className="w-3 h-3 text-trade-up" />
            ) : (
              <ArrowDown className="w-3 h-3 text-trade-down" />
            )}
          </div>
          <div className="flex items-center space-x-2 text-[10px] text-text-muted">
            <span>Spread</span>
            <span className="font-mono-num text-text-secondary">
              {(spread ?? 0).toFixed(1)} ({spreadPct ?? 0}%)
            </span>
          </div>
        </div>

        {/* 买盘 Bids (绿) */}
        {viewMode !== 'asks' && (
          <div className="flex flex-col space-y-0.5 overflow-hidden">
            {bidsToRender.map((bid) => {
              const depthPct = Math.min(100, Math.max(2, (((bid.cumulative_size || bid.size) ?? 0) / maxDepth) * 100));
              return (
                <div
                  key={`bid-${bid.price}`}
                  onClick={() => setSelectedPrice(bid.price)}
                  className="group relative grid grid-cols-3 px-2 py-0.5 cursor-pointer hover:bg-bg-elevated/80 rounded transition-colors"
                  title="点击将价格填入下单面板"
                >
                  {/* 背景累计深度条 (绿) */}
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-trade-up/15 group-hover:bg-trade-up/25 transition-all pointer-events-none"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative z-10 text-trade-up font-medium">{(bid.price ?? 0).toFixed(1)}</span>
                  <span className="relative z-10 text-right text-text-primary">{(bid.size ?? 0).toFixed(3)}</span>
                  <span className="relative z-10 text-right text-text-muted">
                    {((bid.cumulative_size || bid.size) ?? 0).toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
