import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Activity,
  Sliders,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Wallet,
} from 'lucide-react';
import { backtestApi, dataLakeApi } from '../services/api';
import {
  BacktestResultResponse,
  DataLakeStatusResponse,
} from '../types';

interface BacktestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol?: string;
}

export const BacktestModal: React.FC<BacktestModalProps> = ({
  isOpen,
  onClose,
  defaultSymbol = 'BTC-USDT-SWAP',
}) => {
  const [strategyName, setStrategyName] = useState<string>('KELTNER_TREND');
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [timeframe, setTimeframe] = useState('4h');
  const [daysBack, setDaysBack] = useState(1095);
  const [leverage, setLeverage] = useState(3);
  const [atrMultiplier, setAtrMultiplier] = useState(3.0);
  const [breakevenRatio, setBreakevenRatio] = useState(0.5);

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dataLakeStatus, setDataLakeStatus] = useState<DataLakeStatusResponse | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResultResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'dual_engine' | 'overview' | 'trades' | 'datalake'>('dual_engine');

  // 双引擎 Gate 2 验真、60/30/10 资金槽位与实时期现套利状态
  const [slotsData, setSlotsData] = useState<any>(null);
  const [carryScan, setCarryScan] = useState<any>(null);
  const [gate2aResult, setGate2aResult] = useState<any>(null);
  const [gate2bResult, setGate2bResult] = useState<any>(null);
  const [gate2Loading, setGate2Loading] = useState<'idle' | '2a' | '2b' | 'carry'>('idle');
  const [modeSwitching, setModeSwitching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDataLakeStatus();
      loadDualEngineOverview();
    }
  }, [isOpen]);

  const loadDataLakeStatus = async () => {
    try {
      const res = await dataLakeApi.getStatus();
      setDataLakeStatus(res);
    } catch (e) {
      console.error('加载数据湖状态失败', e);
    }
  };

  const loadDualEngineOverview = async () => {
    try {
      const [slots, scan] = await Promise.all([
        backtestApi.getPortfolioSlots().catch(() => null),
        backtestApi.scanCarry().catch(() => null),
      ]);
      if (slots) setSlotsData(slots);
      if (scan) setCarryScan(scan);
    } catch (e) {
      console.error('加载双引擎资金槽位或费率扫描失败', e);
    }
  };

  const handleRunGate2A = async () => {
    try {
      setGate2Loading('2a');
      const res = await backtestApi.runGate2A(1095, 6000, 3);
      setGate2aResult(res);
    } catch (e) {
      alert('Gate 2A 验真失败: ' + (e as Error).message);
    } finally {
      setGate2Loading('idle');
    }
  };

  const handleRunGate2B = async () => {
    try {
      setGate2Loading('2b');
      const res = await backtestApi.runGate2B(3000);
      setGate2bResult(res);
    } catch (e) {
      alert('Gate 2B 验真失败: ' + (e as Error).message);
    } finally {
      setGate2Loading('idle');
    }
  };

  const handleRefreshCarry = async () => {
    try {
      setGate2Loading('carry');
      await loadDualEngineOverview();
    } finally {
      setGate2Loading('idle');
    }
  };

  const handleSwitchCarryMode = async (mode: 'SEMI_AUTO' | 'FULL_AUTO') => {
    try {
      setModeSwitching(true);
      await backtestApi.setCarryMode(mode);
      await loadDualEngineOverview();
    } catch (e) {
      alert('切换引擎 A 执行模式失败: ' + (e as Error).message);
    } finally {
      setModeSwitching(false);
    }
  };

  const handleSyncDataLake = async () => {
    try {
      setSyncing(true);
      await dataLakeApi.sync({
        symbol,
        timeframes: ['4h', '1d'],
        days_back: daysBack,
      });
      await loadDataLakeStatus();
    } catch (e) {
      alert('同步数据湖失败: ' + (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRunBacktest = async () => {
    try {
      setLoading(true);
      const res = await backtestApi.run({
        strategy_name: strategyName,
        symbol,
        timeframe,
        days_back: daysBack,
        leverage,
        atr_sl_multiplier: atrMultiplier,
        breakeven_ratio: breakevenRatio,
      });
      setBacktestResult(res);
      setActiveTab('overview');
    } catch (e) {
      alert('回测运行失败: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative flex h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-gray-800 bg-[#0d1117] shadow-2xl overflow-hidden text-gray-200">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                双引擎同构回测与 Gate 2 验真中枢
                <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-400 border border-emerald-800">
                  BaseStrategy 同构 · 零前瞻
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Top 5 主流币 3 年真实 OKX 数据湖 • 真实 8h 资金费率 • 日频夏普 • ±20% 参数平原门禁
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 主体区 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧单标的回测参数配置区 */}
          <div className="w-80 border-r border-gray-800 bg-[#12161f] p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                单标的同构回测配置
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">三位一体策略类</label>
                <select
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="KELTNER_TREND">KELTNER_TREND (4H 凯尔特纳主臂)</option>
                  <option value="DUAL_EMA_TREND">DUAL_EMA_TREND (1D 双均线主臂)</option>
                  <option value="DONCHIAN_TREND">DONCHIAN_TREND (唐奇安通道趋势)</option>
                  <option value="EMA_BREAKOUT">EMA_BREAKOUT (传统均线对照)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">核心 Top 5 标的</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="BTC-USDT-SWAP">BTC-USDT-SWAP (比特币)</option>
                  <option value="ETH-USDT-SWAP">ETH-USDT-SWAP (以太坊)</option>
                  <option value="SOL-USDT-SWAP">SOL-USDT-SWAP (Solana)</option>
                  <option value="BNB-USDT-SWAP">BNB-USDT-SWAP (BNB)</option>
                  <option value="DOGE-USDT-SWAP">DOGE-USDT-SWAP (狗狗币)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">周期</label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="4h">4h (主趋势)</option>
                    <option value="1d">1d (大波段)</option>
                    <option value="1h">1h (中短线)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">回溯天数</label>
                  <input
                    type="number"
                    value={daysBack}
                    onChange={(e) => setDaysBack(Number(e.target.value))}
                    min={30}
                    max={1825}
                    className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>杠杆上限</span>
                  <span className="text-emerald-400 font-mono">{leverage}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>ATR 吊灯止损倍数</span>
                  <span className="text-emerald-400 font-mono">{atrMultiplier}x</span>
                </div>
                <input
                  type="range"
                  min={1.5}
                  max={4.5}
                  step={0.1}
                  value={atrMultiplier}
                  onChange={(e) => setAtrMultiplier(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>传统策略保本触发 (仅 EMA_BREAKOUT)</span>
                  <span className="text-emerald-400 font-mono">{(breakevenRatio * 100).toFixed(0)}% R</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={0.8}
                  step={0.05}
                  value={breakevenRatio}
                  onChange={(e) => setBreakevenRatio(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSyncDataLake}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 rounded bg-gray-800 hover:bg-gray-700 py-2 text-xs text-gray-300 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? '同步数据湖中...' : '同步该标的 4H/1D 数据湖'}
                </button>
              </div>
            </div>

            <button
              onClick={handleRunBacktest}
              disabled={loading}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold text-white shadow-lg transition"
            >
              <Play className="h-4 w-4" />
              {loading ? '同构回测计算中...' : '运行单标的回测'}
            </button>
          </div>

          {/* 右侧主视窗 */}
          <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">
            {/* 顶栏 Tab */}
            <div className="flex border-b border-gray-800 px-6 bg-[#161b22]/50 gap-6">
              <button
                onClick={() => setActiveTab('dual_engine')}
                className={`py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'dual_engine'
                    ? 'border-cyan-400 text-cyan-400 font-bold'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                🏆 双引擎 Gate 2 验真 & 期现套利
              </button>
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'overview'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                📊 单标的指标与净值
              </button>
              <button
                onClick={() => setActiveTab('trades')}
                className={`py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'trades'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                📝 逐笔流水 ({backtestResult?.trades.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('datalake')}
                className={`py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'datalake'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                💾 数据湖 ({dataLakeStatus?.total_klines.toLocaleString() || 0} 根)
              </button>
            </div>

            {/* 视窗内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === 'dual_engine' && (
                <div className="space-y-6">
                  {/* 1. 60/30/10 组合资金槽位硬隔离全景 */}
                  <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <Wallet className="h-4 w-4 text-cyan-400" />
                        <span>60/30/10 双引擎资金槽位硬隔离</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                          总净值 ${slotsData?.total_equity_usdt ?? 10000} · 底线 ${slotsData?.equity_floor_usdt ?? 8200} (18%)
                        </span>
                      </div>
                      <button
                        onClick={handleRefreshCarry}
                        disabled={gate2Loading === 'carry'}
                        className="text-xs px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center gap-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${gate2Loading === 'carry' ? 'animate-spin' : ''}`} />
                        刷新态势
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {slotsData?.slots &&
                        Object.values(slotsData.slots).map((sl: any) => (
                          <div key={sl.engine_id} className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                            <div className="text-[11px] text-gray-400 truncate">{sl.display_name}</div>
                            <div className="mt-1 flex items-baseline justify-between">
                              <span className="text-base font-bold font-mono text-white">${sl.allocated_usdt}</span>
                              <span className="text-[11px] font-mono text-cyan-400">
                                {(sl.target_weight * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1 font-mono">
                              已用 ${sl.used_margin_usdt} · 可用 ${sl.available_usdt}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* 2. Gate 2A & Gate 2B 一键官方验真卡片 */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Gate 2A: 主引擎 B */}
                    <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            <span>主引擎 B (60%) · Gate 2A 验真</span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            50% 4H 凯尔特纳 + 50% 1D 双均线 · Top 5 三年样本外
                          </div>
                        </div>
                        <button
                          onClick={handleRunGate2A}
                          disabled={gate2Loading !== 'idle'}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white"
                        >
                          {gate2Loading === '2a' ? '验真中...' : '运行 Gate 2A'}
                        </button>
                      </div>

                      {gate2aResult ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between rounded-lg bg-[#0d1117] px-3 py-2 border border-gray-800">
                            <span className="text-gray-400">Gate 2A 7 项硬门槛裁决</span>
                            <span className={`font-bold flex items-center gap-1 ${gate2aResult.passed_gate2a ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {gate2aResult.passed_gate2a ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                              {gate2aResult.passed_gate2a ? '7/7 PASS' : '未通过'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-mono">
                            <div className="rounded bg-[#0d1117] p-2 border border-gray-800/70">
                              <div className="text-[10px] text-gray-500">后2年OOS年化</div>
                              <div className="text-sm font-bold text-emerald-400">+{gate2aResult.oos_2y_ensemble?.cagr_pct}%</div>
                            </div>
                            <div className="rounded bg-[#0d1117] p-2 border border-gray-800/70">
                              <div className="text-[10px] text-gray-500">OOS 夏普 / PF</div>
                              <div className="text-sm font-bold text-cyan-400">
                                {gate2aResult.oos_2y_ensemble?.sharpe_ratio} / {gate2aResult.oos_2y_ensemble?.profit_factor}
                              </div>
                            </div>
                            <div className="rounded bg-[#0d1117] p-2 border border-gray-800/70">
                              <div className="text-[10px] text-gray-500">OOS 最大回撤</div>
                              <div className="text-sm font-bold text-amber-400">-{gate2aResult.oos_2y_ensemble?.max_drawdown_pct}%</div>
                            </div>
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">
                            ±20% 邻域 PF: [{(gate2aResult.neighbor_pfs_pm20pct || []).join(', ')}]
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 py-4 text-center bg-[#0d1117] rounded-lg border border-gray-800/60">
                          点击「运行 Gate 2A」一键验证 3 年历史与后 2 年严格样本外组合表现
                        </div>
                      )}
                    </div>

                    {/* Gate 2B: 底座引擎 A */}
                    <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-cyan-400" />
                            <span>底座引擎 A (30%) · Gate 2B 验真</span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            期现资金费率套利 + 熊市自动休眠切 USDT 活期
                          </div>
                        </div>
                        <button
                          onClick={handleRunGate2B}
                          disabled={gate2Loading !== 'idle'}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white"
                        >
                          {gate2Loading === '2b' ? '验真中...' : '运行 Gate 2B'}
                        </button>
                      </div>

                      {gate2bResult ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between rounded-lg bg-[#0d1117] px-3 py-2 border border-gray-800">
                            <span className="text-gray-400">Gate 2B 5 项硬门槛裁决</span>
                            <span className={`font-bold flex items-center gap-1 ${gate2bResult.passed_gate2b ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {gate2bResult.passed_gate2b ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                              {gate2bResult.passed_gate2b ? '5/5 PASS' : '未通过'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-mono">
                            <div className="rounded bg-[#0d1117] p-2 border border-gray-800/70">
                              <div className="text-[10px] text-gray-500">90天熊市实测APR</div>
                              <div className="text-sm font-bold text-emerald-400">+{gate2bResult.real_90d_backtest?.annualized_apr_pct}%</div>
                            </div>
                            <div className="rounded bg-[#0d1117] p-2 border border-gray-800/70">
                              <div className="text-[10px] text-gray-500">全周期预期APR</div>
                              <div className="text-sm font-bold text-cyan-400">+{gate2bResult.full_cycle_expected_apr_pct}%</div>
                            </div>
                            <div className="rounded bg-[#0d1117] p-2 border border-gray-800/70">
                              <div className="text-[10px] text-gray-500">3年基差最大回撤</div>
                              <div className="text-sm font-bold text-amber-400">-{gate2bResult.real_3y_basis_stress?.worst_basis_mtm_dd_pct}%</div>
                            </div>
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">
                            90天收益/Maker费覆盖比: {gate2bResult.real_90d_backtest?.fee_coverage_ratio}x
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 py-4 text-center bg-[#0d1117] rounded-lg border border-gray-800/60">
                          点击「运行 Gate 2B」一键验证 90 天真实 8h 费率与 3 年期现基差压力测试
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. 底座引擎 A 实时资金费率机会扫描与半自动/全自动切换 */}
                  <div className="rounded-xl border border-gray-800 bg-[#161b22] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>📡 引擎 A 实时期现资金费率雷达 (Top 5)</span>
                          <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                            carryScan?.overall_state === 'ACTIVE_OPPORTUNITY'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-amber-950 text-amber-300 border-amber-700'
                          }`}>
                            {carryScan?.overall_state === 'ACTIVE_OPPORTUNITY'
                              ? '存在套利机会'
                              : '熊市休眠 · 吃 USDT 活期 (~4.5%)'}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          入场门槛: 72h 年化 ≥ 10% 且基差 ≥ -3bps ｜ 退场门槛: 持有满 6 天且 &lt; 2% 或连负 3 期
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#0d1117] p-1 rounded-lg border border-gray-800">
                        <button
                          disabled={modeSwitching}
                          onClick={() => handleSwitchCarryMode('SEMI_AUTO')}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                            (carryScan?.execution_mode || 'SEMI_AUTO') === 'SEMI_AUTO'
                              ? 'bg-cyan-600 text-white'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          半自动推确认
                        </button>
                        <button
                          disabled={modeSwitching}
                          onClick={() => handleSwitchCarryMode('FULL_AUTO')}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                            carryScan?.execution_mode === 'FULL_AUTO'
                              ? 'bg-emerald-600 text-white'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          全自动执行
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#0d1117] text-gray-400 border-b border-gray-800">
                          <tr>
                            <th className="p-2.5">标的</th>
                            <th className="p-2.5">72h 滚动年化</th>
                            <th className="p-2.5">当前费率年化</th>
                            <th className="p-2.5">期现基差</th>
                            <th className="p-2.5">Maker 回本</th>
                            <th className="p-2.5">建议动作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60">
                          {(carryScan?.opportunities || []).map((op: any) => (
                            <tr key={op.swap_symbol} className="hover:bg-gray-800/30">
                              <td className="p-2.5 text-white font-bold">{op.swap_symbol}</td>
                              <td className={`p-2.5 font-bold ${op.rolling_72h_ann_pct >= 10 ? 'text-emerald-400' : op.rolling_72h_ann_pct >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                                {op.rolling_72h_ann_pct >= 0 ? '+' : ''}{op.rolling_72h_ann_pct}%
                              </td>
                              <td className={`p-2.5 ${op.current_ann_pct >= 0 ? 'text-gray-200' : 'text-rose-400'}`}>
                                {op.current_ann_pct >= 0 ? '+' : ''}{op.current_ann_pct}%
                              </td>
                              <td className="p-2.5 text-gray-300">{op.basis_bps >= 0 ? '+' : ''}{op.basis_bps} bps</td>
                              <td className="p-2.5 text-gray-400">{op.est_payback_days >= 900 ? '—' : `${op.est_payback_days} 天`}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[11px] ${
                                  op.recommended_action === 'ENTER_CARRY'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                    : op.recommended_action === 'HOLD_CARRY'
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                                    : 'bg-gray-800 text-gray-400'
                                }`}>
                                  {op.recommended_action}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'overview' && (
                <>
                  {backtestResult ? (
                    <div className="space-y-6">
                      {/* 核心指标卡片矩阵 */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="rounded-lg border border-gray-800 bg-[#161b22] p-4">
                          <div className="text-xs text-gray-400">总收益率</div>
                          <div
                            className={`text-2xl font-bold font-mono mt-1 ${
                              backtestResult.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {backtestResult.total_return_pct >= 0 ? '+' : ''}
                            {backtestResult.total_return_pct}%
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            CAGR 年化: {backtestResult.annualized_return_pct}%
                          </div>
                        </div>

                        <div className="rounded-lg border border-gray-800 bg-[#161b22] p-4">
                          <div className="text-xs text-gray-400">最大回撤 (MaxDD)</div>
                          <div className="text-2xl font-bold font-mono mt-1 text-rose-400">
                            -{backtestResult.max_drawdown_pct}%
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            卡尔玛比率: {backtestResult.calmar_ratio}
                          </div>
                        </div>

                        <div className="rounded-lg border border-gray-800 bg-[#161b22] p-4">
                          <div className="text-xs text-gray-400">日频夏普 (Sharpe)</div>
                          <div className="text-2xl font-bold font-mono mt-1 text-cyan-400">
                            {backtestResult.sharpe_ratio}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            盈利因子 PF: {backtestResult.profit_factor}
                          </div>
                        </div>

                        <div className="rounded-lg border border-gray-800 bg-[#161b22] p-4">
                          <div className="text-xs text-gray-400">胜率 (Win Rate)</div>
                          <div className="text-2xl font-bold font-mono mt-1 text-amber-400">
                            {(backtestResult.win_rate * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {backtestResult.winning_trades}胜 / {backtestResult.losing_trades}负 (共{backtestResult.total_trades}笔)
                          </div>
                        </div>
                      </div>

                      {/* 资金曲线可视化 */}
                      <div className="rounded-lg border border-gray-800 bg-[#161b22] p-5">
                        <div className="flex justify-between items-center mb-4">
                          <div className="text-sm font-semibold text-white">
                            账户资金权益走势曲线 (Equity Curve · {backtestResult.strategy_name})
                          </div>
                          <div className="text-xs text-gray-400">
                            耗时: {backtestResult.execution_time_ms} ms • 累计手续费: {backtestResult.total_fee_paid} USDT
                          </div>
                        </div>
                        <div className="h-60 w-full flex items-end gap-1 bg-[#0d1117] rounded p-4 border border-gray-800/80">
                          {backtestResult.equity_curve.map((pt, idx) => {
                            const minEq = Math.min(...backtestResult.equity_curve.map((p) => p.equity)) * 0.95;
                            const maxEq = Math.max(...backtestResult.equity_curve.map((p) => p.equity)) * 1.05;
                            const span = Math.max(1, maxEq - minEq);
                            const heightPct = Math.max(8, Math.min(100, ((pt.equity - minEq) / span) * 100));
                            return (
                              <div
                                key={idx}
                                className="flex-1 bg-emerald-500/40 hover:bg-emerald-400 transition rounded-t"
                                style={{ height: `${heightPct}%` }}
                                title={`时间: ${new Date(pt.timestamp).toLocaleDateString()} 净值: ${pt.equity}U 回撤: ${pt.drawdown_pct}%`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                      <Sliders className="h-12 w-12 mb-3 text-gray-600" />
                      <p>请在左侧选择同构策略与参数，点击「运行单标的回测」查看表现</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'trades' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#161b22] text-gray-400 border-b border-gray-800">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">方向</th>
                        <th className="p-3">开仓价</th>
                        <th className="p-3">平仓价</th>
                        <th className="p-3">净实现盈亏</th>
                        <th className="p-3">收益率</th>
                        <th className="p-3">平仓原因</th>
                        <th className="p-3">MFE / MAE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 font-mono">
                      {backtestResult?.trades.map((t) => (
                        <tr key={t.trade_id} className="hover:bg-gray-800/30">
                          <td className="p-3 text-gray-500">{t.trade_id}</td>
                          <td className="p-3">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                t.pos_side === 'long'
                                  ? 'bg-emerald-950 text-emerald-400'
                                  : 'bg-rose-950 text-rose-400'
                              }`}
                            >
                              {t.pos_side.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3">{t.entry_price.toFixed(4)}</td>
                          <td className="p-3">{t.exit_price.toFixed(4)}</td>
                          <td className={`p-3 font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.pnl >= 0 ? '+' : ''}
                            {t.pnl} U
                          </td>
                          <td className={`p-3 ${t.roi_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.roi_pct >= 0 ? '+' : ''}
                            {t.roi_pct}%
                          </td>
                          <td className="p-3 text-gray-400">{t.exit_reason}</td>
                          <td className="p-3 text-gray-400">
                            +{t.mfe_pct}% / {t.mae_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'datalake' && (
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-white mb-2">
                    本地历史 K 线存储与时序仓库状态
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {dataLakeStatus?.items.map((it, idx) => (
                      <div key={idx} className="rounded border border-gray-800 bg-[#161b22] p-3">
                        <div className="flex justify-between font-bold text-white">
                          <span>{it.symbol}</span>
                          <span className="text-emerald-400">{it.timeframe}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          记录总数: <span className="font-mono text-gray-200">{it.count.toLocaleString()}</span> 根
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
