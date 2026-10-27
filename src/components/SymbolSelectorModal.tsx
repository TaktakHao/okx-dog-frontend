/**
 * OKX-Dog 金融量化交易终端 - 欧易全量真实标的检索与一键订阅器 (Symbol Explorer Modal)
 * 模块: okx-dog-frontend/src/components/SymbolSelectorModal.tsx
 * 功能:
 * 1. 严格对接 OKX 官方真实在架产品池 (SWAP 永续 / SPOT 现货 / TradFi)，杜绝手写拼错非法代码
 * 2. 200ms 防抖多维模糊检索 (代码、币种、中文名、大宗外汇、美股代币)
 * 3. 一键「设为主监控」与一键「添加至订阅池 (Focus Bar)」，自动触发 WebSocket 动态推流
 * 4. 支持持仓标的置顶联动与自选 Watchlist 管理
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Star,
  X,
  Building2,
  Coins,
  Briefcase,
  Check,
  Globe,
  Sparkles,
  Zap,
  SlidersHorizontal,
  Flame,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { marketApi } from '../services/api';
import { InstrumentInfo } from '../types';
import {
  getSymbolDisplayName,
  isTradFiSymbol,
} from '../utils/symbolHelper';

interface SymbolSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
}

type TabType = 'all' | 'swap' | 'spot' | 'tradfi' | 'positions' | 'watchlist';

export const SymbolSelectorModal: React.FC<SymbolSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectSymbol,
}) => {
  const {
    activeSymbol,
    positions,
    isLiveMode,
    focusSymbols,
    addFocusSymbol,
    removeFocusSymbol,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchResults, setSearchResults] = useState<InstrumentInfo[]>([]);
  const [curatedSymbols, setCuratedSymbols] = useState<InstrumentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [subscribedToast, setSubscribedToast] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // 1. 打开弹窗时自动聚焦输入框并拉取初始推荐标的池
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    let isMounted = true;
    const fetchInitial = async () => {
      try {
        setIsLoading(true);
        // 先调用 search 获取默认热门列表
        const res = await marketApi.searchInstruments('', 'ALL', 'ALL', 50);
        if (isMounted && res?.instruments) {
          setCuratedSymbols(res.instruments);
        }
      } catch (err) {
        console.warn('拉取初始标的失败:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchInitial();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // 2. 200ms 防抖从后端 OKX 全量真实产品库中搜索
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const instTypeFilter =
          activeTab === 'swap'
            ? 'SWAP'
            : activeTab === 'spot'
            ? 'SPOT'
            : 'ALL';

        const res = await marketApi.searchInstruments(
          trimmed,
          instTypeFilter,
          'ALL',
          40
        );

        if (isMounted && res?.instruments) {
          setSearchResults(res.instruments);
        }
      } catch (err) {
        console.warn('检索 OKX 标的异常:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery, activeTab]);

  // 3. 实盘/模拟持仓标的提取
  const positionSymbols = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    return positions.map((pos) => ({
      symbol: pos.symbol,
      posSide: pos.pos_side,
      contracts: pos.pos,
      upl: pos.upl,
      uplRatio: pos.upl_ratio,
      entryPx: pos.avg_px,
      isTradFi: isTradFiSymbol(pos.symbol),
    }));
  }, [positions]);

  // 4. 最终展示列表过滤与聚合
  const displayedList = useMemo(() => {
    const isSearching = searchQuery.trim().length > 0;
    const source = isSearching ? searchResults : curatedSymbols;

    let filtered = source;

    // Tab 过滤
    if (activeTab === 'swap') {
      filtered = filtered.filter((s) => s.inst_type === 'SWAP');
    } else if (activeTab === 'spot') {
      filtered = filtered.filter((s) => s.inst_type === 'SPOT');
    } else if (activeTab === 'tradfi') {
      filtered = filtered.filter(
        (s) =>
          s.is_tradfi ||
          ['tradfi', 'rwa', 'equities', 'commodities'].includes(
            (s.category || '').toLowerCase()
          )
      );
    } else if (activeTab === 'positions') {
      filtered = filtered.filter((s) =>
        positionSymbols.some((p) => p.symbol === s.symbol)
      );
    } else if (activeTab === 'watchlist') {
      filtered = filtered.filter((s) => focusSymbols.includes(s.symbol));
    }

    return filtered;
  }, [
    searchQuery,
    searchResults,
    curatedSymbols,
    activeTab,
    positionSymbols,
    focusSymbols,
  ]);

  // 5. 点击加入/取消订阅关注处理
  const handleToggleSubscribe = async (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    const isSubbed = focusSymbols.includes(symbol);

    if (isSubbed) {
      removeFocusSymbol(symbol);
    } else {
      addFocusSymbol(symbol);
      // 调用后端 WebSocket 立即建立行情长连接推流
      try {
        await marketApi.subscribeFocus([symbol]);
      } catch (err) {
        console.warn('动态建立标的 WebSocket 订阅异常:', err);
      }
      setSubscribedToast(`已成功添加 ${symbol} 到关注流！`);
      setTimeout(() => setSubscribedToast(null), 2500);
    }
  };

  // 6. 切换为主图监控
  const handleSelectSymbol = (symbol: string) => {
    onSelectSymbol(symbol);
    onClose();
  };

  // 快捷键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && displayedList.length > 0) {
      handleSelectSymbol(displayedList[0].symbol);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-3xl bg-bg-secondary border border-bg-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部 Header 与 检索栏 */}
        <div className="p-4 border-b border-bg-border bg-bg-elevated/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded bg-trade-ai/20 flex items-center justify-center text-trade-ai">
                <Globe className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-text-primary tracking-wide">
                欧易全量标的检索与实时订阅
              </h2>
              <span className="text-[10px] text-emerald-400 font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center space-x-1">
                <Zap className="w-2.5 h-2.5" />
                <span>OKX 官方全量在架源</span>
              </span>
              <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-bg-elevated border border-bg-border">
                {isLiveMode ? '💼 实盘环境' : '🎮 模拟操盘'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 搜索输入框 */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索欧易官方真实标的 (支持 PEPE, SUI, DOGE, SOL, BTC, 黄金 XAU, 英伟达 NVDA 等)..."
              className="w-full bg-bg-primary border border-bg-border rounded-lg pl-9 pr-24 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai transition-colors font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 text-text-muted hover:text-text-primary text-xs"
                title="清空"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 订阅成功气泡提示 */}
          {subscribedToast && (
            <div className="mt-2 py-1 px-3 bg-trade-up/10 border border-trade-up/30 text-trade-up rounded-lg text-xs flex items-center space-x-2 animate-fade-in">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{subscribedToast}</span>
            </div>
          )}
        </div>

        {/* 分类过滤 Tabs 导航 */}
        <div className="flex items-center space-x-1 px-4 py-2 bg-bg-primary border-b border-bg-border overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-trade-ai text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>全量探索</span>
          </button>

          <button
            onClick={() => setActiveTab('swap')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'swap'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-purple-400" />
            <span>永续合约 (SWAP)</span>
          </button>

          <button
            onClick={() => setActiveTab('spot')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'spot'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-blue-400" />
            <span>现货交易 (SPOT)</span>
          </button>

          <button
            onClick={() => setActiveTab('tradfi')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'tradfi'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>🏛️ TradFi / 美股大宗</span>
          </button>

          {positionSymbols.length > 0 && (
            <button
              onClick={() => setActiveTab('positions')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                activeTab === 'positions'
                  ? 'bg-trade-ai text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>💼 我的持仓 ({positionSymbols.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'watchlist'
                ? 'bg-trade-ai text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>⭐ 我的自选 ({focusSymbols.length})</span>
          </button>
        </div>

        {/* 标的卡片列表区域 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* 实盘持仓标的快捷置顶展示 */}
          {activeTab === 'positions' && positionSymbols.length > 0 && (
            <div className="p-3 mb-2 bg-trade-ai/5 border border-trade-ai/20 rounded-lg">
              <div className="text-[11px] font-semibold text-trade-ai mb-2 flex items-center space-x-1">
                <Briefcase className="w-3.5 h-3.5" />
                <span>当前账户持仓标的 (点击立即聚焦监控)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {positionSymbols.map((pos) => {
                  const isLong = pos.posSide.toLowerCase().includes('long');
                  const upl = pos.upl ?? 0;
                  const uplRatio = (pos.uplRatio ?? 0) * 100;
                  const isCur = activeSymbol === pos.symbol;
                  return (
                    <div
                      key={pos.symbol}
                      onClick={() => handleSelectSymbol(pos.symbol)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        isCur
                          ? 'bg-bg-elevated border-trade-ai shadow-md'
                          : 'bg-bg-secondary border-bg-border hover:border-text-muted'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs font-mono text-text-primary">
                            {pos.symbol}
                          </span>
                          <span
                            className={`text-[9px] px-1 rounded font-bold ${
                              isLong
                                ? 'bg-trade-up/20 text-trade-up'
                                : 'bg-trade-down/20 text-trade-down'
                            }`}
                          >
                            {isLong ? '多头' : '空头'}
                          </span>
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          持仓: {pos.contracts} 张 @ ${(pos.entryPx ?? 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-xs font-bold font-mono ${
                            upl >= 0 ? 'text-trade-up' : 'text-trade-down'
                          }`}
                        >
                          {upl >= 0 ? '+' : ''}
                          {upl.toFixed(2)} USDT
                        </div>
                        <div
                          className={`text-[10px] font-mono ${
                            uplRatio >= 0 ? 'text-trade-up' : 'text-trade-down'
                          }`}
                        >
                          ({uplRatio >= 0 ? '+' : ''}
                          {uplRatio.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 搜索/推荐标的卡片列表 */}
          {displayedList.length > 0 ? (
            displayedList.map((item) => {
              const isSelected = activeSymbol === item.symbol;
              const isSubbed = focusSymbols.includes(item.symbol);
              const isSwap = item.inst_type === 'SWAP';
              const isSpot = item.inst_type === 'SPOT';

              return (
                <div
                  key={item.symbol}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-bg-elevated/90 border-trade-ai shadow-sm'
                      : 'bg-bg-primary/70 border-bg-border/60 hover:bg-bg-elevated/50 hover:border-text-muted/40'
                  }`}
                >
                  {/* 左侧标的信息 */}
                  <div className="flex items-center space-x-3">
                    {/* 自选收藏图标 */}
                    <button
                      onClick={(e) => handleToggleSubscribe(e, item.symbol)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        isSubbed
                          ? 'bg-amber-400/10 border-amber-400/40 text-amber-400'
                          : 'bg-bg-elevated border-bg-border text-text-muted hover:text-text-primary'
                      }`}
                      title={isSubbed ? '已在关注流中 (点击取消关注)' : '点击加入关注流 (Focus Bar)'}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          isSubbed ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                    </button>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs sm:text-sm font-mono text-text-primary">
                          {item.symbol}
                        </span>

                        {/* 类型徽章 */}
                        {isSwap && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            永续 {item.lever ? `${item.lever}x` : ''}
                          </span>
                        )}
                        {isSpot && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            现货
                          </span>
                        )}
                        {item.is_tradfi && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            TradFi
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[9px] px-1 rounded bg-trade-ai/20 text-trade-ai font-bold">
                            当前主图
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-text-muted mt-0.5 flex items-center space-x-2 font-mono">
                        <span>{item.name || getSymbolDisplayName(item.symbol)}</span>
                        <span>•</span>
                        <span>计价: {item.quote_ccy}</span>
                        {isSwap && item.ct_val && (
                          <>
                            <span>•</span>
                            <span>面值: {item.ct_val} {item.base_ccy}</span>
                          </>
                        )}
                        {item.tick_sz && (
                          <>
                            <span>•</span>
                            <span>步长: {item.tick_sz}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 右侧动作按键 */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {/* 一键加入订阅 / 移出订阅 */}
                    <button
                      onClick={(e) => handleToggleSubscribe(e, item.symbol)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors flex items-center space-x-1 ${
                        isSubbed
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                          : 'bg-bg-elevated text-text-secondary border border-bg-border hover:text-text-primary hover:border-trade-ai'
                      }`}
                    >
                      <span>{isSubbed ? '已订阅' : '+ 订阅'}</span>
                    </button>

                    {/* 设为主监控 */}
                    {isSelected ? (
                      <div className="px-3 py-1 rounded-lg bg-trade-ai/10 text-trade-ai border border-trade-ai/30 text-xs font-semibold flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>监控中</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSelectSymbol(item.symbol)}
                        className="px-3 py-1 rounded-lg bg-trade-ai text-white hover:bg-trade-ai/90 text-xs font-semibold transition-colors shadow-sm"
                      >
                        设为主图
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center text-text-muted text-xs">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center space-x-2 space-y-2">
                  <div className="w-6 h-6 border-2 border-trade-ai border-t-transparent rounded-full animate-spin" />
                  <span className="text-text-secondary">
                    正在检索欧易官方全量在架产品库...
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-w-sm mx-auto">
                  <p className="text-text-secondary font-medium">
                    未在欧易官方交易产品中找到 "{searchQuery.toUpperCase()}"
                  </p>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    系统已严格阻断手动输入不存在的虚假代码。请核对拼写（例如输入 BTC, ETH, SOL, PEPE, DOGE, SUI, XAU 等合法交易品种）。
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部 Footer 提示 */}
        <div className="p-3 border-t border-bg-border bg-bg-primary text-[11px] text-text-muted flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-trade-ai" />
            <span>
              已接入 OKX 全量真实合约与现货标的源，点击「+ 订阅」将直接接入长连接盯盘
            </span>
          </div>
          <span className="font-mono text-[10px] text-text-secondary hidden sm:inline">
            Enter 确认第一项 • ESC 退出
          </span>
        </div>
      </div>
    </div>
  );
};
