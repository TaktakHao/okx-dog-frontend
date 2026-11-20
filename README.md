# OKX-Dog Frontend - 暗黑专业量化交易与监控终端

OKX-Dog Frontend 是基于 React 18、TypeScript 与 TradingView Lightweight Charts 构建的金融级暗黑交易与投研监控终端，通过 WebSocket 与 SSE 实时连接后端服务。

---

## 技术栈

- **前端框架**：React 18 + Vite 5 + TypeScript（严格对齐 `TYPES_CONTRACT.ts` 契约）
- **样式体系**：TailwindCSS 暗黑金融主题
- **图表引擎**：`lightweight-charts` Canvas 引擎（多周期 K 线、EMA 均线组、成交量、持仓/止损位叠加与交互式多维收益曲线）
- **状态与通信**：Zustand 分片状态管理 + 全双工 WebSocket 行情/风控推流 + SSE 思维链流式渲染

---

## 核心界面模块

- **双引擎影子盘主控面板（`AutoPilotCard`）**：精简聚焦 Gate 2 冻结双引擎组合（60% 趋势 + 30% 套利 + 10% 缓冲），提供一键启动/暂停、旧余额一键重置干净基线、Top 5 核心标的快捷切换、18% 停机底线保护与自动平仓流水。
- **双引擎组合看板与同构回测台（`BacktestModal`）**：顶部主按钮直达，默认展示 60/30/10 资金槽位与红线监控、一键触发主引擎 B（Gate 2A 7 项）与底座引擎 A（Gate 2B 5 项）自动化验真、Top 5 实时期现资金费率雷达及 `SEMI_AUTO` / `FULL_AUTO` 开关，同时支持历史回测与滚动 Walk-Forward 校验。
- **全景多维收益曲线面板（`EquityCurvePanel`）**：独立停靠右侧主区，支持拖拽平移、滚轮缩放与全屏查看，同屏展示总净盈亏、已实现/浮动盈亏、账户总权益、历史最高净值水线与平仓打点。
- **全量标的检索器（`SymbolSelectorModal` / `Ctrl+P`）**：直连 OKX 官方在架标的库，支持防抖模糊检索与一键切换主图。
- **持仓、委托与成交面板（`PositionList`）**：实时监控持仓浮盈、预估强平价、止盈止损调整、活跃挂单撤单与历史成交流水。
- **离线复盘与防守工具箱（`DailyReviewModal` / `NewsFeedModal`）**：收纳于顶部「离线工具」菜单，用于每日离线归因复盘与黑天鹅突发情报监控。
- **风控安全与运维监控（`SecurityModal` / `OpsMetricsModal`）**：提供 AES-256 凭证密盒配置、Antigravity CLI 本地模型下拉选择、`MASTER_PASSWORD` 口令校验解除单日熔断、Panic Button 紧急全撤全平、WS/REST 延迟、对账健康度与数据湖覆盖监控。

---

## 快速启动与构建

```bash
# 安装依赖
npm install

# 启动本地开发服务器 (端口 3000)
npm run dev

# TypeScript 类型校验与生产构建
npm run build
```
