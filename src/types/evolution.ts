/**
 * @file evolution.ts
 * @description OKX-Dog 多智能体自适应强化奖励、动态权重门控与 AI 员工档案前端类型契约
 */

export type EmployeeLayer = 'perception' | 'adversarial' | 'arbitration' | 'risk';

export interface AgentEmployee {
  role_id: string;
  name: string;
  nickname: string;
  avatar_icon: string;
  title: string;
  layer: EmployeeLayer;
  weight_percent: number;
  level: number;
  contribution_score: number;
  win_rate_7d: number;
  wins_count: number;
  losses_count: number;
  defended_crises_count: number;
  specialty_description: string;
  recent_achievement?: string;
  learned_rules?: string[];
}

export interface RoleDiagnosisResult {
  role_id: string;
  role_name: string;
  is_underperforming: boolean;
  core_flaw_analysis: string;
  suggested_learned_rules: string[];
  parameter_tuning?: Record<string, any>;
}

export interface TeamDiagnosisReport {
  epoch_id: string;
  diagnosis_time: number;
  team_overall_summary: string;
  market_regime_observation: string;
  role_diagnoses: RoleDiagnosisResult[];
  consensus_improvement_plan: string;
}

export interface InternProfile {
  role_id: string;
  name: string;
  nickname: string;
  avatar_icon: string;
  title: string;
  model_name: string;
  provider: string;
  status: string;
  total_trials: number;
  agreement_rate: number;
  virtual_win_rate_7d: number;
  virtual_wins: number;
  virtual_losses: number;
  virtual_total_pnl_pct: number;
  contract_compliance_rate: number;
  is_promotion_ready: boolean;
  promotion_checklist: Record<string, boolean>;
  recent_feedback?: string;
}

export interface DatasetStats {
  total_samples: number;
  qualified_sft_samples: number;
  refined_samples: number;
  chosen_samples: number;
  rejected_samples: number;
  intern_profile: Partial<InternProfile>;
}

export interface DatasetExportFile {
  name: string;
  type: string;
  count: number;
  download_url: string;
}

export interface DatasetExportResult {
  sft_count: number;
  dpo_count: number;
  refined_count: number;
  files: DatasetExportFile[];
  colab_guide_url: string;
}

export interface TeamEvolutionStatus {
  team_members: AgentEmployee[];
  active_epoch: string;
  total_evolution_rounds: number;
  harness_baseline_status: 'STABLE' | 'TESTING' | 'ROLLED_BACK';
  last_updated_time: number;
  recent_learned_rules: string[];
  intern_profile?: InternProfile;
  latest_diagnosis_report?: TeamDiagnosisReport | null;
}

export interface EvolutionSnapshot {
  epoch_id: string;
  timestamp: number;
  weights: Record<string, number>;
  learned_rules: string[];
  harness_score: number;
  description: string;
}

export interface AgentRewardBreakdown {
  role_id: string;
  role_name: string;
  stance: string;
  confidence: number;
  pnl_contribution: number;
  accuracy_contribution: number;
  risk_defense_bonus: number;
  drawdown_penalty: number;
  total_reward: number;
  achievement_note?: string;
}

export interface MultiAgentRewardOutcome {
  trade_id: string;
  symbol: string;
  realized_pnl: number;
  realized_rr: number;
  direction_correct: boolean;
  breakdowns: AgentRewardBreakdown[];
  summary: string;
}
