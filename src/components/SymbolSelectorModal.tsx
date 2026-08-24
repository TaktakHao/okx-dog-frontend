/**
 * OKX-Dog 金融量化交易终端 - 全景标的检索与自选切换器 (Symbol Explorer Modal)
 * 模块: okx-dog-frontend/src/components/SymbolSelectorModal.tsx
 * 支持实盘持仓联动、TradFi / 美股大宗 / RWA 专区、主流加密、自选管理与自定义标的代码快速添加
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Star,
  X,
  Building2,
  Coins,
  Briefcase,
  Plus,
  Check,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { marketApi } from '../services/api';
import { InstrumentInfo, SymbolCategoryGroup } from '../types';
import {
  getSymbolDisplayName,
  getSymbolBadge,
  isTradFiSymbol,
} from '../utils/symbolHelper';

interface SymbolSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
}

export const SymbolSelectorModal: React.FC<SymbolSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectSymbol,
}) => {
  const { activeSymbol, positions, isLiveMode, focusSymbols, addFocusSymbol, removeFocusSymbol } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'positions' | 'tradfi' | 'crypto' | 'watchlist'>('tradfi');
  const [categoryGroups, setCategoryGroups] = useState<SymbolCategoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const watchlist = focusSymbols;

  const toggleFavorite = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    if (focusSymbols.includes(symbol)) {
      removeFocusSymbol(symbol);
    } else {
      addFocusSymbol(symbol);
    }
  };

  // 标的库拉取
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchSymbols = async () => {
      try {
        setIsLoading(true);
        const res = await marketApi.getSymbols(searchQuery.trim() || undefined);
        if (isMounted && res?.categories) {
          setCategoryGroups(res.categories);
        }
      } catch (err) {
        console.warn('拉取标的列表失败:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchSymbols, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery]);

  // 如果有实盘持仓，且用户打开弹窗，默认可优先展示持仓或 TradFi
  useEffect(() => {
    if (isOpen && positions && positions.length > 0) {
      // 保持用户偏好或持仓优先
    }
  }, [isOpen, positions]);

  // 持仓标的列表
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

  // 全部平面标的池
  const allSymbolsList: InstrumentInfo[] = useMemo(() => {
    const map = new Map<string, InstrumentInfo>();
    categoryGroups.forEach((cg) => {
      cg.symbols.forEach((s) => map.set(s.symbol, s));
    });
    return Array.from(map.values());
  }, [categoryGroups]);

  // 过滤后的标的列表
  const displayedSymbols = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();

    if (q) {
      return allSymbolsList.filter(
        (s) =>
          s.symbol.toUpperCase().includes(q) ||
          s.name.toUpperCase().includes(q) ||
          s.base_ccy.toUpperCase().includes(q)
      );
    }

    if (activeTab === 'positions') {
      return allSymbolsList.filter((s) => positionSymbols.some((p) => p.symbol === s.symbol));
    }

    if (activeTab === 'watchlist') {
      return allSymbolsList.filter((s) => watchlist.includes(s.symbol));
    }

    if (activeTab === 'tradfi') {
      return allSymbolsList.filter(
        (s) =>
          s.is_tradfi ||
          ['tradfi', 'rwa', 'equities', 'commodities'].includes(s.category.toLowerCase())
      );
    }

    if (activeTab === 'crypto') {
      return allSymbolsList.filter(
        (s) =>
          !s.is_tradfi &&
          ['crypto'].includes(s.category.toLowerCase())
      );
    }

    return allSymbolsList;
  }, [activeTab, searchQuery, allSymbolsList, positionSymbols, watchlist]);

  // 快捷直接添加并切换自定义输入代码
  const handleAddCustomSymbol = () => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return;
    let custom = q;
    if (!custom.includes('-')) {
      custom = `${custom}-USDT-SWAP`;
    }
    if (!focusSymbols.includes(custom)) {
      addFocusSymbol(custom);
    }
    onSelectSymbol(custom);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-bg-secondary border border-bg-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部 Header 与 搜索栏 */}
        <div className="p-4 border-b border-bg-border bg-bg-elevated/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded bg-trade-ai/20 flex items-center justify-center text-trade-ai">
                <Globe className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-text-primary tracking-wide">
                全景交易标的与 TradFi 资产探索
              </h2>
              <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-bg-elevated border border-bg-border">
                {isLiveMode ? '💼 实盘联动' : '🎮 模拟操盘'}
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
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标的代码/名称 (如 XAU 黄金, NVDA 美股, ONDO RWA, BTC, ETH...)"
              className="w-full bg-bg-base border border-bg-border rounded-lg pl-9 pr-24 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai transition-colors font-mono"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={handleAddCustomSymbol}
                className="absolute right-2 px-2 py-1 text-[11px] font-medium rounded bg-trade-ai/20 text-trade-ai hover:bg-trade-ai/30 transition-colors flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>直达此标的</span>
              </button>
            )}
          </div>
        </div>

        {/* 分类 Tabs 导航 */}
        {!searchQuery && (
          <div className="flex items-center space-x-1 px-4 py-2 bg-bg-base border-b border-bg-border overflow-x-auto scrollbar-none text-xs">
            <button
              onClick={() => setActiveTab('tradfi')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                activeTab === 'tradfi'
                  ? 'bg-trade-ai text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>🏛️ TradFi / 美股大宗 / RWA</span>
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
              onClick={() => setActiveTab('crypto')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                activeTab === 'crypto'
                  ? 'bg-trade-ai text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>🚀 主流加密</span>
            </button>

            <button
              onClick={() => setActiveTab('watchlist')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                activeTab === 'watchlist'
                  ? 'bg-trade-ai text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>⭐ 我的自选 ({watchlist.length})</span>
            </button>
          </div>
        )}

        {/* 标的列表展示区 */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-bg-border/40">
          {/* 实盘持仓置顶快捷卡片 (如果选中的是持仓 Tab 或有持仓) */}
          {activeTab === 'positions' && positionSymbols.length > 0 && !searchQuery && (
            <div className="p-2 mb-2 bg-trade-ai/5 border border-trade-ai/20 rounded-lg">
              <div className="text-[11px] font-semibold text-trade-ai mb-2 flex items-center space-x-1">
                <Briefcase className="w-3.5 h-3.5" />
                <span>当前账户持仓标的 (点击直接切换操盘与监控)</span>
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
                      onClick={() => {
                        onSelectSymbol(pos.symbol);
                        onClose();
                      }}
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
                          {pos.isTradFi && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-400 font-bold">
                              TradFi
                            </span>
                          )}
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

          {/* 标的列表渲染 */}
          {displayedSymbols.length > 0 ? (
            displayedSymbols.map((item) => {
              const isSelected = activeSymbol === item.symbol;
              const isFav = watchlist.includes(item.symbol);
              const badge = getSymbolBadge(item.symbol);
              const isPos = positionSymbols.some((p) => p.symbol === item.symbol);

              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    onSelectSymbol(item.symbol);
                    onClose();
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 hover:bg-bg-elevated cursor-pointer transition-colors group ${
                    isSelected ? 'bg-bg-elevated/80' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={(e) => toggleFavorite(e, item.symbol)}
                      className={`p-1 rounded transition-colors ${
                        isFav
                          ? 'text-amber-400 hover:text-amber-300'
                          : 'text-text-muted hover:text-text-secondary opacity-40 group-hover:opacity-100'
                      }`}
                      title={isFav ? '取消自选' : '加入自选'}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                    </button>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs font-mono text-text-primary">
                          {item.symbol}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border font-medium ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-[9px] px-1 rounded bg-bg-base border border-bg-border text-text-muted font-mono">
                          {item.inst_type}
                        </span>
                        {isPos && (
                          <span className="text-[9px] px-1 rounded bg-trade-ai/20 text-trade-ai font-bold">
                            持仓中
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {item.name || getSymbolDisplayName(item.symbol)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isSelected ? (
                      <span className="flex items-center space-x-1 text-xs text-trade-ai font-semibold px-2 py-0.5 rounded bg-trade-ai/10">
                        <Check className="w-3.5 h-3.5" />
                        <span>当前主监控</span>
                      </span>
                    ) : (
                      <button className="text-[11px] text-text-muted group-hover:text-trade-ai group-hover:bg-trade-ai/10 px-2 py-1 rounded transition-colors font-medium">
                        切换此标的
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-text-muted text-xs">
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-trade-ai border-t-transparent rounded-full animate-spin" />
                  <span>正在搜索标的池...</span>
                </div>
              ) : (
                <div>
                  <p className="mb-2">未找到完全匹配的标的</p>
                  {searchQuery && (
                    <button
                      onClick={handleAddCustomSymbol}
                      className="px-3 py-1.5 rounded-lg bg-trade-ai text-white text-xs font-medium hover:bg-trade-ai/90 transition-colors inline-flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>直接添加并切换到 "{searchQuery.toUpperCase()}"</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部 Footer 提示 */}
        <div className="p-3 border-t border-bg-border bg-bg-base text-[11px] text-text-muted flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-trade-ai" />
            <span>支持 OKX 上全量黄金大宗、美股代币化衍生品、RWA 资产与现货/永续合约</span>
          </div>
          <span className="font-mono text-[10px] text-text-secondary">
            ESC 或点击外部退出
          </span>
        </div>
      </div>
    </div>
  );
};
