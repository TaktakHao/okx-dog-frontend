/**
 * @file TradeList.tsx
 * @description OKX-Dog 实时逐笔成交记录组件
 * 渲染买卖双向成交流 (Buy 绿 / Sell 红)、大单异动呼吸光效高亮与毫秒级时间戳
 */

import React, { useEffect, useState, useRef } from 'react';
import { Activity, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MarketTrade } from '../types';
import {
  getBaseCurrency,
  formatPrice,
  formatSize,
  getSymbolDefaultPrice,
} from '../utils/symbolHelper';

export const TradeList: React.FC = () => {
  const {
    activeSymbol,
    ticker,
    trades: storeTrades,
    setSelectedPrice,
  } = useAppStore();

  const [trades, setTrades] = useState<MarketTrade[]>([]);

  /**
   * 生成模拟成交记录
   */
  const generateMockTrade = (basePrice: number): MarketTrade => {
    const isBuy = Math.random() > 0.48;
    const priceOffset = (Math.random() - 0.5) * (basePrice * 0.001);
    const price = Number((basePrice + priceOffset).toFixed(basePrice >= 100 ? 2 : 4));
    const size = Number((0.05 + Math.random() * 2.5).toFixed(3));
    const isWhale = size >= 1.8;

    return {
      trade_id: `T_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      symbol: activeSymbol,
      side: isBuy ? 'buy' : 'sell',
      price,
      size,
      timestamp: Date.now(),
      is_whale_trade: isWhale,
    };
  };

  // 初始化历史成交记录
  useEffect(() => {
    const activePrice = ticker && ticker.symbol === activeSymbol ? ticker.last_price : undefined;
    const base = activePrice || getSymbolDefaultPrice(activeSymbol);
    const initialTrades: MarketTrade[] = [];
    const prec = base >= 100 ? 1 : 4;
    for (let i = 0; i < 25; i++) {
      initialTrades.push({
        trade_id: `T_INIT_${i}`,
        symbol: activeSymbol,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        price: Number((base + (Math.random() - 0.5) * (base * 0.001)).toFixed(prec)),
        size: Number((0.08 + Math.random() * 2.2).toFixed(3)),
        timestamp: Date.now() - (25 - i) * 1200,
        is_whale_trade: Math.random() > 0.85,
      });
    }
    setTrades(initialTrades.reverse());
  }, [activeSymbol]);

  // 监听 Store 中的成交推流
  useEffect(() => {
    if (storeTrades.length > 0 && storeTrades[0]?.symbol === activeSymbol) {
      setTrades(storeTrades);
    }
  }, [storeTrades, activeSymbol]);

  const lastPriceRef = useRef<number | undefined>(
    ticker && ticker.symbol === activeSymbol ? ticker.last_price : undefined
  );
  lastPriceRef.current = ticker && ticker.symbol === activeSymbol ? ticker.last_price : undefined;

  // 模拟沙盒成交流水 (若无外部 WS 流)
  useEffect(() => {
    const timer = setInterval(() => {
      const base = lastPriceRef.current || getSymbolDefaultPrice(activeSymbol);
      const newTrade = generateMockTrade(base);
      setTrades((prev) => [newTrade, ...prev.slice(0, 49)]);
    }, 1500 + Math.random() * 1000);

    return () => clearInterval(timer);
  }, [activeSymbol]);


  return (
    <div className="flex flex-col h-full w-full rounded-lg border border-bg-border bg-bg-secondary overflow-hidden shadow-lg select-none">
      {/* 1. 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bg-border bg-bg-secondary">
        <div className="flex items-center space-x-1.5">
          <Activity className="w-3.5 h-3.5 text-trade-ai" />
          <span className="text-xs font-semibold text-text-primary">实时成交 (Trades)</span>
        </div>
        <span className="flex items-center text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-trade-up mr-1 animate-pulse" />
          Live
        </span>
      </div>

      {/* 2. 表头 */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] font-mono text-text-muted border-b border-bg-border/60 bg-bg-primary/40">
        <span>价格 (USDT)</span>
        <span className="text-right">数量 ({getBaseCurrency(activeSymbol)})</span>
        <span className="text-right">时间</span>
      </div>

      {/* 3. 逐笔成交列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-0.5 text-[11px] font-mono-num">
        {trades.map((trade) => {
          const isBuy = trade.side === 'buy';
          const timeStr = new Date(trade.timestamp).toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <div
              key={trade.trade_id}
              onClick={() => setSelectedPrice(trade.price)}
              className={`grid grid-cols-3 px-2 py-1 rounded cursor-pointer transition-all ${
                trade.is_whale_trade
                  ? isBuy
                    ? 'bg-trade-up/15 border border-trade-up/30 animate-pulse'
                    : 'bg-trade-down/15 border border-trade-down/30 animate-pulse'
                  : 'hover:bg-bg-elevated'
              }`}
              title={trade.is_whale_trade ? '⚡ 大单异动成交' : '点击填入价格'}
            >
              {/* 价格 */}
              <span className={`font-semibold flex items-center space-x-1 ${isBuy ? 'text-trade-up' : 'text-trade-down'}`}>
                {trade.is_whale_trade && <Zap className="w-3 h-3 text-amber-400 shrink-0" />}
                <span>{formatPrice(trade.price, activeSymbol)}</span>
              </span>

              {/* 数量 */}
              <span className="text-right text-text-primary font-medium">
                {formatSize(trade.size, activeSymbol)}
              </span>

              {/* 时间 */}
              <span className="text-right text-text-muted text-[10px]">
                {timeStr}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
