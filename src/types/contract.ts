/**
 * @file TYPES_CONTRACT.ts
 * @description OKX-Dog 个人量化智能交易系统 - 全局前端 TypeScript 强类型契约
 * @version 1.0.0
 * 
 * 严格契约对齐说明：
 * 1. 100% 严格对齐后端 Pydantic 数据模型 (okx-dog-backend/models.py 与 DATABASE_SCHEMA.sql)
 * 2. 100% 严格对齐 AI 大模型结构化输出契约 (okx-dog-ai/AI_SCHEMA.json)
 * 3. 100% 严格对齐 OKX v5 官方 WebSocket 与 REST API 字段命名与规范
 * 4. 禁止使用 any 占位符，所有字段均配备详尽的中文 JSDoc 说明与完备类型定义
 */

// =============================================================================
// 1. 基础交易与系统枚举定义 (Enums & Literal Types)
// =============================================================================

/**
 * 委托买卖方向
 */
export type OrderSide = 'buy' | 'sell';

/**
 * 合约持仓方向 (开平仓/双向持仓模式)
 */
export type PosSide = 'long' | 'short' | 'net';

/**
 * 委托订单类型
 */
export type OrderType = 
  | 'limit'              // 普通限价单
  | 'market'             // 市价单
  | 'post_only'          // 只做 Maker 单
  | 'fok'                // 全部成交或立即取消
  | 'ioc'                // 立即成交并取消剩余
  | 'optimal_limit_ioc'  // 市价委托立即成交并取消 (OKX 特有)
  | 'trigger';           // 计划条件委托

/**
 * 委托订单生命周期状态 (全链路对齐后端 models.py 与数据库)
 */
export type OrderState = 
  | 'live'               // 等待成交 (活跃挂单)
  | 'partially_filled'   // 部分成交
  | 'filled'             // 全部成交
  | 'canceled'           // 用户手动撤销
  | 'mmp_canceled'       // 做市商保护撤销
  | 'rejected'           // 风控拦截或交易所拒绝
  | 'risk_rejected'      // 遭后端硬风控中枢拦截拒绝
  | 'expired'            // 委托过期
  | 'fail';              // OKX 上游报错拒绝

/**
 * 交易标的工具类型 (Instrument Type)
 */
export type InstrumentType = 'SPOT' | 'SWAP' | 'FUTURES' | 'MARGIN';
export type InstType = InstrumentType; // 别名兼容

/**
 * 系统运行环境模式
 */
export type EnvironmentMode = 'live' | 'demo';

/**
 * K线主分析周期
 */
export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

/**
 * 人机协同交易模式
 */
export type CopilotMode = 
  | 'MANUAL'      // 手动模式：AI 仅生成建议，人工一键采纳并手动确认下单
  | 'SEMI_AUTO'   // 半自动模式：系统定期推送研判提醒，人工二次确认执行
  | 'FULL_AUTO';  // 小额全自动模式：AI 评分高且通过全部硬风控时自动触发执行

/**
 * 宏观盘面结构分类 (严格对齐 AI_SCHEMA.json 与 models.py)
 */
export type MarketRegime = 
  | 'TRENDING_UP'        // 多头趋势行情
  | 'TRENDING_DOWN'      // 空头趋势行情
  | 'RANGING'            // 震荡整理行情
  | 'VOLATILE_BREAKOUT'; // 剧烈突破/异动行情

export type MarketState = MarketRegime; // 别名兼容

/**
 * 资金费率倾向评估 (严格对齐 AI_SCHEMA.json)
 */
export type FundingRateBias = 
  | 'EXTREME_POSITIVE'   // 极端看多 (费率过高，存在多头拥挤回调风险)
  | 'MODERATE_POSITIVE'  // 健康看多
  | 'NEUTRAL'            // 中性平衡
  | 'MODERATE_NEGATIVE'  // 健康看空
  | 'EXTREME_NEGATIVE';  // 极端看空 (费率严重为负，存在轧空反弹风险)

/**
 * AI 研判核心操作信号动作 (全链路补齐 CLOSE_POSITION，100% 对齐 AI_SCHEMA.json)
 */
export type SignalAction = 
  | 'BUY_LONG'         // 建议做多/买入开多
  | 'SELL_SHORT'       // 建议做空/卖出开空
  | 'CLOSE_POSITION'   // 建议平仓离场
  | 'HOLD_WAIT';       // 建议空仓观望 / 维持现有仓位

export type SignalDirection = SignalAction; // 别名兼容

/**
 * 交易信号执行紧迫度
 */
export type SignalUrgency = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * 建议交易计划委托类型
 */
export type TradePlanOrderType = 'LIMIT' | 'MARKET' | 'TRIGGER_LIMIT';

/**
 * 周期趋势分析
 */
export type TimeframeTrend = 
  | 'BULLISH'         // 多头排列/强劲上涨
  | 'BEARISH'         // 空头排列/破位下跌
  | 'NEUTRAL_CHOPPY'  // 均线缠绕/宽幅震荡
  | 'OVERBOUGHT'      // 超买顶背离
  | 'OVERSOLD';       // 超卖底背离

/**
 * 风控告警严重级别
 */
export type RiskSeverity = 'INFO' | 'WARN' | 'WARNING' | 'CRITICAL' | 'FATAL';
export type AuditSeverity = RiskSeverity;

/**
 * 风控审计事件类型 (全集枚举，严格对齐 models.py 与数据库)
 */
export type RiskEventType = 
  | 'MAX_ORDER_EXCEEDED' 
  | 'DAILY_LOSS_LIMIT' 
  | 'LEVERAGE_EXCEEDED' 
  | 'SLIPPAGE_EXCEEDED' 
  | 'POSITION_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED_WITHDRAWAL_ATTEMPT' 
  | 'PANIC_BUTTON_TRIGGERED' 
  | 'CIRCUIT_BREAK_TRIGGERED' 
  | 'CIRCUIT_BREAK_MANUAL_RESET'
  | 'ORDER_REJECTED'
  | 'DAILY_LOSS_TRIGGERED'
  | 'PANIC_TRIGGERED'
  | 'UNAUTHORIZED_WITHDRAWAL_DETECTED'
  | 'SLIPPAGE_PROTECTION';

/**
 * 研判历史归因评估结果
 */
export type AIAttributionOutcome = 'WIN' | 'LOSS' | 'NEUTRAL' | 'PENDING';
export type AttributionStatus = 'TRACKING' | 'COMPLETED' | 'EXPIRED' | 'INVALIDATED';

/**
 * WebSocket 订阅频道主题
 */
export type WSChannel = 
  | 'tickers'         // 24h 价格与成交量行情
  | 'books20'         // 20 档盘口深度
  | 'trades'          // 实时逐笔成交
  | 'positions'       // 私有频道：实时仓位变动
  | 'orders'          // 私有频道：委托订单状态更新
  | 'account'         // 私有频道：账户资产与保证金
  | 'risk_events'     // 系统广播：硬风控拦截与熔断事件
  | 'ai_signals'      // 系统广播：AI 自动化研判信号
  | string;

// =============================================================================
// 2. 通用 REST API 响应包裹模型 (Standard HTTP Response)
// =============================================================================

/**
 * 标准通用 API 响应结构 (毫秒时间戳)
 */
export interface ApiResponse<T = unknown> {
  /** 状态码：0 代表成功，非 0 代表业务异常或错误码 */
  code: number;
  /** 响应信息或错误描述 */
  msg: string;
  /** 业务响应数据载荷 */
  data: T;
  /** 服务器响应 Unix 毫秒时间戳 */
  timestamp: number;
}

/**
 * 分页数据响应包裹结构
 */
export interface ApiPaginatedResponse<T> {
  /** 当前页列表数据 */
  items: T[];
  /** 总记录数 */
  total: number;
  /** 当前页码 (从 1 开始) */
  page: number;
  /** 每页记录条数 */
  page_size: number;
  /** 是否存在下一页 */
  has_more: boolean;
}

export type PaginatedData<T> = ApiPaginatedResponse<T>; // 别名兼容

// =============================================================================
// 3. 安全密盒与系统配置类型 (Security, Vault & Config)
// =============================================================================

/**
 * OKX 凭证配置请求参数 (写入/更新密盒)
 */
export interface OkxCredentialSaveRequest {
  /** 本地主密码 (用于 AES-256-GCM 密盒派生) */
  master_password: string;
  /** 实盘或模拟盘模式 (false: 模拟盘, true: 实盘) */
  is_live_mode: boolean;
  /** OKX v5 API Key */
  api_key: string;
  /** OKX v5 Secret Key */
  secret_key: string;
  /** OKX v5 Passphrase */
  passphrase: string;
}

export type SaveCredentialsRequest = OkxCredentialSaveRequest; // 别名兼容

/**
 * OKX 凭证脱敏与权限展示信息 (安全返回前端)
 */
export interface OkxCredentialMaskedInfo {
  /** 是否已在密盒中配置 */
  has_configured_okx: boolean;
  /** 是否为实盘模式 */
  is_live_mode: boolean;
  /** 脱敏后的 API Key (例如 "6b2a****8e91") */
  api_key_masked: string | null;
  /** 校验出的 API 权限列表 (如 ["read", "trade"]) */
  permissions: string[];
  /** 是否错误开启了提现权限 (若为 true 则前端展示严重红色警告) */
  has_withdraw_permission: boolean;
  /** 凭证当前连通性是否有效可用 */
  is_valid: boolean;
  /** 上次连通性测试时间戳 (ms) */
  last_tested_at: number | null;
}

export type CredentialsStatusResponse = OkxCredentialMaskedInfo; // 别名兼容

/**
 * 测试连通性请求
 */
export interface TestConnectionRequest {
  master_password?: string;
  is_live_mode?: boolean;
  api_key?: string;
  secret_key?: string;
  passphrase?: string;
}


/**
 * 连通性测试结果返回
 */
export interface ConnectivityTestResult {
  /** 网络连通与签名认证是否成功 */
  connected: boolean;
  /** OKX API 延迟 (ms) */
  latency_ms: number;
  /** OKX 权限列表 */
  permissions: string[];
  /** 安全预警信息 */
  security_warning?: string | null;
}

export type TestConnectionResponse = ConnectivityTestResult; // 别名兼容

/**
 * LLM 大模型配置模型
 */
export interface LLMConfig {
  /** 模型供应商标识 (antigravity / deepseek / openai / anthropic / custom) */
  llm_provider: 'antigravity' | 'deepseek' | 'openai' | 'anthropic' | 'custom';
  /** OpenAI 标准兼容接口 Base URL 或本地服务地址 */
  llm_base_url: string;
  /** 使用的模型名称 (如 "gemini-3.7-flash", "deepseek-reasoner", "gpt-4o") */
  llm_model: string;
  /** 模型温度 (0.0 ~ 2.0) */
  llm_temperature: number;
  /** 最大输出 Token 限制 */
  llm_max_tokens: number;
  /** 脱敏显示的 LLM API Key */
  llm_api_key_masked?: string | null;
  /** 修改配置时的主密码 */
  master_password?: string;
  /** 修改配置时的新 API Key */
  llm_api_key?: string | null;
}

export type LLMConfigRequest = LLMConfig;
export type LLMConfigResponse = LLMConfig;

export interface TestLLMRequest {
  master_password?: string;
  llm_provider?: 'antigravity' | 'deepseek' | 'openai' | 'anthropic' | 'custom';
  llm_base_url?: string;
  llm_api_key?: string | null;
  llm_model?: string;
}

export interface TestLLMResponse {
  connected: boolean;
  latency_ms: number;
  model: string;
  message?: string;
}

/**
 * 硬风控安全规则配置 (不可被前端或 AI 轻易跳过的硬锁)
 */
export interface HardRiskRules {
  /** 单笔最大委托金额上限 (USDT) */
  max_order_usdt: number;
  /** 单日最大亏损熔断阈值 (USDT) */
  max_daily_loss_usdt: number;
  /** 强制锁死最高杠杆倍数 (1 ~ 20) */
  max_leverage: number;
  /** 最大允许滑点百分比 (例如 0.5 代表 0.5%) */
  max_slippage_pct: number;
  /** 最大并发持仓数量限制 */
  max_open_positions: number;
  /** 单标的最大持仓名义价值 (USDT) */
  max_position_usdt: number;
  /** 默认附带止损百分比 (可选) */
  default_stop_loss_pct?: number;
  /** 默认附带止盈百分比 (可选) */
  default_take_profit_pct?: number;
}

export type RiskRulesConfig = HardRiskRules; // 别名兼容

/**
 * 全局系统运行配置响应
 */
export interface SystemConfigResponse {
  /** 当前协同模式 */
  copilot_mode: CopilotMode;
  /** 当前主交易标的 (如 "BTC-USDT-SWAP") */
  active_symbol: string;
  /** 启用的多周期列表 */
  supported_timeframes: string[];
  /** 全局交易总开关 */
  is_trading_enabled: boolean;
  /** 是否开启 AI 定时自动研判 */
  is_ai_auto_trigger: boolean;
  /** AI 自动研判时间间隔 (分钟) */
  auto_trigger_interval_mins: number;
}

export type SystemConfigModel = SystemConfigResponse;

// =============================================================================
// 4. 行情、K线与技术指标契约 (Market, Candlestick & Indicators)
// =============================================================================

/**
 * 单根 K 线蜡烛数据结构
 */
export interface CandleStick {
  /** 蜡烛开盘时间戳 (ms) */
  time: number;
  timestamp?: number;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 收盘价 */
  close: number;
  /** 成交量 (标的币种数量) */
  volume: number;
  /** 成交额 (USDT) */
  vol_currency?: number;
  /** 该根 K 线是否已收线确认 */
  confirmed?: boolean;
  is_closed?: boolean;
}

export type KlineCandle = CandleStick; // 别名兼容

/**
 * 24小时 Ticker 聚合行情
 */
export interface Ticker {
  /** 交易标的代码 (如 BTC-USDT-SWAP) */
  symbol: string;
  /** 最新成交价 */
  last_price: number;
  /** 最新成交数量 */
  last_sz?: number;
  /** 24小时最高价 */
  high_24h: number;
  /** 24小时最低价 */
  low_24h: number;
  /** 24小时开盘价 */
  open_24h?: number;
  /** 24小时成交量 (标的币数量) */
  volume_24h: number;
  /** 24小时成交额 (计价货币 USDT) */
  vol_currency_24h: number;
  volume_24h_currency?: number;
  /** 24小时价格变动绝对值 */
  change_24h?: number;
  /** 24小时涨跌幅 (例如 2.35 代表 +2.35%) */
  change_24h_pct: number;
  /** 最新标记价格 */
  mark_price?: number;
  /** 指数价格 */
  index_price?: number;
  /** 当前资金费率 */
  funding_rate?: number;
  /** 下次结算资金费率时间戳 (ms) */
  next_funding_time?: number;
  /** 本次 Ticker 生成时间戳 (ms) */
  timestamp: number;
}

export type TickerData = Ticker; // 别名兼容

/**
 * 订单簿单档深度数据结构
 */
export interface OrderBookLevel {
  /** 委托价格 */
  price: number;
  /** 委托数量 (张数或币数) */
  size: number;
  /** 该档位挂单订单数 */
  order_count?: number;
  /** 累计深度 */
  cumulative_size?: number;
  /** 累计深度比例 (0.0 ~ 1.0) */
  depth_ratio?: number;
}

/**
 * 完整订单簿深度快照 (买卖 20 档)
 */
export interface OrderBook {
  /** 标的代码 */
  symbol: string;
  /** 深度生成时间戳 (ms) */
  timestamp: number;
  /** 买盘档位列表 (价格从高到低降序排列) */
  bids: OrderBookLevel[];
  /** 卖盘档位列表 (价格从低到高升序排列) */
  asks: OrderBookLevel[];
  /** 序列号/校验和 */
  checksum?: number;
}

export type OrderBookDepth = OrderBook; // 别名兼容

/**
 * 逐笔实时成交记录
 */
export interface MarketTrade {
  /** 成交唯一 ID */
  trade_id: string;
  /** 标的代码 */
  symbol: string;
  /** 成交方向 (buy: 主动买入, sell: 主动卖出) */
  side: OrderSide;
  /** 成交价格 */
  price: number;
  /** 成交数量 */
  size: number;
  /** 成交时间戳 (ms) */
  timestamp: number;
  /** 是否为大单异动成交 */
  is_whale_trade?: boolean;
}

/**
 * 衍生品专项指标数据
 */
export interface DerivativesMetrics {
  /** 标的代码 */
  symbol: string;
  /** 当前资金费率 (例如 0.0001) */
  funding_rate: number;
  /** 年化资金费率百分比 */
  funding_rate_annualized_pct?: number;
  /** 预测下期资金费率 */
  predicted_funding_rate?: number;
  /** 资金费率结算倒计时 (毫秒) */
  funding_countdown_ms?: number;
  /** 下次结算时间戳 (ms) */
  next_funding_time?: number;
  /** 全网未平仓合约量 (USDT 估值) */
  open_interest_usdt: number;
  open_interest_usd?: number;
  /** 全网未平仓合约张数/币数 */
  open_interest: number;
  open_interest_size?: number;
  /** 24小时持仓量变化率 (%) */
  oi_change_24h_pct: number;
  open_interest_change_24h_pct?: number;
  /** 多空持仓人数比 (散户比) */
  long_short_ratio?: number;
  /** 大户账户多空比 */
  top_trader_long_short_ratio?: number;
  /** 衍生品情绪量化得分 (-1.0 ~ +1.0) */
  sentiment_score?: number;
  /** 数据更新时间戳 (ms) */
  timestamp?: number;
}

/**
 * 单周期技术指标集
 */
export interface TechnicalIndicatorSet {
  timeframe: string;
  ema_20: number;
  ema_50: number;
  ema_200?: number;
  macd_dif: number;
  macd_dea: number;
  macd_hist: number;
  rsi_14: number;
  bb_upper: number;
  bb_middle: number;
  bb_lower: number;
  atr_14: number;
}

export type SinglePeriodIndicators = TechnicalIndicatorSet;

/**
 * 多周期技术指标快照字典
 */
export interface MultiTimeframeIndicators {
  symbol: string;
  timestamp: number;
  indicators: Record<string, TechnicalIndicatorSet>;
  tf_15m?: TechnicalIndicatorSet;
  tf_1h?: TechnicalIndicatorSet;
  tf_4h?: TechnicalIndicatorSet;
  tf_1d?: TechnicalIndicatorSet;
}

export type MultiPeriodIndicators = MultiTimeframeIndicators;

// =============================================================================
// 5. AI 大模型研判与思维链契约 (100% 严格对齐 AI_SCHEMA.json 与 models.py)
// =============================================================================

/**
 * 单一周期技术指标研判细节 (严格对齐 AI_SCHEMA definitions.TimeframeDetail)
 */
export interface TimeframeDetail {
  /** 周期趋势研判 */
  trend: TimeframeTrend;
  /** 关键指标综合中文描述 */
  key_indicators_summary: string;
  /** 识别出的该周期第一关键支撑价位 */
  support_level: number;
  /** 识别出的该周期第一关键阻力价位 */
  resistance_level: number;
}

/**
 * 多周期技术面共振分析 (严格对齐 AI_SCHEMA properties.timeframe_analysis)
 */
export interface TimeframeAnalysis {
  tf_15m: TimeframeDetail;
  tf_1h: TimeframeDetail;
  tf_4h: TimeframeDetail;
  tf_1d: TimeframeDetail;
}

/**
 * 衍生品与市场情绪专项研判 (严格对齐 AI_SCHEMA properties.derivatives_sentiment)
 */
export interface AIDerivativesSentiment {
  /** 资金费率倾向 */
  funding_rate_bias: FundingRateBias;
  /** 全网未平仓合约量 (OI) 异动解读 */
  open_interest_interpretation: string;
  /** 多空持仓比与大户状态分析 */
  long_short_ratio_state: string;
  /** 综合情绪量化得分 (-1.0 ~ +1.0) */
  sentiment_score: number;
}

export type DerivativesSentiment = AIDerivativesSentiment;

/**
 * 交易信号与置信度 (严格对齐 AI_SCHEMA properties.signal)
 */
export interface AISignal {
  /** 核心建议动作 */
  action: SignalAction;
  /** 决策置信度得分 (0.0 ~ 1.0) */
  confidence: number;
  /** 执行紧迫度 */
  urgency: SignalUrgency;
}

/**
 * 分阶段止盈目标 (严格对齐 AI_SCHEMA definitions.TakeProfitLevel)
 */
export interface AITakeProfitLevel {
  /** 目标止盈价格 */
  price: number;
  /** 建议平仓比例 (0.01 ~ 1.0，例如 0.5 代表平仓 50%) */
  percentage: number;
  /** 止盈依据说明 */
  description: string;
}

export type TakeProfitLevel = AITakeProfitLevel;

/**
 * 建议交易计划与量化点位 (严格对齐 AI_SCHEMA properties.trade_plan)
 */
export interface AITradePlan {
  /** 建议入场价格区间 [最低入场价, 最高入场价] */
  entry_range: [number, number];
  /** 梯级止盈目标列表 */
  take_profit_levels: AITakeProfitLevel[];
  /** 硬止损价格 */
  stop_loss_price: number;
  /** 理论盈亏比 (R:R Ratio) */
  risk_reward_ratio: number;
  /** 建议杠杆倍数 (1 ~ 20) */
  suggested_leverage: number;
  /** 建议委托类型 */
  order_type: TradePlanOrderType;
}

export type TradePlan = AITradePlan;

/**
 * 风险评估与失效边界 (严格对齐 AI_SCHEMA properties.risk_assessment)
 */
export interface AIRiskAssessment {
  /** 核心风险因素列表 */
  key_risks: string[];
  /** 交易逻辑失效与强制离场条件 */
  invalidation_condition: string;
  /** 建议最长持仓时间 (小时) */
  max_holding_time_hours: number;
}

export type RiskAssessment = AIRiskAssessment;

/**
 * AI 大模型完整结构化研判响应 (100% 对齐 AI_SCHEMA.json 根对象与 models.py)
 */
export interface AIAnalysisResponse {
  /** 研判唯一追踪 UUID */
  analysis_id: string;
  analysis_uuid?: string; // 别名兼容
  /** 研判标的代码 (如 BTC-USDT-SWAP) */
  symbol: string;
  /** 研判生成 Unix 毫秒时间戳 */
  timestamp: number;
  /** 宏观盘面结构分类 */
  market_regime: MarketRegime;
  market_state?: MarketRegime; // 别名兼容
  /** 多周期（15m/1h/4h/1d）共振分析 */
  timeframe_analysis: TimeframeAnalysis;
  /** 衍生品情绪研判 */
  derivatives_sentiment: AIDerivativesSentiment;
  /** 交易信号 */
  signal: AISignal;
  /** 交易计划 */
  trade_plan: AITradePlan;
  action_plan?: AITradePlan; // 别名兼容
  /** 风险评估 */
  risk_assessment: AIRiskAssessment;
  /** 精炼研判摘要 (150字内，用于快速播报) */
  reasoning_summary: string;
  /** 详尽量化推导细节 */
  reasoning_details: string;
  rationale?: string; // 别名兼容
  
  // 网关与运行时扩展字段
  /** 实际使用的模型名称 (如 deepseek-reasoner) */
  model_used?: string;
  llm_model_used?: string;
  /** 推理耗时 (ms) */
  latency_ms?: number;
  /** 推理思维链完整内容 (<think> 内容) */
  thinking_process?: string | null;
}

/**
 * 手动触发 AI 研判请求
 */
export interface TriggerAIAnalysisRequest {
  symbol?: string;
  timeframe?: string;
  include_thinking?: boolean;
}

/**
 * SSE 流式传输 Chunk 事件结构
 */
export interface AICoTStreamEvent {
  /** 事件类型 */
  event: 'start' | 'thinking' | 'reasoning_chunk' | 'schema_chunk' | 'complete' | 'done' | 'error';
  /** 数据文本载荷 */
  data: string | AIAnalysisResponse | Record<string, unknown>;
  /** 思维链增量文本 */
  reasoning_content?: string;
  /** 最终解析出的完整结构化研判对象 */
  structured_output?: AIAnalysisResponse;
  /** 错误信息 */
  error_message?: string;
}

export type SSEStreamChunk = AICoTStreamEvent;

/**
 * 一键采纳 AI 研判注入下单面板的 Payload (对齐 AdoptAIPlanRequest)
 */
export interface AIAdoptPayload {
  symbol: string;
  action?: SignalAction;
  entry_price?: number;
  selected_entry_price?: number;
  stop_loss_price?: number;
  take_profit_target_1?: number;
  take_profit_target_2?: number;
  suggested_leverage?: number;
  leverage?: number;
  order_type: OrderType;
  confidence_score?: number;
  analysis_id?: string | number;
  ai_analysis_id?: string | number;
  notional_usdt: number;
  notional_usd?: number;
  copilot_mode?: CopilotMode;
}

export type AdoptAIPlanRequest = AIAdoptPayload;


// =============================================================================
// 6. 账户资产与持仓契约 (Account, Balances & Positions)
// =============================================================================

/**
 * 账户资产概览看板 (全称与缩写双向兼容)
 */
export interface AccountBalance {
  /** 账户总权益折合 (USDT) */
  total_equity_usdt: number;
  /** 账户总权益折合 (BTC) */
  total_equity_btc?: number;
  /** 可用保证金/可用余额 (USDT) */
  available_margin_usdt: number;
  available_balance_usdt?: number;
  /** 挂单冻结保证金 (USDT) */
  frozen_balance_usdt?: number;
  /** 当前持仓占用保证金 (USDT) */
  used_margin_usdt: number;
  margin_used_usdt?: number;
  /** 未实现总盈亏 (USDT) */
  unrealized_pnl_usdt?: number;
  /** 当日已实现盈亏 (USDT) */
  today_realized_pnl_usdt: number;
  today_pnl_usdt?: number;
  /** 当日收益率 */
  today_pnl_ratio: number;
  today_pnl_pct?: number;
  /** 当前账户整体保证金率 */
  margin_ratio: number;
  /** 是否处于强平警戒状态 */
  is_warning_margin?: boolean;
  /** 数据更新时间戳 (ms) */
  timestamp: number;
  updated_at?: number;
}

export type AccountBalanceModel = AccountBalance;

/**
 * 单币种资产明细
 */
export interface AssetDetailItem {
  ccy: string;
  equity: number;
  cash_bal: number;
  avail_bal: number;
  frozen_bal: number;
  upl: number;
}

/**
 * 单个活跃持仓明细 (Position Item - 全称与 OKX 缩写双向兼容)
 */
export interface PositionItem {
  /** 数据库 ID */
  id?: number;
  /** 持仓唯一标识 ID */
  pos_id?: string;
  /** 标的代码 (如 BTC-USDT-SWAP) */
  symbol: string;
  /** 产品类型 */
  inst_type: InstrumentType;
  /** 持仓方向 (long 多仓 / short 空仓 / net) */
  pos_side: PosSide;
  /** 杠杆倍数 */
  leverage: number;
  /** 开仓均价 */
  avg_price: number;
  avg_px?: number;
  /** 最新标记价格 */
  mark_price: number;
  mark_px?: number;
  /** 预估强平价格 */
  liquidation_price?: number | null;
  liq_px?: number | null;
  /** 持仓数量 (张数) */
  pos_size: number;
  pos?: number;
  /** 可平仓数量 */
  avail_pos?: number;
  /** 名义持仓价值 (USDT) */
  notional_usd?: number;
  /** 未实现盈亏 (USDT) */
  upl: number;
  /** 未实现盈亏收益率 (例如 0.15 代表 +15%) */
  upl_ratio: number;
  /** 已实现盈亏 (USDT) */
  realized_pnl?: number;
  /** 占用保证金 (USDT) */
  margin: number;
  /** 当前保证金率 */
  mgn_ratio: number;
  margin_ratio?: number;
  /** 维持保证金率 */
  maint_margin_ratio?: number;
  /** 关联止盈触发价 */
  tp_trigger_price?: number | null;
  /** 关联止损触发价 */
  sl_trigger_price?: number | null;
  /** 是否已触发第一止盈并锁定移动保本 */
  is_breakeven_locked?: boolean;
  /** 是否已完成 50% 阶梯止盈 */
  tp_triggered_50?: boolean;
  /** 当前已加仓层数 (初始建仓为 1) */
  scale_layers?: number;
  /** 上一次加仓价格 */
  last_scale_price?: number | null;
  /** 上一次加仓时间戳 (ms) */
  last_scale_time?: number | null;
  /** 是否触发强平预警 */
  is_danger_alert?: boolean;
  /** 与 OKX 同步时间戳 (ms) */
  last_synced_at?: number;

  /** 开仓时间戳 (ms) */
  created_at?: number;
  /** 最近更新时间戳 (ms) */
  updated_at?: number;
}

export type PositionModel = PositionItem;

/**
 * 设置/修改仓位止盈止损请求
 */
export interface PositionTPSLRequest {
  /** 标的代码 */
  symbol: string;
  /** 持仓方向 */
  pos_side: PosSide;
  /** 止盈触发价 (设为 null 或 0 取消止盈) */
  tp_trigger_price?: number | null;
  /** 止盈委托价 (默认为市价) */
  tp_order_price?: number | null;
  tp_ord_price?: number | null;
  /** 止损触发价 (设为 null 或 0 取消止损) */
  sl_trigger_price?: number | null;
  /** 止损委托价 (默认为市价) */
  sl_order_price?: number | null;
  sl_ord_price?: number | null;
}

export type SetPositionTPSLRequest = PositionTPSLRequest;

/**
 * 快捷平仓请求
 */
export interface ClosePositionRequest {
  symbol: string;
  pos_side: PosSide;
  order_type?: OrderType;
  price?: number | null;
  size?: number | null;
  sz?: number | null;
}

// =============================================================================
// 7. 交易下单、委托管理与 Panic Button 契约
// =============================================================================

/**
 * 创建新委托订单请求 (全链路对齐 PlaceOrderRequest)
 */
export interface OrderCreateRequest {
  /** 标的代码 (如 BTC-USDT-SWAP) */
  symbol: string;
  /** 产品类型 */
  inst_type?: InstrumentType;
  /** 买卖方向 */
  side: OrderSide;
  /** 持仓方向 (合约定单必填: long / short / net) */
  pos_side?: PosSide;
  /** 委托类型 */
  order_type: OrderType;
  /** 委托数量 (张数/币数) */
  size: number;
  sz?: number;
  /** 委托价格 (限价单必填) */
  price?: number | null;
  /** 是否仅减仓 (Reduce-Only) */
  reduce_only?: boolean;
  /** 杠杆倍数 */
  leverage?: number;
  /** 附带止盈触发价 (OCO) */
  tp_trigger_price?: number | null;
  /** 附带止盈委托价 */
  tp_order_price?: number | null;
  tp_ord_price?: number | null;
  /** 附带止损触发价 (OCO) */
  sl_trigger_price?: number | null;
  /** 附带止损委托价 */
  sl_order_price?: number | null;
  sl_ord_price?: number | null;
  /** 客户端自定义订单唯一标识 */
  client_order_id?: string;
  /** 协同模式 */
  copilot_mode?: CopilotMode;
  /** 关联的 AI 研判 ID (用于归因统计) */
  ai_analysis_id?: string | number | null;
}

export type PlaceOrderRequest = OrderCreateRequest;

/**
 * 订单详情对象 (OrderItem - 全链路对齐 OrderModel)
 */
export interface OrderItem {
  /** 数据库 ID */
  id?: number;
  /** 系统/交易所订单 ID */
  order_id?: string | null;
  okx_order_id?: string | null;
  /** 客户端自定义订单 ID */
  client_order_id: string;
  /** 标的代码 */
  symbol: string;
  /** 产品类型 */
  inst_type?: InstrumentType;
  /** 买卖方向 */
  side: OrderSide;
  /** 持仓方向 */
  pos_side: PosSide;
  /** 委托类型 */
  order_type: OrderType;
  /** 委托数量 */
  size: number;
  sz?: number;
  /** 委托价格 */
  price?: number | null;
  /** 委托名义价值 (USDT) */
  notional_usdt?: number;
  notional_usd?: number;
  /** 累计已成交数量 */
  filled_size: number;
  filled_sz?: number;
  /** 成交均价 */
  avg_price: number;
  avg_px?: number;
  /** 订单状态 */
  state: OrderState;
  /** 累计手续费 */
  fee: number;
  /** 手续费扣除币种 */
  fee_currency: string;
  /** 杠杆倍数 */
  leverage: number;
  /** 附带止盈触发价 */
  tp_trigger_price?: number | null;
  tp_order_price?: number | null;
  tp_ord_price?: number | null;
  /** 附带止损触发价 */
  sl_trigger_price?: number | null;
  sl_order_price?: number | null;
  sl_ord_price?: number | null;
  /** 实现盈亏 (USDT) */
  pnl?: number;
  /** 是否通过风控 */
  risk_check_passed?: boolean;
  risk_check_msg?: string | null;
  /** 失败或拒绝原因说明 */
  reject_reason?: string | null;
  /** 协同模式 */
  copilot_mode?: CopilotMode;
  /** 关联的 AI 研判 ID */
  ai_analysis_id?: string | number | null;
  /** 订单创建时间戳 (ms) */
  created_at: number;
  /** 订单更新时间戳 (ms) */
  updated_at: number;
}

export type OrderModel = OrderItem;

/**
 * 撤销订单请求
 */
export interface OrderCancelRequest {
  /** 标的代码 */
  symbol: string;
  /** 订单 ID */
  order_id?: string | null;
  okx_order_id?: string | null;
  /** 客户端订单 ID */
  client_order_id?: string | null;
}

export type CancelOrderRequest = OrderCancelRequest;

/**
 * 批量撤单请求
 */
export interface BatchCancelOrdersRequest {
  symbol?: string | null;
  order_ids?: string[] | null;
}

/**
 * Panic Button 紧急熔断全平请求 (100% 严格对齐后端 models.py)
 */
export interface PanicButtonRequest {
  /** 主密码 (用于解密与安全二次确认) */
  master_password: string;
  /** 确认文本，必须严格等于 'PANIC_CLOSE_ALL' */
  confirm_phrase: 'PANIC_CLOSE_ALL' | string;
  /** 熔断目标范围: 'ALL', 'SWAP_ONLY', 'SPOT_ONLY' */
  target?: 'ALL' | 'SWAP_ONLY' | 'SPOT_ONLY';
  /** 是否撤销所有活动挂单 */
  cancel_all_orders?: boolean;
  /** 是否市价全平所有持仓 */
  close_all_positions?: boolean;
  /** 触发原因描述 */
  reason?: string;
  /** 二次确认安全 Token (前端兼容) */
  confirm_token?: string | null;
}

/**
 * Panic Button 执行明细
 */
export interface PanicExecutionDetail {
  symbol: string;
  action: 'CANCEL_ORDER' | 'CLOSE_POSITION' | string;
  target_id: string;
  status: 'SUCCESS' | 'FAILED' | string;
  message?: string | null;
}

/**
 * Panic Button 紧急熔断执行响应 (100% 严格对齐后端 models.py)
 */
export interface PanicButtonResponse {
  /** 执行是否整体成功 */
  success: boolean;
  /** 成功撤销的挂单总数 */
  canceled_orders_count: number;
  /** 成功触发市价全平的持仓总数 */
  closed_positions_count: number;
  /** 失败的操作描述列表 */
  failed_operations?: string[];
  /** 各标的执行明细列表 */
  execution_details?: PanicExecutionDetail[];
  /** 系统后续保护状态 */
  system_state?: string;
  /** 熔断触发时间戳 (ms) */
  circuit_broken_at: number;
  /** 处置完成摘要 */
  message: string;
}

// =============================================================================
// 8. 硬风控、审计日志与复盘归因契约 (Risk, Audit & Journal)
// =============================================================================

/**
 * 下单前硬风控检查结果
 */
export interface RiskCheckResult {
  /** 是否通过风控检查 */
  passed: boolean;
  /** 风控状态 */
  risk_status?: 'NORMAL' | 'WARNING' | 'CIRCUIT_BROKEN' | 'SAFE_MODE';
  /** 触发拦截的规则标识 (如 MAX_ORDER_USDT, DAILY_LOSS_LIMIT, MAX_LEVERAGE) */
  rejected_rule?: string | null;
  violated_rule?: string | null;
  /** 拦截提示详细文案 */
  message: string;
  /** 风控阈值 */
  threshold?: number;
  /** 尝试提交的实际数值 */
  actual_value?: number;
  /** 评估上下文指标 */
  evaluated_metrics?: Record<string, unknown>;
}

/**
 * 单日亏损统计与熔断状态
 */
export interface RiskDailyStats {
  /** 统计日期 (YYYY-MM-DD) */
  date: string;
  /** 当日已实现亏损 (USDT) */
  today_realized_pnl: number;
  /** 当日当前未实现浮动亏损 (USDT) */
  today_unrealized_pnl: number;
  /** 当日总亏损金额 (已实现 + 未实现) */
  today_total_loss: number;
  /** 最大允许亏损额度 (USDT) */
  max_daily_loss_limit: number;
  /** 亏损额度使用百分比 (0.0 ~ 1.0) */
  loss_usage_ratio: number;
  /** 系统是否已被硬风控熔断锁死 */
  is_circuit_broken: boolean;
  /** 熔断原因说明 */
  circuit_break_reason?: string | null;
  /** 熔断触发时间戳 (ms) */
  circuit_break_at?: number | null;
}

/**
 * 风控中枢实时状态响应
 */
export interface RiskStatusResponse {
  risk_status: 'NORMAL' | 'WARNING' | 'CIRCUIT_BROKEN' | 'SAFE_MODE';
  is_circuit_broken: boolean;
  circuit_break_reason?: string | null;
  circuit_break_at?: number | null;
  daily_loss_current: number;
  max_daily_loss_usdt: number;
  daily_loss_ratio: number;
  is_safe_mode: boolean;
  rules: HardRiskRules;
}

/**
 * 硬风控审计与拦截日志记录 (严格对齐 models.py 与数据库)
 */
export interface RiskAuditLogItem {
  /** 日志唯一 ID */
  id: number;
  /** 事件类型 (全集枚举) */
  event_type: RiskEventType;
  /** 告警等级 */
  severity: RiskSeverity;
  /** 触发源 */
  trigger_source?: string;
  /** 触发规则名 */
  rule_name?: string;
  /** 规则设定的阈值 */
  rule_limit_value?: string;
  /** 触发时的实际指标值 */
  current_metric_value?: string;
  /** 关联标的代码 */
  symbol?: string | null;
  /** 是否已被硬阻断 */
  is_blocked?: boolean;
  /** 采取的处置动作 */
  action_taken?: string;
  /** 详细审计上下文 (JSON 对象) */
  details?: Record<string, unknown>;
  /** 触发时间戳 (ms) */
  timestamp: number;
  created_at?: number;
}

export type RiskAuditLogModel = RiskAuditLogItem;

/**
 * AI 历史研判与盈亏比复盘归因记录
 */
export interface AIHistoryLogItem {
  /** 研判记录 ID */
  id: number;
  /** 研判唯一 UUID / ID */
  ai_analysis_id: string | number;
  analysis_uuid?: string;
  /** 标的代码 */
  symbol: string;
  /** 研判周期 */
  timeframe?: string;
  /** 建议操作信号 */
  signal_direction: SignalAction;
  signal_action?: SignalAction;
  /** 信号置信度 (0 ~ 100) */
  confidence_score?: number;
  /** 信号生成时的实际市场基准价 */
  signal_price: number;
  actual_market_price?: number;
  /** 建议入场均价 */
  suggested_entry_price?: number;
  /** 建议第一止盈价 */
  target_1_price: number;
  take_profit_target_1?: number;
  /** 建议第二止盈价 */
  target_2_price?: number;
  /** 建议止损价 */
  stop_loss_price: number;
  /** 用户是否采纳并下单 */
  is_adopted: boolean;
  adopted?: boolean;
  /** 采纳后的实际开仓订单 ID */
  order_id?: string | number | null;
  adopted_order_id?: string | null;
  /** 信号生效时间戳 (ms) */
  entry_time: number;
  /** 平仓评估结束时间戳 (ms) */
  exit_time?: number | null;
  /** 信号发出后最大浮盈 MFE (USDT 或 点数) */
  max_favorable_excursion?: number;
  max_profit_after_signal?: number;
  /** 信号发出后最大回撤 MAE (USDT 或 点数) */
  max_adverse_excursion?: number;
  max_drawdown_after_signal?: number;
  /** 是否触达止盈1 */
  hit_target_1?: boolean;
  /** 是否触达止盈2 */
  hit_target_2?: boolean;
  /** 是否触达止损 */
  hit_stop_loss?: boolean;
  /** 实际实现的盈亏金额 (USDT) */
  realized_pnl?: number;
  /** 实际达成盈亏比 */
  realized_rr?: number;
  /** 是否判定胜单 */
  is_win?: boolean | null;
  /** 最终复盘归因结果 */
  outcome?: AIAttributionOutcome | null;
  /** 归因追踪状态 */
  attribution_status: AttributionStatus;
  /** 复盘评语 */
  notes?: string | null;
  /** 研判生成时间戳 (ms) */
  created_at?: number;
}

export type AttributionLogModel = AIHistoryLogItem;

// =============================================================================
// 9. WebSocket 传输层协议载荷 (WebSocket Envelopes)
// 统一支持标准频道格式与 OKX v5 op/args 格式
// =============================================================================

/**
 * 客户端向服务端发送的 WS 请求报文 (兼容量化通道与 OKX v5 格式)
 */
export interface WSClientMessage {
  /** 操作指令 (标准 action 或 OKX op) */
  action?: 'subscribe' | 'unsubscribe' | 'ping' | 'auth';
  op?: 'subscribe' | 'unsubscribe' | 'ping' | 'auth';
  /** 标准订阅频道列表 (如 ['ticker:BTC-USDT-SWAP', 'positions']) */
  channels?: string[];
  /** OKX 兼容参数列表 */
  args?: Array<{
    channel: WSChannel | string;
    symbol?: string;
    timeframe?: TimeFrame | string;
    [key: string]: unknown;
  }>;
  /** 鉴权 Token */
  token?: string;
  /** 客户端时间戳 (ms) */
  timestamp?: number;
}

export type WSSubscribeMessage = WSClientMessage;

/**
 * 服务端心跳 Ping/Pong 报文
 */
export interface WSPingMessage {
  action: 'ping';
  timestamp: number;
}

export interface WSPongMessage {
  event: 'pong';
  timestamp: number;
}

/**
 * 服务端向前端广播推送的 WS 统一数据载荷包 (100% 对齐后端 WSPushPayload)
 */
export interface WSPushPayload<T = unknown> {
  /** 所属频道 (如 ticker:BTC-USDT-SWAP, positions, orders, risk_events) */
  channel?: string;
  /** 推送事件类型 */
  event: 'snapshot' | 'update' | 'error' | 'auth_success' | 'subscribed' | 'unsubscribed' | 'pong' | 'notice';
  /** 推送的业务数据实体或列表 */
  data?: T;
  /** 状态码 (0 成功) */
  code?: number;
  /** 提示或错误描述 */
  msg?: string;
  /** 订阅频道与参数元数据 (OKX 兼容) */
  arg?: {
    channel: WSChannel | string;
    symbol?: string;
    timeframe?: TimeFrame | string;
    [key: string]: unknown;
  };
  /** 推送毫秒时间戳 */
  timestamp: number;
}

export type WSServerMessage<T = unknown> = WSPushPayload<T>;

// =============================================================================
// 10. 模拟操盘沙盒与系统模式切换接口 (Paper Trading & Mode Switch)
// =============================================================================

export interface PaperAccountInfo {
  initial_equity_usdt: number;
  total_equity_usdt: number;
  available_margin_usdt: number;
  used_margin_usdt: number;
  unrealized_pnl_usdt: number;
  realized_pnl_usdt: number;
  today_realized_pnl_usdt: number;
  today_pnl_ratio: number;
  total_trades_count: number;
  winning_trades_count: number;
  win_rate: number;
  created_at?: number;
  updated_at?: number;
}

export interface PaperResetRequest {
  initial_equity_usdt: number;
}

export interface SwitchModeRequest {
  target_live_mode: boolean;
  master_password?: string;
}

// =============================================================================
// 11. 全自动量化操盘与盈利追踪契约 (Auto-Pilot & Profit Tracking Contracts)
// =============================================================================

export interface AutoPilotStatusModel {
  /** 当前是否处于自动操盘开启状态 */
  is_running: boolean;
  /** 当前自动操盘会话唯一ID */
  session_id?: string;
  /** 自动操盘开启时间戳 (ms) */
  start_time?: number;
  /** 开启以来的累计运行时长 (秒) */
  running_seconds: number;
  /** 开启时的基准账户总权益 (USDT) */
  start_equity_usdt: number;
  /** 当前账户总权益 (USDT) */
  current_equity_usdt: number;
  /** 开启以来综合总盈亏 (USDT = 当前权益 - 开启基准权益) */
  total_pnl_usdt: number;
  /** 开启以来综合收益率 (例如 0.052 表示 +5.2%) */
  total_pnl_ratio: number;
  /** 开启以来累计已实现盈亏 (USDT) */
  realized_pnl_usdt: number;
  /** 当前持仓未实现浮动盈亏 (USDT) */
  unrealized_pnl_usdt: number;
  /** 开启以来自动交易总笔数 */
  total_trades_count: number;
  /** 盈利单数 */
  winning_trades_count: number;
  /** 亏损单数 */
  losing_trades_count: number;
  /** 开启以来胜率 (0.0 ~ 1.0) */
  win_rate: number;
  /** 收益因子 / 盈亏比 */
  profit_factor: number;
  /** 开启以来最大回撤百分比 */
  max_drawdown_pct: number;
  /** 当前主要关注标的 */
  active_symbol: string;
  /** 多标的自动监控轮巡池 */
  symbols?: string[];
  /** 自选与专注标的池 */
  focus_symbols?: string[];
  /** 操盘专注模式: SINGLE_SYMBOL 单标的专注量化 / MULTI_SYMBOL_POOL 多标的池 */
  focus_mode?: 'SINGLE_SYMBOL' | 'MULTI_SYMBOL_POOL';
  /** 最大加仓层数 (1~5层) */
  max_scale_layers?: number;
  /** 加仓策略类型: PYRAMIDING 顺势金字塔 / PULLBACK_DCA 动态回调 / SMART_HYBRID 智能混合 */
  scale_in_strategy?: 'PYRAMIDING' | 'PULLBACK_DCA' | 'SMART_HYBRID';
  /** 强反向信号是否自动反手平反开 */
  auto_reversal_enabled?: boolean;
  /** 最大同时持仓标的数 */
  max_concurrent_positions?: number;
  /** 是否启用动态移动保本与跟踪止损 */
  trailing_stop_enabled?: boolean;
  /** 浮盈达到目标位比例时移至保本 */
  breakeven_trigger_ratio?: number;
  /** 自动跟单最低置信度门槛 */
  min_confidence: number;
  /** 是否启用自适应智能杠杆 */
  auto_leverage_enabled: boolean;
  /** 最低保留本金底线 (USDT，亏损至该值自动熔断停止操盘) */
  stop_loss_equity_floor?: number | null;
  /** 最大允许亏损金额 (USDT) */
  max_loss_limit_usdt?: number | null;
  /** 操盘激进程度: CONSERVATIVE 保守稳健 / BALANCED 标准量化 / AGGRESSIVE 积极进攻 */
  aggressiveness_mode?: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
  /** 是否为实盘环境 */
  is_live_mode: boolean;
  /** 最近一次后端自动巡检时间戳 (ms) */
  last_patrol_time?: number;
  /** 最近一次后端自动巡检结果概要 */
  last_patrol_log?: string;
  /** 最新统计更新时间戳 (ms) */
  last_updated_at: number;
}

export interface AutoPilotHistoryPoint {
  /** 采样时间戳 (ms) */
  timestamp: number;
  /** 该时刻账户总权益 (USDT) */
  equity: number;
  /** 该时刻累计已实现盈亏 (USDT) */
  realized_pnl: number;
  /** 该时刻持仓浮动盈亏 (USDT) */
  unrealized_pnl: number;
  /** 该时刻开启以来综合总盈亏 (USDT) */
  total_pnl: number;
  /** 该时刻收益率 */
  pnl_ratio: number;
}

export interface AutoPilotTradeRecord {
  /** 记录 ID */
  id?: string;
  /** 标的代码 */
  symbol: string;
  /** 持仓方向 long/short */
  pos_side: string;
  /** 开仓均价 */
  entry_price: number;
  /** 平仓价格 */
  exit_price: number;
  /** 成交数量 (币数) */
  size: number;
  /** 杠杆倍数 */
  leverage: number;
  /** 该笔已实现盈亏 (USDT) */
  realized_pnl: number;
  /** 该笔收益率 (%) */
  roi_pct: number;
  /** 平仓触发原因 */
  reason: string;
  /** 平仓完成时间戳 (ms) */
  timestamp: number;
}

export interface AutoPilotHistoryResponse {
  /** 会话ID */
  session_id?: string;
  /** 当前是否在运行 */
  is_running: boolean;
  /** 时序收益走势采样点列表 */
  curve: AutoPilotHistoryPoint[];
  /** 自动操盘产生的平仓明细列表 */
  trades: AutoPilotTradeRecord[];
}

export interface AutoPilotStartRequest {
  aggressiveness_mode?: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
  min_confidence?: number;
  auto_leverage_enabled?: boolean;
  stop_loss_equity_floor?: number | null;
  max_loss_limit_usdt?: number | null;
  symbol?: string;
  symbols?: string[];
  focus_symbols?: string[];
  focus_mode?: 'SINGLE_SYMBOL' | 'MULTI_SYMBOL_POOL';
  max_scale_layers?: number;
  scale_in_strategy?: 'PYRAMIDING' | 'PULLBACK_DCA' | 'SMART_HYBRID';
  auto_reversal_enabled?: boolean;
  max_concurrent_positions?: number;
  trailing_stop_enabled?: boolean;
  breakeven_trigger_ratio?: number;
}

export interface AutoPilotConfigUpdateRequest {
  aggressiveness_mode?: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
  min_confidence?: number;
  auto_leverage_enabled?: boolean;
  stop_loss_equity_floor?: number | null;
  max_loss_limit_usdt?: number | null;
  symbol?: string;
  symbols?: string[];
  focus_symbols?: string[];
  focus_mode?: 'SINGLE_SYMBOL' | 'MULTI_SYMBOL_POOL';
  max_scale_layers?: number;
  scale_in_strategy?: 'PYRAMIDING' | 'PULLBACK_DCA' | 'SMART_HYBRID';
  auto_reversal_enabled?: boolean;
  max_concurrent_positions?: number;
  trailing_stop_enabled?: boolean;
  breakeven_trigger_ratio?: number;
}

export type InstrumentCategory =
  | 'tradfi'
  | 'rwa'
  | 'crypto'
  | 'commodities'
  | 'equities'
  | 'positions'
  | 'custom';

export interface InstrumentInfo {
  symbol: string;
  inst_id: string;
  inst_type: 'SPOT' | 'SWAP' | 'FUTURES' | 'MARGIN';
  base_ccy: string;
  quote_ccy: string;
  name: string;
  category: InstrumentCategory;
  is_tradfi: boolean;
  ct_val?: number;
  tick_sz?: number;
  lot_sz?: number;
  min_sz?: number;
  state?: string;
}

export interface SymbolCategoryGroup {
  category: InstrumentCategory;
  category_name: string;
  icon: string;
  symbols: InstrumentInfo[];
}

export interface SymbolListResponse {
  categories: SymbolCategoryGroup[];
  total_count: number;
}

// =============================================================================
// 12. 模块 A：历史时序数据湖与回测沙盒契约 (Data Lake & Backtest Types)
// =============================================================================

export interface DataLakeSyncRequest {
  symbol: string;
  timeframes?: string[];
  days_back?: number;
}

export interface DataLakeStatusItem {
  symbol: string;
  timeframe: string;
  count: number;
  start_time?: number | null;
  end_time?: number | null;
}

export interface DataLakeStatusResponse {
  total_klines: number;
  items: DataLakeStatusItem[];
}

export interface BacktestRunRequest {
  strategy_name?: string;
  symbol: string;
  timeframe?: string;
  days_back?: number;
  initial_balance?: number;
  leverage?: number;
  taker_fee_rate?: number;
  maker_fee_rate?: number;
  slippage_pct?: number;
  atr_sl_multiplier?: number;
  breakeven_ratio?: number;
  funding_rate_8h?: number;
  params?: Record<string, any>;
}

export interface BacktestTradeRecord {
  trade_id: number;
  entry_time: number;
  exit_time: number;
  pos_side: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  size: number;
  pnl: number;
  roi_pct: number;
  fee: number;
  exit_reason: string;
  mfe_pct: number;
  mae_pct: number;
}

export interface BacktestEquityPoint {
  timestamp: number;
  equity: number;
  drawdown_pct: number;
}

export interface BacktestResultResponse {
  experiment_id: string;
  strategy_name: string;
  symbol: string;
  timeframe: string;
  total_candles: number;
  initial_balance: number;
  final_balance: number;
  total_return_pct: number;
  annualized_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  calmar_ratio: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_trade_pnl: number;
  total_fee_paid: number;
  equity_curve: BacktestEquityPoint[];
  trades: BacktestTradeRecord[];
  execution_time_ms: number;
}

export interface GridSearchRequest {
  strategy_name?: string;
  symbol?: string;
  timeframe?: string;
  days_back?: number;
  atr_multipliers?: number[];
  breakeven_ratios?: number[];
  leverages?: number[];
}

export interface GridSearchResultItem {
  params: Record<string, any>;
  total_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
}

export interface GridSearchResponse {
  best_params: Record<string, any>;
  items: GridSearchResultItem[];
}

// =============================================================================
// 13. 模块 B：全网情报与热点新闻感知契约 (News & Macro Types)
// =============================================================================

export interface NewsEventItem {
  id: string;
  source: string;
  title: string;
  content?: string | null;
  url?: string | null;
  published_at: number;
  sentiment_score: number;
  urgency: 'P0' | 'P1' | 'P2' | string;
  related_symbols?: string[];
  is_fud_or_rumor?: boolean;
  summary_zh?: string | null;
}

export interface NewsFeedResponse {
  news: NewsEventItem[];
  total_count: number;
}

export interface MacroCalendarEvent {
  event_id: string;
  title: string;
  country: string;
  impact_level: string;
  event_time: number;
  previous_value?: string | null;
  forecast_value?: string | null;
  actual_value?: string | null;
  is_imminent_risk: boolean;
}

export interface MacroCalendarResponse {
  events: MacroCalendarEvent[];
}

// =============================================================================
// 14. 模块 C：每日自动复盘与知识演化契约 (Daily Review & Knowledge Base Types)
// =============================================================================

export interface DailyReviewDetail {
  review_date: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  realized_pnl: number;
  fee_paid: number;
  max_drawdown: number;
  best_trade_pnl: number;
  worst_trade_pnl: number;
  summary_markdown: string;
  lessons_learned?: string[];
  strategy_adjustments?: Record<string, any>;
  created_at: string;
}

export interface DailyReviewListResponse {
  reviews: DailyReviewDetail[];
}

export interface TradingKnowledgeRule {
  id: string;
  rule_type: 'MISTAKE_AVOIDANCE' | 'BEST_PRACTICE' | 'MACRO_REGIME' | string;
  symbol_scope: string;
  trigger_condition: string;
  action_rule: string;
  confidence_score: number;
  source_review_date?: string | null;
  times_triggered: number;
  is_active: boolean;
  created_at?: string;
}

export interface TradingKnowledgeListResponse {
  rules: TradingKnowledgeRule[];
  total_count: number;
}

// =============================================================================
// 15. 模块 D：多智能体对抗博弈与 Telegram 契约 (Consensus & Telegram Types)
// =============================================================================

export interface AgentDebateOpinion {
  role_name: string;
  stance: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | string;
  confidence: number;
  key_arguments: string[];
  risk_warnings: string[];
}

export interface MultiAgentConsensusResponse {
  consensus_id: string;
  symbol: string;
  timestamp: number;
  consensus_score: number;
  final_action: SignalAction | string;
  is_approved_to_execute: boolean;
  rejection_reason?: string | null;
  bull_opinion: AgentDebateOpinion;
  bear_opinion: AgentDebateOpinion;
  macro_opinion: AgentDebateOpinion;
  arbitration_summary: string;
  injected_knowledge_rules: string[];
  suggested_trade_plan?: Record<string, any> | null;
}

export interface TelegramConfig {
  bot_token_masked?: string | null;
  chat_id_masked?: string | null;
  is_enabled: boolean;
  is_panic_enabled: boolean;
}

export interface TelegramConfigSaveRequest {
  bot_token: string;
  chat_id: string;
  is_enabled?: boolean;
  is_panic_enabled?: boolean;
}

export interface TiltProtectionStatus {
  is_in_cooldown: boolean;
  cooldown_until_ts?: number | null;
  cooldown_remaining_mins: number;
  consecutive_loss_count: number;
  leverage_penalty_applied: boolean;
  reason?: string | null;
}




