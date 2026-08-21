/**
 * @file useAppStore.ts
 * @description OKX-Dog 全局状态中枢 (Zustand 状态分片与高频数据流管理)
 * 100% 严格对齐 TYPES_CONTRACT.ts 强类型契约
 */

import { create } from 'zustand';
import {
  TickerData,
  OrderBookDepth,
  MarketTrade,
  PositionModel,
  OrderModel,
  AccountBalanceModel,
  MultiPeriodIndicators,
  AIAnalysisResponse,
  HardRiskRules,
  AIAdoptPayload,
  TimeFrame,
  LLMConfig,
  AutoPilotStatusModel,
  AutoPilotHistoryResponse,
} from '../types';

export interface AppState {
  // 1. 安全凭证与运行模式
  hasConfiguredOkx: boolean;
  isLiveMode: boolean;
  apiKeyMasked: string | null;
  permissions: string[];
  hasWithdrawPermission: boolean;
  isSecurityModalOpen: boolean;
  securityModalTab: 'okx' | 'llm' | 'risk';

  // 1.05 模拟操盘沙盒状态
  isPaperModalOpen: boolean;
  paperInitialCapital: number;

  // 1.06 v3.5 AI Quant Studio 策略实验室
  isStudioModalOpen: boolean;

  // 1.1 大模型配置状态
  llmConfig: LLMConfig | null;

  // 2. 硬风控防线状态
  riskStatus: 'NORMAL' | 'WARNING' | 'CIRCUIT_BROKEN' | 'PANIC_LOCKED';
  circuitBreakReason: string | null;
  riskRules: HardRiskRules;

  // 3. 交易标的与周期
  activeSymbol: string;
  activeTimeframe: TimeFrame;

  // 4. 实时市场行情
  ticker: TickerData | null;
  orderBook: OrderBookDepth | null;
  trades: MarketTrade[];
  indicators: MultiPeriodIndicators | null;

  // 5. 账户与持仓委托
  positions: PositionModel[];
  orders: OrderModel[];
  balance: AccountBalanceModel | null;

  // 6. AI 副驾驶决策
  aiAnalysis: AIAnalysisResponse | null;
  isAiAnalyzing: boolean;
  aiThinkingStream: string;

  // 8. 自动量化操盘全景盈利与状态
  autoPilotStatus: AutoPilotStatusModel | null;
  autoPilotHistory: AutoPilotHistoryResponse | null;

  // 7. 交互辅助状态 (盘口点选回填、AI 采纳回填)
  selectedPrice: number | null;
  adoptedOrderParams: AIAdoptPayload | null;

  // Actions
  setLiveMode: (isLive: boolean) => void;
  setCredentialsInfo: (info: { apiKeyMasked: string; isLiveMode: boolean; permissions: string[] }) => void;
  clearCredentials: () => void;
  openSecurityModal: (tab?: 'okx' | 'llm' | 'risk') => void;
  closeSecurityModal: () => void;
  setSecurityModalTab: (tab: 'okx' | 'llm' | 'risk') => void;
  openPaperModal: () => void;
  closePaperModal: () => void;
  setPaperInitialCapital: (capital: number) => void;
  openStudioModal: () => void;
  closeStudioModal: () => void;
  setStudioModalOpen: (open: boolean) => void;
  setLLMConfig: (config: LLMConfig | null) => void;
  triggerPanicLock: (reason: string) => void;
  resetRiskLock: () => void;
  setRiskRules: (rules: Partial<HardRiskRules>) => void;

  setActiveSymbol: (symbol: string) => void;
  setActiveTimeframe: (tf: TimeFrame) => void;
  setSelectedPrice: (price: number | null) => void;
  setAdoptedOrderParams: (params: AIAdoptPayload | null) => void;

  setTicker: (ticker: TickerData) => void;
  setOrderBook: (ob: OrderBookDepth) => void;
  setTrades: (trades: MarketTrade[]) => void;
  addTrade: (trade: MarketTrade) => void;
  setIndicators: (ind: MultiPeriodIndicators) => void;

  setPositions: (positions: PositionModel[]) => void;
  setOrders: (orders: OrderModel[]) => void;
  setBalance: (balance: AccountBalanceModel) => void;

  setAIAnalysis: (analysis: AIAnalysisResponse | null) => void;
  setIsAiAnalyzing: (isAnalyzing: boolean) => void;
  setAiThinkingStream: (stream: string) => void;
  appendAiThinkingStream: (chunk: string) => void;

  setAutoPilotStatus: (status: AutoPilotStatusModel | null) => void;
  setAutoPilotHistory: (history: AutoPilotHistoryResponse | null) => void;
}

// 初始默认风控规则
const initialRiskRules: HardRiskRules = {
  max_order_usdt: 1000,
  max_daily_loss_usdt: 300,
  max_leverage: 5,
  max_slippage_pct: 0.5,
  max_open_positions: 3,
  max_position_usdt: 5000,
  default_stop_loss_pct: 1.5,
  default_take_profit_pct: 3.0,
};

// 初始默认账户资产
const initialBalance: AccountBalanceModel = {
  total_equity_usdt: 10000.0,
  available_margin_usdt: 10000.0,
  used_margin_usdt: 0,
  frozen_balance_usdt: 0,
  unrealized_pnl_usdt: 0,
  today_realized_pnl_usdt: 0,
  today_pnl_ratio: 0.0,
  margin_ratio: 10.0,
  is_warning_margin: false,
  timestamp: Date.now(),
};

export const useAppStore = create<AppState>((set) => ({
  hasConfiguredOkx: true,
  isLiveMode: false,
  apiKeyMasked: '6b2a****8e91',
  permissions: ['read', 'trade'],
  hasWithdrawPermission: false,
  isSecurityModalOpen: false,
  securityModalTab: 'okx',

  isPaperModalOpen: false,
  paperInitialCapital: 10000.0,

  isStudioModalOpen: false,

  llmConfig: {
    llm_provider: 'antigravity',
    llm_base_url: 'http://127.0.0.1:8001',
    llm_model: 'gemini-3.7-flash',
    llm_temperature: 0.2,
    llm_max_tokens: 4096,
    llm_api_key_masked: '免Key本地驱动',
  },

  riskStatus: 'NORMAL',
  circuitBreakReason: null,
  riskRules: initialRiskRules,

  activeSymbol: 'BTC-USDT-SWAP',
  activeTimeframe: '1h',

  ticker: null,
  orderBook: null,
  trades: [],
  indicators: null,

  positions: [],
  orders: [],
  balance: initialBalance,

  aiAnalysis: null,
  isAiAnalyzing: false,
  aiThinkingStream: '',

  autoPilotStatus: null,
  autoPilotHistory: null,

  selectedPrice: null,
  adoptedOrderParams: null,

  setLiveMode: (isLive) => set({ isLiveMode: isLive }),
  setCredentialsInfo: (info) =>
    set({
      hasConfiguredOkx: true,
      apiKeyMasked: info.apiKeyMasked,
      isLiveMode: info.isLiveMode,
      permissions: info.permissions,
    }),
  clearCredentials: () =>
    set({
      hasConfiguredOkx: false,
      apiKeyMasked: null,
      permissions: [],
      hasWithdrawPermission: false,
    }),
  openSecurityModal: (tab = 'okx') =>
    set({
      isSecurityModalOpen: true,
      securityModalTab: tab,
    }),
  closeSecurityModal: () => set({ isSecurityModalOpen: false }),
  setSecurityModalTab: (tab) => set({ securityModalTab: tab }),
  openPaperModal: () => set({ isPaperModalOpen: true }),
  closePaperModal: () => set({ isPaperModalOpen: false }),
  setPaperInitialCapital: (capital) => set({ paperInitialCapital: capital }),
  openStudioModal: () => set({ isStudioModalOpen: true }),
  closeStudioModal: () => set({ isStudioModalOpen: false }),
  setStudioModalOpen: (open) => set({ isStudioModalOpen: open }),
  setLLMConfig: (config) => set({ llmConfig: config }),

  triggerPanicLock: (reason) =>
    set({
      riskStatus: 'PANIC_LOCKED',
      circuitBreakReason: reason,
    }),
  resetRiskLock: () =>
    set({
      riskStatus: 'NORMAL',
      circuitBreakReason: null,
    }),
  setRiskRules: (rules) =>
    set((state) => ({
      riskRules: { ...state.riskRules, ...rules },
    })),

  setActiveSymbol: (symbol) =>
    set({
      activeSymbol: symbol,
      ticker: null,
      orderBook: null,
      trades: [],
      indicators: null,
      aiAnalysis: null,
      isAiAnalyzing: false,
      aiThinkingStream: '',
      selectedPrice: null,
      adoptedOrderParams: null,
    }),
  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),
  setSelectedPrice: (price) => set({ selectedPrice: price }),
  setAdoptedOrderParams: (params) => set({ adoptedOrderParams: params }),

  setTicker: (ticker) => set({ ticker }),
  setOrderBook: (ob) => set({ orderBook: ob }),
  addTrade: (trade) =>
    set((state) => ({
      trades: [trade, ...state.trades.slice(0, 49)], // 最多保留 50 条
    })),
  setIndicators: (ind) => set({ indicators: ind }),

  setPositions: (positions) => set({ positions: Array.isArray(positions) ? positions : [] }),
  setOrders: (orders) => set({ orders: Array.isArray(orders) ? orders : [] }),
  setTrades: (trades) => set({ trades: Array.isArray(trades) ? trades : [] }),
  setBalance: (balance) => set({ balance: balance || initialBalance }),

  setAIAnalysis: (analysis) => {
    if (analysis) {
      if ((analysis as any).action_plan && !analysis.trade_plan) {
        analysis.trade_plan = (analysis as any).action_plan;
      }
      if ((analysis as any).analysis_uuid && !analysis.analysis_id) {
        analysis.analysis_id = (analysis as any).analysis_uuid;
      }
    }
    set({ aiAnalysis: analysis });
  },

  setIsAiAnalyzing: (isAnalyzing) => set({ isAiAnalyzing: isAnalyzing }),
  setAiThinkingStream: (stream) => set({ aiThinkingStream: stream }),
  appendAiThinkingStream: (chunk) =>
    set((state) => ({
      aiThinkingStream: state.aiThinkingStream + chunk,
    })),

  setAutoPilotStatus: (status) => set({ autoPilotStatus: status }),
  setAutoPilotHistory: (history) => set({ autoPilotHistory: history }),
}));
