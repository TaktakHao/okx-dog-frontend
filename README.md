# OKX-Dog Frontend - 极客暗黑专业量化交易终端

OKX-Dog 是一款高品质、金融级暗黑质感的高频量化交易与 AI 智能副驾驶终端前端应用。

## 技术栈与架构

- **核心框架**: React 18 + Vite 5 + TypeScript
- **样式与设计系统**: TailwindCSS + 精心调配的金融暗黑主题（Sleek Dark Theme）
- **图表引擎**: TradingView `lightweight-charts` (多周期 K 线 + 真实浮动影线聚合 + EMA 20/50/200 均线组 + 成交量副图 + 持仓/止盈止损/AI关键位叠加)
- **状态管理**: Zustand 分片响应式架构 (`useAppStore`)
- **通讯链路**: WebSocket 毫秒级全双工长连接 (`/ws/v5/public`) + SSE (Server-Sent Events) AI 思维链流式解析

## 核心功能模块

1. **AI 智能副驾驶卡片 (AICopilotCard)**:
   - 实时多周期行情分析与结构化量化建议
   - DeepSeek 推理思维链 `<think>` 打字机渐显解析
   - ⚡ **一键直接开仓 (市价直通)** / **⚙️ 参数微调采纳**
2. **交易调度与持仓委托面板 (PositionList)**:
   - `活跃持仓`: 标的、方向、开仓均价、标记价、UPL 浮盈、预估强平价、止盈止损调整、市价全平/限价平仓
   - `当前挂单/委托`: 委托单号、价格、数量、成交进度、一键撤单
   - `历史成交记录`: 平仓明细、已实现盈亏、收益率与平仓归因
3. **极速下单面板 (OrderForm)**:
   - 限价/市价委托、多空双向开仓、杠杆调节、止盈止损预设
4. **硬风控熔断中枢与 Panic Button**:
   - 顶部 Panic Button 快捷全平熔断
   - AES-256 安全密盒管理

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 生产打包
npm run build
```
