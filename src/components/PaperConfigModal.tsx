/**
 * @file PaperConfigModal.tsx
 * @description OKX-Dog 模拟操盘沙盒配置与战绩统计弹窗 (Paper Trading Sandbox)
 * 支持自定义初始虚拟资金 (100 ~ 1,000,000 USDT)、查看胜率战绩与一键重置账户
 */

import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  X,
  RefreshCw,
  Coins,
  TrendingUp,
  Award,
  ShieldAlert,
  CheckCircle2,
  Wallet,
  Layers,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { paperApi } from '../services/api';
import { PaperAccountInfo } from '../types';

export const PaperConfigModal: React.FC = () => {
  const {
    isPaperModalOpen,
    closePaperModal,
    paperInitialCapital,
    setPaperInitialCapital,
    setPositions,
  } = useAppStore();

  const [initialAmount, setInitialAmount] = useState<number>(paperInitialCapital || 10000);
  const [accountInfo, setAccountInfo] = useState<PaperAccountInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 打开弹窗时拉取模拟账户统计
  useEffect(() => {
    if (isPaperModalOpen) {
      fetchPaperAccount();
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [isPaperModalOpen]);

  const fetchPaperAccount = async () => {
    setLoading(true);
    try {
      const data = await paperApi.getAccount();
      setAccountInfo(data);
      if (data.initial_equity_usdt) {
        setInitialAmount(data.initial_equity_usdt);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '拉取模拟数据失败';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAccount = async () => {
    if (initialAmount < 100 || initialAmount > 10000000) {
      setErrorMsg('初始资金必须在 100 ~ 10,000,000 USDT 之间');
      return;
    }

    setResetLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updatedInfo = await paperApi.resetAccount(initialAmount);
      setAccountInfo(updatedInfo);
      setPaperInitialCapital(initialAmount);
      setPositions([]);
      setSuccessMsg(`模拟操盘账户已成功重置！初始资金: $${initialAmount.toLocaleString()} USDT`);
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '重置失败';
      setErrorMsg(msg);
    } finally {
      setResetLoading(false);
    }
  };

  if (!isPaperModalOpen) return null;

  const presetAmounts = [1000, 5000, 10000, 50000, 100000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-4">
      <div className="relative w-full max-w-xl rounded-xl border border-bg-border bg-bg-secondary shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 1. 弹窗头部 */}
        <div className="flex items-center justify-between border-b border-bg-border px-5 py-3.5 bg-bg-elevated/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-trade-ai/15 text-trade-ai border border-trade-ai/30">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center space-x-2">
                <span>模拟操盘沙盒配置与战绩</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-trade-up/15 text-trade-up border border-trade-up/30">
                  免 Key 零风险
                </span>
              </h3>
              <p className="text-[11px] text-text-muted">
                基于 OKX 真实公共行情撮合，支持自定义虚拟本金与策略回测验证
              </p>
            </div>
          </div>
          <button
            onClick={closePaperModal}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-border transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. 弹窗主体内容 */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* 战绩指标卡片网格 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 总权益 */}
            <div className="bg-bg-elevated/60 p-3 rounded-lg border border-bg-border flex flex-col justify-between">
              <span className="text-text-muted text-[11px] flex items-center">
                <Wallet className="w-3.5 h-3.5 mr-1 text-trade-ai" />
                当前总权益
              </span>
              <div className="font-mono-num text-base font-bold text-text-primary mt-1">
                ${(accountInfo?.total_equity_usdt || paperInitialCapital || 10000).toLocaleString()}
              </div>
            </div>

            {/* 累计盈亏 */}
            <div className="bg-bg-elevated/60 p-3 rounded-lg border border-bg-border flex flex-col justify-between">
              <span className="text-text-muted text-[11px] flex items-center">
                <TrendingUp className="w-3.5 h-3.5 mr-1 text-trade-up" />
                累计已实现
              </span>
              <div
                className={`font-mono-num text-base font-bold mt-1 ${
                  (accountInfo?.realized_pnl_usdt ?? 0) >= 0 ? 'text-trade-up' : 'text-trade-down'
                }`}
              >
                {(accountInfo?.realized_pnl_usdt ?? 0) >= 0 ? '+' : ''}
                {(accountInfo?.realized_pnl_usdt ?? 0).toFixed(2)}
              </div>
            </div>

            {/* 胜率 */}
            <div className="bg-bg-elevated/60 p-3 rounded-lg border border-bg-border flex flex-col justify-between">
              <span className="text-text-muted text-[11px] flex items-center">
                <Award className="w-3.5 h-3.5 mr-1 text-amber-400" />
                模拟胜率
              </span>
              <div className="font-mono-num text-base font-bold text-amber-400 mt-1">
                {((accountInfo?.win_rate ?? 0) * 100).toFixed(1)}%
              </div>
            </div>

            {/* 成交笔数 */}
            <div className="bg-bg-elevated/60 p-3 rounded-lg border border-bg-border flex flex-col justify-between">
              <span className="text-text-muted text-[11px] flex items-center">
                <Layers className="w-3.5 h-3.5 mr-1 text-text-secondary" />
                平仓笔数
              </span>
              <div className="font-mono-num text-base font-bold text-text-primary mt-1">
                {accountInfo?.winning_trades_count ?? 0} / {accountInfo?.total_trades_count ?? 0}
              </div>
            </div>
          </div>

          {/* 初始虚拟资金配置区域 */}
          <div className="bg-bg-primary/60 p-4 rounded-xl border border-bg-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-primary flex items-center space-x-1.5">
                <Coins className="w-4 h-4 text-trade-ai" />
                <span>配置初始虚拟本金 (USDT)</span>
              </label>
              <span className="text-[11px] text-text-muted font-mono">
                范围: 100 ~ 10,000,000
              </span>
            </div>

            {/* 快捷预设金额选择 */}
            <div className="grid grid-cols-5 gap-1.5">
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setInitialAmount(amt)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium transition-colors border ${
                    initialAmount === amt
                      ? 'bg-trade-ai text-white border-trade-ai shadow-sm'
                      : 'bg-bg-elevated text-text-secondary border-bg-border hover:border-trade-ai/50 hover:text-text-primary'
                  }`}
                >
                  ${amt >= 1000 ? `${amt / 1000}k` : amt}
                </button>
              ))}
            </div>

            {/* 自定义输入框 */}
            <div className="relative mt-2">
              <span className="absolute left-3 top-2.5 text-text-muted font-mono font-bold">$</span>
              <input
                type="number"
                value={initialAmount}
                onChange={(e) => setInitialAmount(parseFloat(e.target.value) || 0)}
                placeholder="输入初始资金金额"
                className="w-full pl-7 pr-16 py-2 rounded-lg bg-bg-elevated border border-bg-border text-text-primary font-mono text-sm focus:outline-none focus:border-trade-ai"
              />
              <span className="absolute right-3 top-2.5 text-text-muted font-mono text-xs">USDT</span>
            </div>

            <p className="text-[11px] text-text-muted leading-relaxed">
              💡 提示：点击「重置模拟账户」将把模拟可用资金设定为该本金，并清空所有模拟持仓与委托挂单，方便您重新开始回测验证 AI 策略。
            </p>
          </div>

          {/* 状态提示 */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-trade-down/15 border border-trade-down/30 text-trade-down text-xs flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-trade-up/15 border border-trade-up/30 text-trade-up text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* 3. 底部操作按钮 */}
        <div className="flex items-center justify-between border-t border-bg-border px-5 py-3.5 bg-bg-elevated/30">
          <button
            type="button"
            onClick={fetchPaperAccount}
            disabled={loading}
            className="flex items-center space-x-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>刷新战绩</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={closePaperModal}
              className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary bg-bg-elevated hover:bg-bg-border transition-colors cursor-pointer"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleResetAccount}
              disabled={resetLoading}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors shadow-md shadow-red-600/20 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resetLoading ? 'animate-spin' : ''}`} />
              <span>{resetLoading ? '正在重置...' : '重置模拟账户与本金'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
