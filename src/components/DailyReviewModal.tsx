import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Calendar,
  RefreshCw,
  Plus,
  Lightbulb,
} from 'lucide-react';
import { reviewApi, knowledgeBaseApi } from '../services/api';
import { DailyReviewDetail, TradingKnowledgeRule } from '../types';

interface DailyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyReviewModal: React.FC<DailyReviewModalProps> = ({ isOpen, onClose }) => {
  const [reviews, setReviews] = useState<DailyReviewDetail[]>([]);
  const [selectedReview, setSelectedReview] = useState<DailyReviewDetail | null>(null);
  const [rules, setRules] = useState<TradingKnowledgeRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'knowledge'>('review');

  // 新增规则表单状态
  const [newRuleCondition, setNewRuleCondition] = useState('');
  const [newRuleAction, setNewRuleAction] = useState('');
  const [newRuleType, setNewRuleType] = useState('MISTAKE_AVOIDANCE');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [revRes, ruleRes] = await Promise.all([
        reviewApi.getDailyReviews(10),
        knowledgeBaseApi.getRules(),
      ]);
      setReviews(revRes.reviews || []);
      if (revRes.reviews && revRes.reviews.length > 0) {
        setSelectedReview(revRes.reviews[0]);
      }
      setRules(ruleRes.rules || []);
    } catch (e) {
      console.error('加载复盘与知识库数据失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTodayReview = async () => {
    try {
      setLoading(true);
      const res = await reviewApi.generateReview();
      await loadData();
      setSelectedReview(res);
    } catch (e) {
      alert('生成复盘报告失败: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleCondition || !newRuleAction) return;

    try {
      await knowledgeBaseApi.saveRule({
        id: '',
        rule_type: newRuleType,
        symbol_scope: '*',
        trigger_condition: newRuleCondition,
        action_rule: newRuleAction,
        confidence_score: 1.0,
        times_triggered: 0,
        is_active: true,
      });
      setNewRuleCondition('');
      setNewRuleAction('');
      const ruleRes = await knowledgeBaseApi.getRules();
      setRules(ruleRes.rules || []);
    } catch (e) {
      alert('添加规则失败: ' + (e as Error).message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative flex h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-gray-800 bg-[#0d1117] shadow-2xl overflow-hidden text-gray-200">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                每日深度复盘 & 交易自演化知识大脑
                <span className="rounded bg-purple-950 px-2 py-0.5 text-xs text-purple-400 border border-purple-800">
                  RAG 反向避坑注入
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                每日战报解剖 • MFE/MAE效率归因 • 历史失误沉淀为策略前车之鉴警示
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateTodayReview}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              一键生成今日深度复盘
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab 导航 */}
        <div className="flex border-b border-gray-800 px-6 bg-[#161b22]/50 gap-6">
          <button
            onClick={() => setActiveTab('review')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'review'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4" />
            每日盘后复盘战报
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'knowledge'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            交易员经验与避坑规则库 ({rules.length})
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex flex-1 overflow-hidden">
          {activeTab === 'review' && (
            <div className="flex w-full overflow-hidden">
              {/* 左侧日期选择列表 */}
              <div className="w-64 border-r border-gray-800 bg-[#12161f] p-4 overflow-y-auto space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  历史复盘日期
                </div>
                {reviews.map((r) => (
                  <button
                    key={r.review_date}
                    onClick={() => setSelectedReview(r)}
                    className={`w-full text-left p-3 rounded-lg border transition flex flex-col gap-1 ${
                      selectedReview?.review_date === r.review_date
                        ? 'border-purple-500 bg-purple-950/30 text-white'
                        : 'border-gray-800 bg-[#161b22] text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span>{r.review_date}</span>
                      <span className={`font-mono text-xs ${r.realized_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {r.realized_pnl >= 0 ? '+' : ''}{r.realized_pnl} U
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      胜率: {(r.win_rate * 100).toFixed(0)}% • 交易: {r.total_trades} 笔
                    </div>
                  </button>
                ))}
              </div>

              {/* 右侧 Markdown 报告预览 */}
              <div className="flex-1 overflow-y-auto p-8 bg-[#0d1117]">
                {selectedReview ? (
                  <div className="space-y-6 max-w-4xl mx-auto">
                    {/* 顶部指标胶囊 */}
                    <div className="grid grid-cols-4 gap-3 bg-[#161b22] p-4 rounded-xl border border-gray-800">
                      <div>
                        <span className="text-xs text-gray-500">已实现盈亏</span>
                        <div className={`text-xl font-bold font-mono ${selectedReview.realized_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {selectedReview.realized_pnl >= 0 ? '+' : ''}{selectedReview.realized_pnl} USDT
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">胜率</span>
                        <div className="text-xl font-bold font-mono text-amber-400">
                          {(selectedReview.win_rate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">手续费磨损</span>
                        <div className="text-xl font-bold font-mono text-gray-300">
                          {selectedReview.fee_paid} USDT
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">总成交流水</span>
                        <div className="text-xl font-bold font-mono text-purple-400">
                          {selectedReview.total_trades} 笔
                        </div>
                      </div>
                    </div>

                    {/* Markdown 报告正文 */}
                    <div className="prose prose-invert max-w-none text-sm text-gray-300 whitespace-pre-wrap font-sans bg-[#161b22] p-6 rounded-xl border border-gray-800">
                      {selectedReview.summary_markdown}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-500">
                    请选择左侧复盘日期或点击右上角生成今日战报
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* 新增规则表单 */}
              <form onSubmit={handleAddRule} className="rounded-xl border border-gray-800 bg-[#161b22] p-4 space-y-3">
                <div className="text-xs font-semibold uppercase text-purple-400 flex items-center gap-1.5">
                  <Plus className="h-4 w-4" />
                  手动录入交易心得与避坑规则
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <select
                    value={newRuleType}
                    onChange={(e) => setNewRuleType(e.target.value)}
                    className="rounded bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-white"
                  >
                    <option value="MISTAKE_AVOIDANCE">MISTAKE_AVOIDANCE (失误避坑)</option>
                    <option value="BEST_PRACTICE">BEST_PRACTICE (最佳实践)</option>
                    <option value="MACRO_REGIME">MACRO_REGIME (宏观纪律)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="前置触发场景 (如: 4H RSI > 75 且 费率过热)"
                    value={newRuleCondition}
                    onChange={(e) => setNewRuleCondition(e.target.value)}
                    className="rounded bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="行动准则 (如: 坚决严禁追多，仅允许等待背离空)"
                    value={newRuleAction}
                    onChange={(e) => setNewRuleAction(e.target.value)}
                    className="rounded bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded bg-purple-600 hover:bg-purple-500 px-4 py-1.5 text-xs font-semibold text-white"
                >
                  保存并加入知识库
                </button>
              </form>

              {/* 规则列表 */}
              <div className="grid grid-cols-2 gap-4">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-xl border border-gray-800 bg-[#161b22] p-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="rounded bg-purple-950 text-purple-400 px-2 py-0.5 text-xs font-bold font-mono">
                          {rule.rule_type}
                        </span>
                        <span className="text-xs text-emerald-400 font-mono">
                          已拦截/触发: {rule.times_triggered} 次
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        <span className="text-gray-500 font-semibold">触发前置: </span>
                        {rule.trigger_condition}
                      </div>
                      <div className="text-xs text-white font-medium bg-gray-900/60 p-2.5 rounded border border-gray-800">
                        <span className="text-purple-400 font-bold">避坑准则: </span>
                        {rule.action_rule}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-3 pt-2 border-t border-gray-800 flex justify-between">
                      <span>适用标的: {rule.symbol_scope}</span>
                      <span>来源: {rule.source_review_date || '实战沉淀'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};