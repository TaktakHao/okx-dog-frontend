/**
 * @file QuantStudioModal.tsx
 * @description OKX-Dog v3.5 AI Quant Studio & Codex Harness 策略代码实验室
 * 角色: 前端资深开发与数据可视化工程师 (agency-senior-developer, agency-data-visualization-engineer)
 * 功能: 自然语言策略生成、AST 审查状态流转、Python 源码编辑器、极速沙箱回测、权益曲线可视化与黄金集 Benchmark
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Play,
  ShieldCheck,
  AlertTriangle,
  Code2,
  TrendingUp,
  Award,
  RefreshCw,
  FileCode,
  Terminal,
  Zap,
} from 'lucide-react';
import {
  studioApi,
  StrategyTemplateItem,
  StrategyGenerationResult,
} from '../services/api';
import { useAppStore } from '../store/useAppStore';

interface QuantStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuantStudioModal: React.FC<QuantStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeSymbol, activeTimeframe } = useAppStore();

  const [prompt, setPrompt] = useState(
    '基于 15m 周期 RSI 超卖反弹且资金费率转正时开多，超买转负时开空'
  );
  const [symbol, setSymbol] = useState<string>(activeSymbol || 'BTC-USDT-SWAP');
  const [timeframe, setTimeframe] = useState<string>(activeTimeframe || '15m');
  const [templates, setTemplates] = useState<StrategyTemplateItem[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'benchmark'>('editor');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  const [result, setResult] = useState<StrategyGenerationResult | null>(null);
  const [editableCode, setEditableCode] = useState<string>('');
  const [benchmarkReport, setBenchmarkReport] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 初始化加载模板
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      const res = await studioApi.getTemplates();
      setTemplates(res || []);
      if (!result && res && res.length > 0) {
        setEditableCode(res[0].code);
      }
    } catch (e) {
      console.error('加载模板库失败', e);
    }
  };

  const handleSelectTemplate = (tpl: StrategyTemplateItem) => {
    setPrompt(tpl.description);
    setEditableCode(tpl.code);
    setResult(null);
    setErrorMsg(null);
  };

  // 触发 AI 生成 + 回测闭环
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const res = await studioApi.generateStrategy({
        prompt,
        symbol,
        timeframe,
        max_retries: 3,
      });
      setResult(res);
      setEditableCode(res.code);
    } catch (e: any) {
      setErrorMsg(e?.message || '策略生成与回测失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 触发自定义代码回测
  const handleCustomBacktest = async () => {
    if (!editableCode.trim()) return;
    setIsBacktesting(true);
    setErrorMsg(null);
    try {
      const res = await studioApi.backtestCustom({
        code: editableCode,
        symbol,
        timeframe,
      });
      setResult(res);
    } catch (e: any) {
      setErrorMsg(e?.message || '自定义策略回测失败');
    } finally {
      setIsBacktesting(false);
    }
  };

  // 运行黄金基准测试套件
  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const rep = await studioApi.runBenchmark();
      setBenchmarkReport(rep);
    } catch (e: any) {
      setErrorMsg(e?.message || '基准测试评测失败');
    } finally {
      setIsBenchmarking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-7xl h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* 顶部 Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-wide text-white">
                  OKX-Dog AI Quant Studio
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                  v3.5 Codex Harness
                </span>
              </div>
              <p className="text-xs text-slate-400">
                AI 自主量化因子研发 · AST 安全白名单隔离 · 10,000 根 K
                线极速向量化回测
              </p>
            </div>
          </div>

          {/* 切换 Tab */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'editor'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              策略实验室
            </button>
            <button
              onClick={() => setActiveTab('benchmark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'benchmark'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              模型防退化评测
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'editor' ? (
            <>
              {/* 左侧控制栏 */}
              <div className="w-[380px] border-r border-slate-800 bg-slate-950/40 p-5 flex flex-col gap-4 overflow-y-auto">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                    <span>💡 自然语言需求 (Codex Prompt)</span>
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    placeholder="例如: 15m 布林带带宽挤压突破 + 资金费率由负转正时开多..."
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      交易标的
                    </label>
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      回测周期
                    </label>
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="15m">15m (日内波段)</option>
                      <option value="1h">1h (趋势跟踪)</option>
                      <option value="4h">4h (大周期共振)</option>
                      <option value="1d">1d (宏观日线)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Codex 正在生成与自愈回测...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      AI 编写策略并回测 (Run Loop)
                    </>
                  )}
                </button>

                {/* 经典预设模板 */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                    官方经典因子模板库
                  </label>
                  <div className="flex flex-col gap-2">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className="text-left p-2.5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition-all group"
                      >
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-400">
                          {tpl.name}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {tpl.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* 右侧工作区: 代码 + 回测指标 */}
              <div className="flex-1 flex flex-col bg-slate-900/50 overflow-hidden">
                {/* 顶部指标概览栏 */}
                <div className="p-4 border-b border-slate-800 bg-slate-950/30 grid grid-cols-5 gap-3">
                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <div className="text-[11px] text-slate-400">累计收益率</div>
                    <div
                      className={`text-base font-bold mt-0.5 ${
                        (result?.metrics?.total_return_pct ?? 0) >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {result?.metrics?.total_return_pct !== undefined
                        ? `${result.metrics.total_return_pct > 0 ? '+' : ''}${result.metrics.total_return_pct}%`
                        : '--'}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <div className="text-[11px] text-slate-400">最大回撤</div>
                    <div className="text-base font-bold text-rose-400 mt-0.5">
                      {result?.metrics?.max_drawdown_pct !== undefined
                        ? `-${result.metrics.max_drawdown_pct}%`
                        : '--'}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <div className="text-[11px] text-slate-400">夏普比率</div>
                    <div className="text-base font-bold text-cyan-400 mt-0.5">
                      {result?.metrics?.sharpe_ratio ?? '--'}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <div className="text-[11px] text-slate-400">胜率 / 盈亏比</div>
                    <div className="text-xs font-semibold text-slate-200 mt-1">
                      {result?.metrics?.win_rate_pct !== undefined
                        ? `${result.metrics.win_rate_pct}% / 1:${result.metrics.profit_factor}`
                        : '--'}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <div className="text-[11px] text-slate-400">AST 安全审查</div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 mt-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      100% 审计合规
                    </div>
                  </div>
                </div>

                {/* 资金权益走势图 (简易 SVG 渲染) */}
                {result?.equity_curve && result.equity_curve.length > 0 && (
                  <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/20">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        账户资金权益走势 (Equity Curve)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        样本总量: {result.metrics?.total_bars ?? 1000} 根 K 线
                      </span>
                    </div>
                    <div className="h-24 w-full bg-slate-900/80 border border-slate-800/80 rounded-xl p-2 flex items-end">
                      <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                          points={result.equity_curve
                            .map((p, idx) => {
                              const x = (idx / (result.equity_curve.length - 1)) * 500;
                              const minEq = 0.8;
                              const maxEq = 1.3;
                              const y = 100 - ((p.equity - minEq) / (maxEq - minEq)) * 100;
                              return `${x},${Math.max(5, Math.min(95, y))}`;
                            })
                            .join(' ')}
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {/* 代码编辑与查看区 */}
                <div className="flex-1 p-4 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      Python 向量化策略源码 (Editable Python Source)
                    </span>
                    <button
                      onClick={handleCustomBacktest}
                      disabled={isBacktesting}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      <Play className="w-3 h-3" />
                      {isBacktesting ? '回测中...' : '回测当前代码'}
                    </button>
                  </div>

                  <textarea
                    value={editableCode}
                    onChange={(e) => setEditableCode(e.target.value)}
                    spellCheck={false}
                    className="flex-1 w-full bg-slate-950 font-mono text-xs text-emerald-300/90 p-4 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed selection:bg-cyan-500/20"
                  />
                </div>
              </div>
            </>
          ) : (
            /* 黄金测试集基准评测面板 */
            <div className="flex-1 p-6 overflow-y-auto bg-slate-950/40">
              <div className="max-w-4xl mx-auto flex flex-col gap-5">
                <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-400" />
                      500+ 极端行情黄金基准测试集 (Golden Dataset)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      评测模型在插针、单边暴跌、资金费率挤压与假突破场景下的生成合规率与策略稳健度
                    </p>
                  </div>
                  <button
                    onClick={handleRunBenchmark}
                    disabled={isBenchmarking}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                  >
                    {isBenchmarking ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {isBenchmarking ? '正在批量运行评测...' : '启动全量基准评测'}
                  </button>
                </div>

                {benchmarkReport && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-[11px] text-slate-400">总测试用例</div>
                        <div className="text-lg font-bold text-white mt-1">
                          {benchmarkReport.total_cases}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-[11px] text-slate-400">合规通过用例</div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">
                          {benchmarkReport.passed_cases}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-[11px] text-slate-400">通过率</div>
                        <div className="text-lg font-bold text-cyan-400 mt-1">
                          {benchmarkReport.pass_rate_pct}%
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="text-[11px] text-slate-400">平均夏普比率</div>
                        <div className="text-lg font-bold text-indigo-400 mt-1">
                          {benchmarkReport.avg_sharpe_ratio}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 mb-2">
                        📋 详细评测用例清单
                      </h4>
                      <div className="flex flex-col gap-2">
                        {benchmarkReport.details?.map((d: any, i: number) => (
                          <div
                            key={i}
                            className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                          >
                            <span className="text-slate-300">{d.prompt}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400">
                                夏普: {d.metrics?.sharpe_ratio ?? '--'}
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-medium">
                                {d.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
