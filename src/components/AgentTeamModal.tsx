import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  TrendingUp,
  ShieldAlert,
  Globe,
  Zap,
  Award,
  Link2,
  RefreshCw,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Play,
} from 'lucide-react';
import { evolutionApi } from '../services/api';
import { AgentEmployee, TeamEvolutionStatus } from '../types/evolution';

interface AgentTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentTeamModal: React.FC<AgentTeamModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [teamData, setTeamData] = useState<TeamEvolutionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'employees' | 'rules' | 'history'>('employees');
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTeamStatus();
    }
  }, [isOpen]);

  const loadTeamStatus = async () => {
    try {
      setLoading(true);
      const res = await evolutionApi.getTeamStatus();
      setTeamData(res);
    } catch (e) {
      console.error('加载团队数据失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!confirm('确认回滚到出厂黄金稳定基线？当前临时权重将被重置。')) return;
    try {
      setActionLoading(true);
      const res = await evolutionApi.rollbackToBaseline();
      setTeamData(res);
      setLastMessage('🛡️ 已成功回滚至出厂黄金稳定基线');
      setTimeout(() => setLastMessage(null), 4000);
    } catch (e) {
      alert('回滚失败: ' + (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('确认将所有 AI 员工恢复为出厂初始权重？')) return;
    try {
      setActionLoading(true);
      const res = await evolutionApi.resetTeam();
      setTeamData(res);
      setLastMessage('🔄 已恢复出厂初始均匀权重设置');
      setTimeout(() => setLastMessage(null), 4000);
    } catch (e) {
      alert('重置失败: ' + (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulate = async () => {
    try {
      setActionLoading(true);
      const res = await evolutionApi.simulateReinforcement({
        symbol: 'BTC-USDT-SWAP',
        pos_side: 'LONG',
        entry_price: 96000,
        exit_price: 97800,
        sl_price: 95200,
        realized_pnl: 180,
        mfe_pct: 0.022,
        mae_pct: 0.002,
        is_crisis_defended: true,
      });
      await loadTeamStatus();
      setLastMessage(`🎉 模拟演化结算成功！${res.summary}`);
      setTimeout(() => setLastMessage(null), 5000);
    } catch (e) {
      alert('模拟失败: ' + (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'TrendingUp':
        return <TrendingUp className="h-5 w-5 text-emerald-400" />;
      case 'ShieldAlert':
        return <ShieldAlert className="h-5 w-5 text-rose-400" />;
      case 'Globe':
        return <Globe className="h-5 w-5 text-sky-400" />;
      case 'Link2':
        return <Link2 className="h-5 w-5 text-cyan-400" />;
      case 'Zap':
        return <Zap className="h-5 w-5 text-amber-400" />;
      case 'Award':
        return <Award className="h-5 w-5 text-purple-400" />;
      default:
        return <Users className="h-5 w-5 text-indigo-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-gray-800 bg-[#0d1117] shadow-2xl overflow-hidden text-gray-200">
        
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-[#161b22] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 text-white shadow-md">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  AI 决策员工团队 & 自适应进化看板
                </h2>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  自动升级进化中
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                当前决策层共有 {teamData?.team_members.length || 5} 位专业量化员工，实时根据实战表现动态调整话语权
              </p>
            </div>
          </div>

          {/* 状态与关闭 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSimulate}
              disabled={actionLoading}
              title="模拟一笔盈利单并触发经验值自适应演化"
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30 transition disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              模拟演进对决
            </button>
            <button
              onClick={loadTeamStatus}
              disabled={loading}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition"
              title="刷新员工数据"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 提示消息条 */}
        {lastMessage && (
          <div className="bg-indigo-950/60 border-b border-indigo-800/40 px-6 py-2 text-xs text-indigo-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              {lastMessage}
            </span>
            <button onClick={() => setLastMessage(null)} className="text-indigo-400 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Tab 切换栏 */}
        <div className="flex border-b border-gray-800 px-6 bg-[#161b22]/50 gap-6">
          <button
            onClick={() => setActiveTab('employees')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'employees'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Users className="h-4 w-4" />
            决策层员工花名册 (贡献度 & 话语权)
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'rules'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            今日自主学到的避坑秘籍 ({teamData?.recent_learned_rules.length || 0})
          </button>
        </div>

        {/* 核心内容展示区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'employees' && (
            <>
              {/* 顶部总体概览卡片 */}
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4">
                  <div className="text-xs text-gray-400">当前进化版本号</div>
                  <div className="text-base font-bold text-indigo-300 font-mono mt-1">
                    {teamData?.active_epoch || 'epoch_v1.0'}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">已累计自主演进 {teamData?.total_evolution_rounds || 0} 轮</div>
                </div>

                <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4">
                  <div className="text-xs text-gray-400">防退化安全保护</div>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {teamData?.harness_baseline_status === 'STABLE' ? '平稳运行中' : '安全兜底已激活'}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">500+ 历史极端行情防退化守护</div>
                </div>

                <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4">
                  <div className="text-xs text-gray-400">话语权分配机制</div>
                  <div className="text-base font-bold text-amber-300 mt-1">
                    Softmax 平滑动态赋权
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">10% ~ 40% 防单一专家垄断</div>
                </div>

                <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4 flex flex-col justify-between">
                  <div className="text-xs text-gray-400">安全控制</div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleRollback}
                      disabled={actionLoading}
                      className="flex-1 rounded-lg bg-rose-950/40 border border-rose-800/60 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-900/50 transition flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      一键回滚
                    </button>
                    <button
                      onClick={handleReset}
                      disabled={actionLoading}
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-700 transition"
                    >
                      重置出厂
                    </button>
                  </div>
                </div>
              </div>

              {/* AI 员工卡片列表 (极简通俗呈现) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamData?.team_members.map((emp: AgentEmployee) => {
                  const weight = emp.weight_percent;
                  // 颜色分级
                  const isTop = weight >= 28;
                  return (
                    <div
                      key={emp.role_id}
                      className={`rounded-xl border p-5 flex flex-col justify-between transition hover:border-gray-600 ${
                        isTop
                          ? 'border-indigo-500/50 bg-gradient-to-br from-[#161b22] to-indigo-950/20 shadow-lg'
                          : 'border-gray-800 bg-[#161b22]'
                      }`}
                    >
                      <div>
                        {/* 头部：头像 + 昵称 + 职称 + 等级 */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-gray-800/80 p-2.5 border border-gray-700">
                              {renderIcon(emp.avatar_icon)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-white">
                                  {emp.nickname}
                                </h3>
                                <span className="rounded bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                                  Lv.{emp.level}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {emp.name} • <span className="text-gray-300">{emp.title}</span>
                              </p>
                            </div>
                          </div>

                          {/* 话语权百分比徽章 */}
                          <div className="text-right">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                              决策话语权
                            </div>
                            <div className={`text-xl font-bold font-mono ${isTop ? 'text-indigo-400' : 'text-gray-200'}`}>
                              {weight.toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {/* 话语权进度条 */}
                        <div className="mt-3">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isTop
                                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                  : 'bg-indigo-600/70'
                              }`}
                              style={{ width: `${Math.min(100, (weight / 40) * 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* 通俗战绩与功勋数据 */}
                        <div className="grid grid-cols-3 gap-2 mt-4 bg-gray-900/60 rounded-lg p-2.5 border border-gray-800/60">
                          <div className="text-center">
                            <div className="text-[11px] text-gray-400">近7天胜率</div>
                            <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                              {(emp.win_rate_7d * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div className="text-center border-x border-gray-800">
                            <div className="text-[11px] text-gray-400">带单战绩</div>
                            <div className="text-sm font-bold text-gray-200 font-mono mt-0.5">
                              <span className="text-emerald-400">{emp.wins_count}胜</span> / <span className="text-rose-400">{emp.losses_count}负</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[11px] text-gray-400">排雷避坑</div>
                            <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                              {emp.defended_crises_count} 次
                            </div>
                          </div>
                        </div>

                        {/* 专长说明 */}
                        <p className="text-xs text-gray-300 mt-3 leading-relaxed">
                          💡 <span className="text-gray-400">核心专长:</span> {emp.specialty_description}
                        </p>
                      </div>

                      {/* 最近立功记录 */}
                      {emp.recent_achievement && (
                        <div className="mt-3 pt-3 border-t border-gray-800/60 flex items-center gap-1.5 text-[11px] text-indigo-300">
                          <Award className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                          <span className="truncate">{emp.recent_achievement}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/20 p-4">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  智能体自主学习与前车之鉴知识库
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  系统在每一次平仓或遭遇回踩后，自动由 Harness 沙箱提炼总结出的实战避坑口诀。这些规则会在后续的每次开仓决策前强制动态注入，严防犯同样的错误。
                </p>
              </div>

              <div className="space-y-3">
                {teamData?.recent_learned_rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-800 bg-[#161b22] p-4 flex items-start gap-3 hover:border-indigo-500/40 transition"
                  >
                    <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-2 text-indigo-400 font-mono text-xs font-bold">
                      #{idx + 1}
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-white">
                        {rule}
                      </h5>
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                        <span>🛡️ 已通过 500+ 历史极端行情防退化测试</span>
                        <span>•</span>
                        <span className="text-emerald-400">状态: 全天候生效中</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部说明栏 */}
        <div className="border-t border-gray-800 bg-[#161b22] px-6 py-3 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span>OKX-Dog 多智能体强化奖励网络 • 零金融门槛通俗设计</span>
          </div>
          <span className="font-mono">
            更新时间: {teamData?.last_updated_time ? new Date(teamData.last_updated_time).toLocaleTimeString() : '--'}
          </span>
        </div>

      </div>
    </div>
  );
};
