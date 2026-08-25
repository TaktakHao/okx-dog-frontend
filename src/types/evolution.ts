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
}

export interface TeamEvolutionStatus {
  team_members: AgentEmployee[];
  active_epoch: string;
  total_evolution_rounds: number;
  harness_baseline_status: 'STABLE' | 'TESTING' | 'ROLLED_BACK';
  last_updated_time: number;
  recent_learned_rules: string[];
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
