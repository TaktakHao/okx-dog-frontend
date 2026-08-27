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
  GraduationCap,
  Download,
  FileJson,
  ExternalLink,
  Cpu,
  Check,
  AlertCircle,
  Stethoscope,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { evolutionApi } from '../services/api';
import { AgentEmployee, TeamEvolutionStatus, DatasetStats, DatasetExportResult, TeamDiagnosisReport } from '../types/evolution';

interface AgentTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentTeamModal: React.FC<AgentTeamModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [teamData, setTeamData] = useState<TeamEvolutionStatus | null>(null);
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [refineFirst, setRefineFirst] = useState(true);
  const [exportResult, setExportResult] = useState<DatasetExportResult | null>(null);
  const [activeTab, setActiveTab] = useState<'employees' | 'intern' | 'rules' | 'diagnosis'>('employees');
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTeamStatus();
      loadDatasetStats();
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

  const loadDatasetStats = async () => {
    try {
      const res = await evolutionApi.getDatasetStats();
      setDatasetStats(res);
    } catch (e) {
      console.error('加载数据集统计失败', e);
    }
  };

  const handleTriggerDiagnosis = async () => {
    try {
      setDiagnosisLoading(true);
      setLastMessage('🧠 正在调用大模型量化总监对 6 位 AI 员工进行失败案例反思诊断与战法重塑...');
      const res = await evolutionApi.triggerDiagnosis();
      setTeamData(res.team_status);
      setActiveTab('diagnosis');
      setLastMessage('🎉 AI 大模型自驱体检与演进完成！已为各专家注入专属避坑口诀并生成新版本快照。');
      setTimeout(() => setLastMessage(null), 6000);
    } catch (e) {
      alert('大模型自驱诊断失败: ' + (e as Error).message);
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const handleExportDataset = async () => {
    try {
      setExportLoading(true);
      setExportResult(null);
      const res = await evolutionApi.exportDataset(refineFirst, 20);
      setExportResult(res);
      setLastMessage(`🎉 数据集导出成功！包含 ${res.sft_count} 条 SFT 样本与 ${res.dpo_count} 组 DPO 偏好对`);
      loadDatasetStats();
    } catch (e) {
      alert('导出数据集失败: ' + (e as Error).message);
    } finally {
      setExportLoading(false);
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

  if (!isOpen) return null;

  const intern = teamData?.intern_profile;
  const diagReport = teamData?.latest_diagnosis_report;

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
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-gray-800 bg-[#0d1117] shadow-2xl overflow-hidden text-gray-200">
        
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-[#161b22] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 text-white shadow-md">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  AI 决策员工团队 & 自驱演进中枢
                </h2>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  大模型自治演进就绪
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                决策层共 {teamData?.team_members.length || 6} 位专家员工 • 每日大模型盘后反思体检与战法自适应迭代
              </p>
            </div>
          </div>

          {/* 右侧操作按钮 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTriggerDiagnosis}
              disabled={diagnosisLoading}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Stethoscope className={`h-4 w-4 ${diagnosisLoading ? 'animate-spin' : ''}`} />
              {diagnosisLoading ? '大模型诊断中...' : '🤖 AI 自驱体检与演进'}
            </button>
            <button
              onClick={() => { loadTeamStatus(); loadDatasetStats(); }}
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
          <div className="bg-indigo-950/60 border-b border-indigo-800/40 px-6 py-2 text-xs text-indigo-300 flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400 flex-shrink-0" />
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
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Users className="h-4 w-4" />
            决策层员工花名册 (6专家话语权)
          </button>
          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'diagnosis'
                ? 'border-purple-500 text-purple-400 font-bold'
                : 'border-transparent text-gray-400 hover:text-purple-300'
            }`}
          >
            <Stethoscope className="h-4 w-4 text-purple-400" />
            📋 大模型诊断反思报告 {diagReport ? '(最新)' : ''}
          </button>
          <button
            onClick={() => setActiveTab('intern')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'intern'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-gray-400 hover:text-indigo-300'
            }`}
          >
            <GraduationCap className="h-4 w-4 text-indigo-400" />
            🐣 实习生微调与数据中心
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'rules'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            自主避坑秘籍 ({teamData?.recent_learned_rules.length || 0})
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
                  <div className="text-xs text-gray-400">大模型反思驱动</div>
                  <div className="text-base font-bold text-purple-400 flex items-center gap-1.5 mt-1">
                    <Sparkles className="h-4 w-4" />
                    AI 投资总监在线
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">每日盘后自动问诊低胜率角色</div>
                </div>

                <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4">
                  <div className="text-xs text-gray-400">防退化安全保护</div>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {teamData?.harness_baseline_status === 'STABLE' ? '平稳运行中' : '安全兜底已激活'}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">500+ 历史行情防退化守护</div>
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

              {/* AI 员工卡片列表 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamData?.team_members.map((emp: AgentEmployee) => {
                  const weight = emp.weight_percent;
                  const isTop = weight >= 25;
                  const learnedRules = emp.learned_rules || [];
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

                          <div className="text-right">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                              决策话语权
                            </div>
                            <div className={`text-xl font-bold font-mono ${isTop ? 'text-indigo-400' : 'text-gray-200'}`}>
                              {weight.toFixed(1)}%
                            </div>
                          </div>
                        </div>

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

                        <div className="grid grid-cols-3 gap-2 mt-4 bg-gray-900/60 rounded-lg p-2.5 border border-gray-800/60">
                          <div className="text-center">
                            <div className="text-[11px] text-gray-400">近7天胜率</div>
                            <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                              {((emp.win_rate_7d > 1 ? emp.win_rate_7d : emp.win_rate_7d * 100)).toFixed(0)}%
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

                        <p className="text-xs text-gray-300 mt-3 leading-relaxed">
                          💡 <span className="text-gray-400">核心专长:</span> {emp.specialty_description}
                        </p>

                        {/* 角色专属避坑口诀标签 */}
                        {learnedRules.length > 0 && (
                          <div className="mt-3 bg-purple-950/30 border border-purple-800/40 rounded-lg p-2.5 space-y-1.5">
                            <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                              <BookOpen className="h-3 w-3 text-purple-400" />
                              大模型注入的专属战法口诀:
                            </div>
                            {learnedRules.map((rule, rIdx) => (
                              <div key={rIdx} className="text-[11px] text-purple-200/90 leading-tight flex items-start gap-1">
                                <span className="text-purple-400 font-mono">▸</span>
                                <span>{rule}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

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

          {/* 大模型诊断反思报告 Tab */}
          {activeTab === 'diagnosis' && (
            <div className="space-y-6">
              {diagReport ? (
                <>
                  {/* 整体宏观与协同诊断 */}
                  <div className="rounded-2xl border border-purple-800/40 bg-gradient-to-br from-[#161b22] to-purple-950/20 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-5 w-5 text-purple-400" />
                        <h3 className="text-base font-bold text-white">
                          大模型量化投资总监诊断长文 ({diagReport.epoch_id})
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-gray-400">
                        诊断时间: {new Date(diagReport.diagnosis_time).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="bg-[#0d1117]/80 rounded-xl p-4 border border-gray-800">
                        <div className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-indigo-400" />
                          团队协同运行评估:
                        </div>
                        <p className="text-gray-300 leading-relaxed">{diagReport.team_overall_summary}</p>
                      </div>

                      <div className="bg-[#0d1117]/80 rounded-xl p-4 border border-gray-800">
                        <div className="font-bold text-sky-300 mb-1 flex items-center gap-1.5">
                          <Globe className="h-4 w-4 text-sky-400" />
                          盘面与宏观环境观察:
                        </div>
                        <p className="text-gray-300 leading-relaxed">{diagReport.market_regime_observation}</p>
                      </div>
                    </div>

                    <div className="bg-[#0d1117]/80 rounded-xl p-4 border border-purple-900/40 text-xs">
                      <div className="font-bold text-purple-300 mb-1 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        下阶段共识决策与风控改进方案:
                      </div>
                      <p className="text-gray-300 leading-relaxed">{diagReport.consensus_improvement_plan}</p>
                    </div>
                  </div>

                  {/* 6 位专家的独立问诊与战法重塑 */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-indigo-400" />
                      专家个体失误剖析与战法重塑详情
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {diagReport.role_diagnoses.map((rd) => (
                        <div
                          key={rd.role_id}
                          className={`rounded-xl border p-4 text-xs space-y-3 ${
                            rd.is_underperforming
                              ? 'border-amber-500/40 bg-amber-950/10'
                              : 'border-gray-800 bg-[#161b22]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm flex items-center gap-1.5">
                              {rd.role_name}
                              <span className="text-[10px] text-gray-400 font-mono">({rd.role_id})</span>
                            </span>
                            {rd.is_underperforming ? (
                              <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
                                ⚠️ 重点问诊调优
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold">
                                ✅ 状态平稳
                              </span>
                            )}
                          </div>

                          <div className="bg-[#0d1117] rounded-lg p-2.5 border border-gray-800/80">
                            <div className="text-[11px] text-gray-400 mb-1">🔍 盲点与病理剖析:</div>
                            <p className="text-gray-300 leading-relaxed">{rd.core_flaw_analysis}</p>
                          </div>

                          {rd.suggested_learned_rules.length > 0 && (
                            <div className="bg-purple-950/30 rounded-lg p-2.5 border border-purple-800/30">
                              <div className="text-[11px] text-purple-300 font-bold mb-1 flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-purple-400" />
                                本轮新注入的专属避坑口诀:
                              </div>
                              <ul className="space-y-1">
                                {rd.suggested_learned_rules.map((rule, idx) => (
                                  <li key={idx} className="text-purple-200 text-[11px] flex items-start gap-1">
                                    <span className="text-purple-400">✓</span>
                                    <span>{rule}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {rd.parameter_tuning && (
                            <div className="text-[10px] text-gray-400 bg-gray-900/60 rounded px-2 py-1 font-mono">
                              ⚙️ 建议因子微调: {JSON.stringify(rd.parameter_tuning)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-gray-800 bg-[#161b22] p-12 text-center space-y-4">
                  <Stethoscope className="h-12 w-12 text-purple-400 mx-auto opacity-60" />
                  <div>
                    <h4 className="text-base font-bold text-white">暂未生成大模型自驱诊断报告</h4>
                    <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                      系统会在每日盘后自动反思体检，您也可以随时点击右上角的<strong>【🤖 AI 自驱体检与演进】</strong>按钮，立即调用大模型为团队 6 位专家进行深度问诊！
                    </p>
                  </div>
                  <button
                    onClick={handleTriggerDiagnosis}
                    disabled={diagnosisLoading}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-purple-500 transition"
                  >
                    立即进行一次 AI 团队全身体检
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'intern' && (
            <div className="space-y-6">
              {/* 实习生档案卡片 */}
              {(() => {
                const isNotConfigured = !intern?.status || intern?.status === 'NOT_CONFIGURED';
                const isIdle = intern?.status === 'CONNECTED_IDLE';
                const isPromoted = intern?.status === 'PROMOTED' || intern?.status === 'PROMOTION_READY';

                let badgeText = '🎓 双轨影子带训中';
                let badgeClass = 'bg-purple-500/20 border-purple-500/40 text-purple-300';
                if (isNotConfigured) {
                  badgeText = '💤 插槽待激活 (未部署)';
                  badgeClass = 'bg-gray-800 border-gray-700 text-gray-400';
                } else if (isIdle) {
                  badgeText = '⚡ 已连接就绪 (等待信号)';
                  badgeClass = 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300';
                } else if (isPromoted) {
                  badgeText = '👑 具备正式员工实力';
                  badgeClass = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
                }

                return (
                  <div className="rounded-2xl border border-purple-800/40 bg-gradient-to-br from-[#161b22] to-purple-950/20 p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="rounded-2xl bg-purple-600/20 border border-purple-500/40 p-3 text-purple-300 text-2xl shadow-inner">
                          {intern?.avatar_icon || '🐣'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">
                              {intern?.nickname || '量化实习生模型'}
                            </h3>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badgeClass}`}>
                              {badgeText}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            当前挂载模型: <strong className="text-indigo-300 font-mono">{intern?.model_name || 'deepseek-r1:8b (本地/Colab)'}</strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-3 text-center">
                        <div className="text-[11px] text-gray-400">影子试炼次数</div>
                        <div className="text-base font-bold text-white font-mono mt-0.5">{intern?.total_trials || 0} 次</div>
                      </div>
                      <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-3 text-center">
                        <div className="text-[11px] text-gray-400">与冠军共识一致率</div>
                        <div className="text-base font-bold text-purple-400 font-mono mt-0.5">{((intern?.agreement_rate || 0) * 100).toFixed(0)}%</div>
                      </div>
                      <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-3 text-center">
                        <div className="text-[11px] text-gray-400">虚拟7日胜率</div>
                        <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">{((intern?.virtual_win_rate_7d || 0) * 100).toFixed(0)}%</div>
                      </div>
                      <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-3 text-center">
                        <div className="text-[11px] text-gray-400">契约Schema合规率</div>
                        <div className="text-base font-bold text-cyan-400 font-mono mt-0.5">{((intern?.contract_compliance_rate || 0) * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 数据沉淀与一键导出 Colab 训练集面板 */}
              <div className="rounded-2xl border border-gray-800 bg-[#161b22] p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Download className="h-5 w-5 text-indigo-400" />
                      Google Colab 训练集一键沉淀与导出中枢
                    </h4>
                    <p className="text-xs text-gray-400 mt-1">
                      系统自动捕获多周期技术指标快照、6 专家论证与真实盘口收益，提供高质量 SFT 与 DPO 格式一键导出
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-gray-400">已沉淀样本: <strong className="text-white">{datasetStats?.total_samples || 0}</strong></span>
                    <span className="text-gray-400">SFT 黄金样本: <strong className="text-emerald-400">{datasetStats?.qualified_sft_samples || 0}</strong></span>
                    <span className="text-gray-400">DPO 偏好对: <strong className="text-purple-400">{Math.min(datasetStats?.chosen_samples || 0, datasetStats?.rejected_samples || 0)}</strong></span>
                  </div>
                </div>

                {/* 导出操作栏 */}
                <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={refineFirst}
                        onChange={(e) => setRefineFirst(e.target.checked)}
                        className="rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-0"
                      />
                      <span>先调用大模型进行<strong>高密度思考链精简提炼</strong> (<code className="text-indigo-300 text-[10px]">--refine-first</code>)</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <a
                      href="https://colab.research.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 transition flex items-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      打开 Google Colab
                    </a>
                    <button
                      onClick={handleExportDataset}
                      disabled={exportLoading}
                      className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:from-indigo-500 hover:to-purple-500 transition flex items-center gap-2"
                    >
                      <Download className={`h-4 w-4 ${exportLoading ? 'animate-bounce' : ''}`} />
                      {exportLoading ? '正在提炼与导出中...' : '🚀 一键生成并导出训练集'}
                    </button>
                  </div>
                </div>

                {/* 导出结果与下载区 */}
                {exportResult && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        数据集导出成功！请直接点击下方文件下载并上传至 Colab：
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {exportResult.files.map((file) => (
                        <div
                          key={file.name}
                          className="rounded-lg border border-gray-800 bg-[#161b22] p-3 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <FileJson className="h-5 w-5 text-indigo-400" />
                            <div>
                              <div className="text-xs font-bold text-white font-mono">{file.name}</div>
                              <div className="text-[10px] text-gray-400">{file.type} • 共 {file.count} 条</div>
                            </div>
                          </div>

                          <a
                            href={file.download_url}
                            download={file.name}
                            className="rounded bg-indigo-600/30 border border-indigo-500/40 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600 hover:text-white transition flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            下载
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/20 p-4">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  智能体自主学习与全局前车之鉴知识库
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  系统在每一次平仓、复盘或大模型反思问诊后，自动总结沉淀出的通用避坑口诀。这些规则会在后续的决策前强制动态注入，严防重复犯错。
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
                        <span>🛡️ 已通过历史极端行情防退化守护</span>
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
            <span>OKX-Dog 量化智能体大模型自驱演进系统 • 零金融门槛全景自治</span>
          </div>
          <span className="font-mono">
            更新时间: {teamData?.last_updated_time ? new Date(teamData.last_updated_time).toLocaleTimeString() : '--'}
          </span>
        </div>

      </div>
    </div>
  );
};
