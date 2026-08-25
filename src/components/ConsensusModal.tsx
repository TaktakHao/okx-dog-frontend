import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Send,
  Bot,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Award,
  ShieldAlert,
} from 'lucide-react';
import { consensusApi, telegramApi, riskApi } from '../services/api';
import {
  MultiAgentConsensusResponse,
  TelegramConfig,
  TiltProtectionStatus,
} from '../types';

interface ConsensusModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSymbol?: string;
}

export const ConsensusModal: React.FC<ConsensusModalProps> = ({
  isOpen,
  onClose,
  activeSymbol = 'BTC-USDT-SWAP',
}) => {
  const [activeTab, setActiveTab] = useState<'consensus' | 'telegram'>('consensus');
  const [consensusData, setConsensusData] = useState<MultiAgentConsensusResponse | null>(null);
  const [loadingConsensus, setLoadingConsensus] = useState(false);

  // Telegram 状态
  const [tgConfig, setTgConfig] = useState<TelegramConfig | null>(null);
  const [botTokenInput, setBotTokenInput] = useState('');
  const [chatIdInput, setChatIdInput] = useState('');
  const [tgEnabled, setTgEnabled] = useState(true);
  const [tgSaving, setTgSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // 防上头状态
  const [tiltStatus, setTiltStatus] = useState<TiltProtectionStatus | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConsensus();
      loadTgConfig();
      loadTiltStatus();
    }
  }, [isOpen, activeSymbol]);

  const loadConsensus = async () => {
    try {
      setLoadingConsensus(true);
      const res = await consensusApi.analyze({ symbol: activeSymbol });
      setConsensusData(res);
    } catch (e) {
      console.error('多Agent博弈分析失败', e);
    } finally {
      setLoadingConsensus(false);
    }
  };

  const loadTgConfig = async () => {
    try {
      const res = await telegramApi.getConfig();
      setTgConfig(res);
      setTgEnabled(res.is_enabled);
    } catch (e) {
      console.error('加载TG配置失败', e);
    }
  };

  const loadTiltStatus = async () => {
    try {
      const res = await riskApi.getRiskStatus();
      // 获取扩展的冷静期状态
      setTiltStatus((res as any).tilt_protection || null);
    } catch (e) {
      console.error('获取风控状态失败', e);
    }
  };

  const handleSaveTg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTgSaving(true);
      const res = await telegramApi.saveConfig({
        bot_token: botTokenInput,
        chat_id: chatIdInput,
        is_enabled: tgEnabled,
        is_panic_enabled: true,
      });
      setTgConfig(res);
      alert('Telegram 移动端配置已保存！');
    } catch (e) {
      alert('保存失败: ' + (e as Error).message);
    } finally {
      setTgSaving(false);
    }
  };

  const handleSendTestTg = async () => {
    try {
      setTestSending(true);
      await telegramApi.sendTest('🚀 OKX-Dog v3.0 交易大脑已成功与 Telegram 终端连通！');
      alert('测试通知已发出，请在 Telegram 中查收！');
    } catch (e) {
      alert('发送测试消息失败: ' + (e as Error).message);
    } finally {
      setTestSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-gray-800 bg-[#0d1117] shadow-2xl overflow-hidden text-gray-200">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                多智能体对抗博弈视窗 & 移动端指挥官
                <span className="rounded bg-indigo-950 px-2 py-0.5 text-xs text-indigo-400 border border-indigo-800">
                  四方辩论与仲裁
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                多头专家 vs 空头挑刺 vs 宏观舆情 • 首席量化仲裁 • Telegram 双向协同
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadConsensus}
              disabled={loadingConsensus}
              className="flex items-center gap-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs text-gray-300 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingConsensus ? 'animate-spin' : ''}`} />
              重新辩论
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
            onClick={() => setActiveTab('consensus')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'consensus'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Bot className="h-4 w-4" />
            四大 Agent 对抗博弈辩论视窗
          </button>
          <button
            onClick={() => setActiveTab('telegram')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'telegram'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Send className="h-4 w-4" />
            Telegram 移动端配置与通知测试
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'consensus' && (
            <>
              {/* 交易心理防上头冷静期警示 */}
              {tiltStatus?.is_in_cooldown && (
                <div className="rounded-xl border border-rose-500 bg-rose-950/30 p-4 flex items-center justify-between shadow-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-6 w-6 text-rose-400" />
                    <div>
                      <h4 className="text-sm font-bold text-rose-300">
                        交易心理防上头保护生效中（强制冷静期）
                      </h4>
                      <p className="text-xs text-rose-400/90 mt-0.5">
                        原因: {tiltStatus.reason || '短时间内连续止损触发'} • 剩余冷静时间: {tiltStatus.cooldown_remaining_mins} 分钟（期间禁止新开仓）
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {consensusData ? (
                <div className="space-y-6">
                  {/* 首席仲裁总决断卡片 */}
                  <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/20 p-5 shadow-lg">
                    <div className="flex items-center justify-between border-b border-indigo-800/40 pb-3">
                      <div className="flex items-center gap-3">
                        <Award className="h-6 w-6 text-amber-400" />
                        <div>
                          <h3 className="text-base font-bold text-white">
                            首席量化仲裁官 (Chief Arbiter) 最终决断
                          </h3>
                          <p className="text-xs text-indigo-300 font-mono">
                            标的: {consensusData.symbol} • 仲裁时间: {new Date(consensusData.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {/* 共识分仪表 */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-gray-400">共识得分 (Consensus Score)</div>
                          <div className="text-2xl font-bold font-mono text-amber-400">
                            {consensusData.consensus_score} / 100
                          </div>
                        </div>
                        <span
                          className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                            consensusData.is_approved_to_execute
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                              : 'bg-rose-950 text-rose-400 border border-rose-700'
                          }`}
                        >
                          {consensusData.final_action}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-300 mt-3 leading-relaxed">
                      {consensusData.arbitration_summary}
                    </p>

                    {/* 注入的前车之鉴避坑规则 */}
                    {consensusData.injected_knowledge_rules.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-indigo-800/30 space-y-1">
                        <div className="text-xs font-semibold text-purple-400">
                          🛡️ 本次决策动态召回的前车之鉴避坑规则:
                        </div>
                        {consensusData.injected_knowledge_rules.map((rule, i) => (
                          <div key={i} className="text-xs text-gray-300 bg-gray-900/60 px-3 py-1.5 rounded font-mono">
                            {rule}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 三大 Agent 辩论陈述卡片 */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* 多头辩护专家 */}
                    <div className="rounded-xl border border-emerald-800/40 bg-[#161b22] p-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                          <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4" />
                            🚀 冲锋多头分析师
                          </div>
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                            置信度 {(consensusData.bull_opinion.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-400 mb-1">进攻论据:</div>
                          <ul className="text-xs text-gray-300 space-y-1">
                            {consensusData.bull_opinion.key_arguments.map((arg, i) => (
                              <li key={i}>• {arg}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-800 text-[11px] text-gray-400 flex justify-between">
                        <span>立场: <strong className="text-emerald-400 font-bold">{consensusData.bull_opinion.stance}</strong></span>
                        <span className="text-indigo-300 font-medium">✨ 动态赋权中</span>
                      </div>
                    </div>

                    {/* 空头风控挑刺者 */}
                    <div className="rounded-xl border border-rose-800/40 bg-[#161b22] p-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                          <div className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                            <TrendingDown className="h-4 w-4" />
                            🛡️ 铁血风控挑刺官
                          </div>
                          <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                            置信度 {(consensusData.bear_opinion.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-400 mb-1">排雷挑刺与风险:</div>
                          <ul className="text-xs text-gray-300 space-y-1">
                            {consensusData.bear_opinion.risk_warnings.map((risk, i) => (
                              <li key={i}>• {risk}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-800 text-[11px] text-gray-400 flex justify-between">
                        <span>立场: <strong className="text-rose-400 font-bold">{consensusData.bear_opinion.stance}</strong></span>
                        <span className="text-amber-400 font-medium">🛡️ 防守把关</span>
                      </div>
                    </div>

                    {/* 宏观舆情专家 */}
                    <div className="rounded-xl border border-blue-800/40 bg-[#161b22] p-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                          <div className="text-sm font-bold text-blue-400 flex items-center gap-1.5">
                            <MessageSquare className="h-4 w-4" />
                            🌐 全球资讯情报员
                          </div>
                          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60">
                            置信度 {(consensusData.macro_opinion.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-400 mb-1">大盘态势感知:</div>
                          <ul className="text-xs text-gray-300 space-y-1">
                            {consensusData.macro_opinion.key_arguments.map((arg, i) => (
                              <li key={i}>• {arg}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-800 text-[11px] text-gray-400 flex justify-between">
                        <span>立场: <strong className="text-blue-400 font-bold">{consensusData.macro_opinion.stance}</strong></span>
                        <span className="text-sky-300 font-medium">📡 全天候雷达</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-gray-500">
                  正在召集四大智能体进行多方辩论...
                </div>
              )}
            </>
          )}

          {activeTab === 'telegram' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <form onSubmit={handleSaveTg} className="rounded-xl border border-gray-800 bg-[#161b22] p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Send className="h-5 w-5 text-indigo-400" />
                  Telegram 移动端推送与远程指令配置
                </h3>
                <p className="text-xs text-gray-400">
                  配置您的 Telegram Bot Token 与 Chat ID 即可实现全天候移动端开平仓提醒、移动保本通知及 /report /panic 双向操作。
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Bot Token</label>
                    <input
                      type="text"
                      placeholder={tgConfig?.bot_token_masked || "如: 7123456789:AAHxxxxx"}
                      value={botTokenInput}
                      onChange={(e) => setBotTokenInput(e.target.value)}
                      className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Chat ID</label>
                    <input
                      type="text"
                      placeholder={tgConfig?.chat_id_masked || "如: 123456789"}
                      value={chatIdInput}
                      onChange={(e) => setChatIdInput(e.target.value)}
                      className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="tgEnable"
                      checked={tgEnabled}
                      onChange={(e) => setTgEnabled(e.target.checked)}
                      className="rounded accent-indigo-500"
                    />
                    <label htmlFor="tgEnable" className="text-xs text-gray-300 font-medium">
                      启用 Telegram 实时图文推流
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-800">
                  <button
                    type="submit"
                    disabled={tgSaving}
                    className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white transition"
                  >
                    {tgSaving ? '保存中...' : '保存移动端配置'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendTestTg}
                    disabled={testSending}
                    className="rounded-lg bg-gray-800 hover:bg-gray-700 px-4 py-2.5 text-xs text-gray-300 transition"
                  >
                    {testSending ? '发送中...' : '发送测试通知'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};