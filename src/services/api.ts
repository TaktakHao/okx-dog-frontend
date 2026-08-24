/**
 * @file api.ts
 * @description OKX-Dog 前端 RESTful API 服务封装
 * 100% 严格对齐 okx-dog-backend/API_SPEC.md 规范与 TYPES_CONTRACT.ts 强类型契约
 */

import {
  ApiResponse,
  ApiPaginatedResponse,
  OkxCredentialSaveRequest,
  CredentialsStatusResponse,
  TestConnectionRequest,
  TestConnectionResponse,
  LLMConfig,
  LLMConfigResponse,
  TestLLMRequest,
  TestLLMResponse,
  TickerData,
  KlineCandle,
  OrderBookDepth,
  DerivativesMetrics,
  MultiPeriodIndicators,
  AIAnalysisResponse,
  TriggerAIAnalysisRequest,
  AttributionLogModel,
  OrderCreateRequest,
  OrderModel,
  AdoptAIPlanRequest,
  CancelOrderRequest,
  BatchCancelOrdersRequest,
  PositionModel,
  PositionTPSLRequest,
  ClosePositionRequest,
  AccountBalanceModel,
  RiskStatusResponse,
  HardRiskRules,
  PanicButtonRequest,
  PanicButtonResponse,
  RiskAuditLogModel,
  PaperAccountInfo,
  SymbolListResponse,
} from '../types';

const BASE_URL = '/api/v1';

/**
 * 通用 HTTP 请求封装
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP 错误 ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.msg) errorMsg = errorJson.msg;
      if (errorJson.detail) errorMsg = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
    } catch {
      // 保持默认错误信息
    }
    throw new Error(errorMsg);
  }

  const result: ApiResponse<T> = await response.json();
  if (result.code !== 0) {
    throw new Error(result.msg || `业务处理失败 (错误码: ${result.code})`);
  }

  return result.data;
}

// =============================================================================
// 1. 安全密盒与凭证管理 (Vault & Security)
// =============================================================================

export const vaultApi = {
  /**
   * 保存/更新 OKX 凭证 (AES-256 加密落库)
   */
  saveCredentials: (data: OkxCredentialSaveRequest): Promise<CredentialsStatusResponse> => {
    return request<CredentialsStatusResponse>('/vault/credentials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 查询当前 OKX 凭证状态 (脱敏)
   */
  getCredentialsStatus: (): Promise<CredentialsStatusResponse> => {
    return request<CredentialsStatusResponse>('/vault/credentials/status');
  },

  /**
   * 测试 OKX 凭证连通性与权限探测
   */
  testConnection: (data: TestConnectionRequest): Promise<TestConnectionResponse> => {
    return request<TestConnectionResponse>('/vault/test-connection', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 清除 OKX 凭证
   */
  clearCredentials: (is_live_mode: boolean = false): Promise<{ is_live_mode: boolean }> => {
    return request<{ is_live_mode: boolean }>(`/vault/credentials/clear?is_live_mode=${is_live_mode}`, {
      method: 'POST',
    });
  },

  /**
   * 查询大模型配置 (脱敏)
   */
  getLLMConfig: (): Promise<LLMConfigResponse> => {
    return request<LLMConfigResponse>('/vault/llm-config');
  },

  /**
   * 配置/更新大模型参数 (AES-256 加密 API Key)
   */
  saveLLMConfig: (data: LLMConfig): Promise<LLMConfigResponse> => {
    return request<LLMConfigResponse>('/vault/llm-config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 测试大模型 API 连通性与延迟
   */
  testLLMConnection: (data: TestLLMRequest): Promise<TestLLMResponse> => {
    return request<TestLLMResponse>('/vault/test-llm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 清除已保存的大模型 API Key
   */
  clearLLMConfig: (): Promise<Record<string, unknown>> => {
    return request<Record<string, unknown>>('/vault/llm-config/clear', {
      method: 'POST',
    });
  },
};

// =============================================================================
// 2. 行情与多周期指标 (Market Data & Indicators)
// =============================================================================

export const marketApi = {
  /**
   * 获取最新行情 Ticker
   */
  getTicker: (symbol: string = 'BTC-USDT-SWAP'): Promise<TickerData> => {
    return request<TickerData>(`/market/ticker?symbol=${encodeURIComponent(symbol)}`);
  },

  /**
   * 获取历史 K 线数据
   */
  getKline: (
    symbol: string = 'BTC-USDT-SWAP',
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<KlineCandle[]> => {
    return request<KlineCandle[]>(
      `/market/kline?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    );
  },

  /**
   * 获取订单簿深度盘口 (Level-2)
   */
  getDepth: (symbol: string = 'BTC-USDT-SWAP', depth: number = 20): Promise<OrderBookDepth> => {
    return request<OrderBookDepth>(
      `/market/depth?symbol=${encodeURIComponent(symbol)}&depth=${depth}`
    );
  },

  /**
   * 获取衍生品专项指标 (资金费率 / OI)
   */
  getDerivatives: (symbol: string = 'BTC-USDT-SWAP'): Promise<DerivativesMetrics> => {
    return request<DerivativesMetrics>(
      `/market/derivatives?symbol=${encodeURIComponent(symbol)}`
    );
  },

  /**
   * 获取多周期量化技术指标 (EMA / MACD / RSI / BB / ATR)
   */
  getIndicators: (symbol: string = 'BTC-USDT-SWAP'): Promise<MultiPeriodIndicators> => {
    return request<MultiPeriodIndicators>(
      `/market/indicators?symbol=${encodeURIComponent(symbol)}`
    );
  },
  /**
   * 获取标的池列表与搜索
   */
  getSymbols: (keyword?: string, category?: string): Promise<SymbolListResponse> => {
    const params = new URLSearchParams();
    if (keyword) params.append('keyword', keyword);
    if (category) params.append('category', category);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return request<SymbolListResponse>(`/market/symbols${queryStr}`);
  },

  /**
   * 批量订阅前端自选与专注标的行情通道
   */
  subscribeFocus: (symbols: string[]): Promise<{ subscribed_symbols: string[] }> => {
    return request<{ subscribed_symbols: string[] }>('/market/subscribe-focus', {
      method: 'POST',
      body: JSON.stringify(symbols),
    });
  },
};

// =============================================================================
// 3. AI 智能研判与决策中心 (LLM Decision Engine)
// =============================================================================

export const aiApi = {
  /**
   * 手动触发 AI 结构化研判 (同步)
   */
  triggerAnalysis: (data: TriggerAIAnalysisRequest): Promise<AIAnalysisResponse> => {
    return request<AIAnalysisResponse>('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 查询历史 AI 研判与胜率归因
   */
  getHistory: (
    symbol: string = 'BTC-USDT-SWAP',
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiPaginatedResponse<AttributionLogModel>> => {
    return request<ApiPaginatedResponse<AttributionLogModel>>(
      `/ai/history?symbol=${encodeURIComponent(symbol)}&page=${page}&page_size=${pageSize}`
    );
  },
};

// =============================================================================
// 4. 交易执行与持仓管理 (Trade & Positions)
// =============================================================================

export const tradeApi = {
  /**
   * 提交委托下单 (经硬风控中枢拦截)
   */
  placeOrder: (data: OrderCreateRequest): Promise<OrderModel> => {
    return request<OrderModel>('/trade/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 一键采纳 AI 交易计划下单
   */
  adoptAIPlan: (data: AdoptAIPlanRequest): Promise<OrderModel> => {
    return request<OrderModel>('/trade/orders/adopt-ai-plan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 撤销指定订单
   */
  cancelOrder: (data: CancelOrderRequest): Promise<{ success: boolean; client_order_id?: string }> => {
    return request<{ success: boolean; client_order_id?: string }>('/trade/orders/cancel', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 批量撤单
   */
  batchCancelOrders: (data: BatchCancelOrdersRequest): Promise<{ success: boolean; count: number }> => {
    return request<{ success: boolean; count: number }>('/trade/orders/batch-cancel', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 查询当前持仓列表
   */
  getPositions: (): Promise<PositionModel[]> => {
    return request<PositionModel[]>('/trade/positions');
  },

  /**
   * 查询委托挂单与订单列表
   */
  getOrders: (symbol?: string, state?: string): Promise<OrderModel[]> => {
    const params = new URLSearchParams();
    if (symbol) params.append('symbol', symbol);
    if (state) params.append('state', state);
    const qs = params.toString();
    return request<OrderModel[]>(`/trade/orders${qs ? `?${qs}` : ''}`);
  },

  /**
   * 查询历史平仓记录与已实现盈亏
   */
  getHistory: (): Promise<any[]> => {
    return request<any[]>('/trade/history');
  },

  /**
   * 为现有持仓设置/修改止盈止损
   */
  setPositionTPSL: (data: PositionTPSLRequest): Promise<PositionModel> => {
    return request<PositionModel>('/trade/positions/tpsl', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 快捷平仓 (市价/限价)
   */
  closePosition: (data: ClosePositionRequest): Promise<{ success: boolean; msg: string }> => {
    return request<{ success: boolean; msg: string }>('/trade/positions/close', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 获取账户资产全景
   */
  getAccountBalance: (): Promise<AccountBalanceModel> => {
    return request<AccountBalanceModel>('/trade/account/balance');
  },
};


// =============================================================================
// 5. 硬风控中枢与 Panic Button (Risk & Emergency)
// =============================================================================

export const riskApi = {
  /**
   * 查询风控中枢实时状态
   */
  getRiskStatus: (): Promise<RiskStatusResponse> => {
    return request<RiskStatusResponse>('/risk/status');
  },

  /**
   * 更新硬风控规则参数
   */
  updateRiskConfig: (data: HardRiskRules): Promise<RiskStatusResponse> => {
    return request<RiskStatusResponse>('/risk/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * 手动解除熔断锁定
   */
  resetCircuitBreaker: (masterPassword: string, reason: string): Promise<RiskStatusResponse> => {
    return request<RiskStatusResponse>('/risk/reset-circuit-breaker', {
      method: 'POST',
      body: JSON.stringify({
        master_password: masterPassword,
        reason,
      }),
    });
  },

  /**
   * Panic Button 紧急全平与撤单 (最高优先级熔断)
   */
  triggerPanicButton: (data: PanicButtonRequest): Promise<PanicButtonResponse> => {
    return request<PanicButtonResponse>('/risk/panic-button', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 查询风控拦截与审计日志
   */
  getRiskAuditLogs: (page: number = 1, pageSize: number = 20): Promise<ApiPaginatedResponse<RiskAuditLogModel>> => {
    return request<ApiPaginatedResponse<RiskAuditLogModel>>(
      `/risk/audit-logs?page=${page}&page_size=${pageSize}`
    );
  },
};

// =============================================================================
// 6. 模拟操盘沙盒与系统运行模式 (Paper Trading & System Mode)
// =============================================================================

export const paperApi = {
  /**
   * 获取模拟操盘账户详情与胜率统计
   */
  getAccount: (): Promise<PaperAccountInfo> => {
    return request<PaperAccountInfo>('/paper/account');
  },

  /**
   * 重置模拟账户与初始本金
   */
  resetAccount: (initialEquityUsdt: number = 10000.0): Promise<PaperAccountInfo> => {
    return request<PaperAccountInfo>('/paper/reset', {
      method: 'POST',
      body: JSON.stringify({ initial_equity_usdt: initialEquityUsdt }),
    });
  },
};

export const systemApi = {
  /**
   * 切换系统全局运行模式 (实盘 LIVE vs 模拟沙盒 DEMO)
   */
  switchMode: (targetLiveMode: boolean, masterPassword?: string): Promise<{ is_live_mode: boolean }> => {
    return request<{ is_live_mode: boolean }>('/system/mode', {
      method: 'POST',
      body: JSON.stringify({
        target_live_mode: targetLiveMode,
        master_password: masterPassword,
      }),
    });
  },
};

// =============================================================================
// 7. 全自动量化操盘与盈利全景追踪服务 (Auto-Pilot API)
// =============================================================================

export const autoPilotApi = {
  /**
   * 开启全自动量化操盘 (锁定当前总权益为基准本金)
   */
  start: (data?: import('../types').AutoPilotStartRequest): Promise<import('../types').AutoPilotStatusModel> => {
    return request<import('../types').AutoPilotStatusModel>('/trade/auto-pilot/start', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  /**
   * 暂停/停止全自动量化操盘
   */
  stop: (): Promise<import('../types').AutoPilotStatusModel> => {
    return request<import('../types').AutoPilotStatusModel>('/trade/auto-pilot/stop', {
      method: 'POST',
    });
  },

  /**
   * 获取自动操盘实时收益全景与胜率统计
   */
  getStatus: (): Promise<import('../types').AutoPilotStatusModel> => {
    return request<import('../types').AutoPilotStatusModel>('/trade/auto-pilot/status');
  },

  /**
   * 获取开启以来的收益曲线时序采样点与自动成交平仓流水
   */
  getHistory: (): Promise<import('../types').AutoPilotHistoryResponse> => {
    return request<import('../types').AutoPilotHistoryResponse>('/trade/auto-pilot/history');
  },

  /**
   * 更新自动操盘策略参数
   */
  updateConfig: (data: import('../types').AutoPilotConfigUpdateRequest): Promise<import('../types').AutoPilotStatusModel> => {
    return request<import('../types').AutoPilotStatusModel>('/trade/auto-pilot/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 重置自动操盘收益统计基准
   */
  resetStats: (): Promise<import('../types').AutoPilotStatusModel> => {
    return request<import('../types').AutoPilotStatusModel>('/trade/auto-pilot/reset-stats', {
      method: 'POST',
    });
  },
};

// =============================================================================
// 9. 模块 A：数据湖与极速回测 API (Data Lake & Backtest)
// =============================================================================

export const dataLakeApi = {
  getStatus: (): Promise<import('../types').DataLakeStatusResponse> => {
    return request<import('../types').DataLakeStatusResponse>('/datalake/status');
  },
  sync: (data: import('../types').DataLakeSyncRequest): Promise<any> => {
    return request<any>('/datalake/sync', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const backtestApi = {
  run: (data: import('../types').BacktestRunRequest): Promise<import('../types').BacktestResultResponse> => {
    return request<import('../types').BacktestResultResponse>('/backtest/run', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  gridSearch: (data: import('../types').GridSearchRequest): Promise<import('../types').GridSearchResponse> => {
    return request<import('../types').GridSearchResponse>('/backtest/grid-search', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getExperiments: (limit: number = 20): Promise<any[]> => {
    return request<any[]>(`/backtest/experiments?limit=${limit}`);
  },
};

// =============================================================================
// 10. 模块 B：全网情报与热点新闻 API (News & Macro)
// =============================================================================

export const newsApi = {
  getFeed: (limit: number = 20): Promise<import('../types').NewsFeedResponse> => {
    return request<import('../types').NewsFeedResponse>(`/news/feed?limit=${limit}`);
  },
  getMacroCalendar: (): Promise<import('../types').MacroCalendarResponse> => {
    return request<import('../types').MacroCalendarResponse>('/news/macro-calendar');
  },
};

// =============================================================================
// 11. 模块 C：每日复盘与避坑规则库 API (Daily Review & Knowledge Base)
// =============================================================================

export const reviewApi = {
  getDailyReviews: (limit: number = 10): Promise<import('../types').DailyReviewListResponse> => {
    return request<import('../types').DailyReviewListResponse>(`/reviews/daily?limit=${limit}`);
  },
  generateReview: (date?: string): Promise<import('../types').DailyReviewDetail> => {
    const query = date ? `?date=${date}` : '';
    return request<import('../types').DailyReviewDetail>(`/reviews/generate${query}`, {
      method: 'POST',
    });
  },
};

export const knowledgeBaseApi = {
  getRules: (ruleType?: string, isActive: boolean = true): Promise<import('../types').TradingKnowledgeListResponse> => {
    let query = `?is_active=${isActive}`;
    if (ruleType) query += `&rule_type=${ruleType}`;
    return request<import('../types').TradingKnowledgeListResponse>(`/knowledge-base/rules${query}`);
  },
  saveRule: (data: import('../types').TradingKnowledgeRule): Promise<{ rule_id: string }> => {
    return request<{ rule_id: string }>('/knowledge-base/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// =============================================================================
// 12. 模块 D：多智能体博弈与 Telegram API (Consensus & Telegram)
// =============================================================================

export const consensusApi = {
  analyze: (payload: { symbol: string; snapshot?: any }): Promise<import('../types').MultiAgentConsensusResponse> => {
    return request<import('../types').MultiAgentConsensusResponse>('/consensus/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const telegramApi = {
  getConfig: (): Promise<import('../types').TelegramConfig> => {
    return request<import('../types').TelegramConfig>('/telegram/config');
  },
  saveConfig: (data: import('../types').TelegramConfigSaveRequest): Promise<import('../types').TelegramConfig> => {
    return request<import('../types').TelegramConfig>('/telegram/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  sendTest: (message?: string): Promise<{ sent: boolean }> => {
    return request<{ sent: boolean }>('/telegram/test', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
};

// =============================================================================
// 13. v3.5 模块：AI Quant Studio & Codex Harness API
// =============================================================================

export interface StrategyTemplateItem {
  id: string;
  name: string;
  description: string;
  code: string;
}

export interface BacktestMetrics {
  total_return_pct: number;
  annualized_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  calmar_ratio: number;
  win_rate_pct: number;
  profit_factor: number;
  total_trades: number;
  total_bars: number;
}

export interface EquityCurvePoint {
  timestamp: number;
  equity: number;
  price: number;
}

export interface TradeSignalPoint {
  timestamp: number;
  action: 'BUY' | 'SELL' | 'CLOSE';
  price: number;
}

export interface StrategyGenerationResult {
  strategy_id: string;
  strategy_name: string;
  prompt: string;
  code: string;
  ast_passed: boolean;
  attempts: number;
  status: string;
  metrics: BacktestMetrics | null;
  equity_curve: EquityCurvePoint[];
  trade_signals: TradeSignalPoint[];
  error_message: string | null;
}

export const studioApi = {
  getTemplates: (): Promise<StrategyTemplateItem[]> => {
    return request<StrategyTemplateItem[]>('/studio/templates');
  },
  generateStrategy: (payload: {
    prompt: string;
    symbol?: string;
    timeframe?: string;
    max_retries?: number;
  }): Promise<StrategyGenerationResult> => {
    return request<StrategyGenerationResult>('/studio/generate-strategy', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  backtestCustom: (payload: {
    code: string;
    symbol?: string;
    timeframe?: string;
  }): Promise<StrategyGenerationResult> => {
    return request<StrategyGenerationResult>('/studio/backtest-custom', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  runBenchmark: (): Promise<any> => {
    return request<any>('/studio/benchmark-eval', {
      method: 'POST',
    });
  },
};




