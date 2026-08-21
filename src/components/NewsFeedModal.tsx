import React, { useState, useEffect } from 'react';
import {
  X,
  Newspaper,
  Calendar,
  Radio,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
} from 'lucide-react';
import { newsApi } from '../services/api';
import { MacroCalendarEvent, NewsEventItem } from '../types';

interface NewsFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewsFeedModal: React.FC<NewsFeedModalProps> = ({ isOpen, onClose }) => {
  const [newsList, setNewsList] = useState<NewsEventItem[]>([]);
  const [macroEvents, setMacroEvents] = useState<MacroCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'news' | 'macro'>('news');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [nRes, mRes] = await Promise.all([
        newsApi.getFeed(30),
        newsApi.getMacroCalendar(),
      ]);
      setNewsList(nRes.news || []);
      setMacroEvents(mRes.events || []);
    } catch (e) {
      console.error('加载新闻与宏观日历失败', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-gray-800 bg-[#0d1117] shadow-2xl overflow-hidden text-gray-200">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Newspaper className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                全网宏观情报与突发新闻感知网络
                <span className="rounded bg-blue-950 px-2 py-0.5 text-xs text-blue-400 border border-blue-800">
                  AI NLP 毫秒级情感打分
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                多源资讯聚合 • 突发黑天鹅监控 • 全球宏观日历 15 分钟高危风控预警
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs text-gray-300 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
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
            onClick={() => setActiveTab('news')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'news'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Radio className="h-4 w-4" />
            实时热点快讯流 ({newsList.length})
          </button>
          <button
            onClick={() => setActiveTab('macro')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'macro'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4" />
            全球宏观经济日历 ({macroEvents.length})
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'news' && (
            <div className="space-y-3">
              {newsList.map((item) => {
                const isBull = item.sentiment_score > 0.2;
                const isBear = item.sentiment_score < -0.2;
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-gray-800 bg-[#161b22] p-4 hover:border-gray-700 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                              item.urgency === 'P0'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                                : item.urgency === 'P1'
                                ? 'bg-blue-950 text-blue-400'
                                : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {item.urgency}
                          </span>
                          <span className="text-xs text-gray-500 font-mono uppercase">
                            [{item.source}]
                          </span>
                          <h4 className="text-sm font-semibold text-white">
                            {item.title}
                          </h4>
                        </div>
                        {item.summary_zh && (
                          <p className="text-xs text-emerald-400/90 font-medium bg-emerald-950/20 px-2 py-1 rounded border border-emerald-900/30">
                            💡 AI 核心提炼: {item.summary_zh}
                          </p>
                        )}
                        {item.content && (
                          <p className="text-xs text-gray-400 line-clamp-2">
                            {item.content}
                          </p>
                        )}
                      </div>

                      {/* 情感标签胶囊 */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-bold ${
                            isBull
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : isBear
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          {isBull ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : isBear ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : null}
                          {item.sentiment_score >= 0 ? '+' : ''}
                          {item.sentiment_score.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(item.published_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'macro' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-800/40 bg-amber-950/10 p-3 flex items-center gap-3 text-xs text-amber-300">
                <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
                <span>
                  宏观风控守护已就绪：重大宏观数据公布前 15 分钟系统将自动收紧开仓杠杆并触发高危风险提示。
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {macroEvents.map((ev) => (
                  <div
                    key={ev.event_id}
                    className={`rounded-lg border p-4 transition ${
                      ev.is_imminent_risk
                        ? 'border-rose-500 bg-rose-950/20 shadow-lg'
                        : 'border-gray-800 bg-[#161b22]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 text-xs font-bold">
                            {ev.country}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {ev.title}
                          </span>
                          {ev.is_imminent_risk && (
                            <span className="rounded bg-rose-900 px-2 py-0.5 text-xs text-rose-200 font-bold animate-pulse">
                              ⚠️ 15分钟高危窗口
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 flex gap-4 pt-1 font-mono">
                          <span>前值: {ev.previous_value || '--'}</span>
                          <span>预测值: {ev.forecast_value || '--'}</span>
                          <span className="text-emerald-400 font-bold">公布值: {ev.actual_value || '待公布'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-gray-400 font-mono">
                          {new Date(ev.event_time).toLocaleString()}
                        </div>
                        <div className="text-xs text-blue-400 font-medium mt-1">
                          影响等级: {ev.impact_level}
                        </div>
                      </div>
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