import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Activity,
  Sliders,
  RefreshCw,
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
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [timeframe, setTimeframe] = useState('1h');
  const [daysBack, setDaysBack] = useState(60);
  const [leverage, setLeverage] = useState(3);
  const [atrMultiplier, setAtrMultiplier] = useState(2.0);
  const [breakevenRatio, setBreakevenRatio] = useState(0.5);

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dataLakeStatus, setDataLakeStatus] = useState<DataLakeStatusResponse | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResultResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'datalake'>('overview');

  useEffect(() => {
    if (isOpen) {
      loadDataLakeStatus();
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

  const handleSyncDataLake = async () => {
    try {
      setSyncing(true);
      await dataLakeApi.sync({
        symbol,
        timeframes: ['15m', '1h', '4h', '1d'],
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
                极速向量化回测沙盒 & 时序数据湖
                <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-400 border border-emerald-800">
                  真实摩擦模型
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                10,000+ K线秒级矩阵回测 • Taker 0.05% • 动态滑点 • 资金费率扣除
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
          {/* 左侧参数配置区 */}
          <div className="w-80 border-r border-gray-800 bg-[#12161f] p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                回测参数配置
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">标的代码</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="BTC-USDT-SWAP">BTC-USDT-SWAP (比特币)</option>
                  <option value="ETH-USDT-SWAP">ETH-USDT-SWAP (以太坊)</option>
                  <option value="SOL-USDT-SWAP">SOL-USDT-SWAP (Solana)</option>
                  <option value="XAU-USDT-SWAP">XAU-USDT-SWAP (黄金永续)</option>
                  <option value="NVDA-USDT-SWAP">NVDA-USDT-SWAP (英伟达)</option>
                  <option value="ONDO-USDT-SWAP">ONDO-USDT-SWAP (RWA龙头)</option>
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
                    <option value="15m">15m (短线)</option>
                    <option value="1h">1h (主波段)</option>
                    <option value="4h">4h (大趋势)</option>
                    <option value="1d">1d (日线)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">回溯天数</label>
                  <input
                    type="number"
                    value={daysBack}
                    onChange={(e) => setDaysBack(Number(e.target.value))}
                    min={7}
                    max={365}
                    className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>杠杆倍数</span>
                  <span className="text-emerald-400 font-mono">{leverage}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>ATR 止损倍数</span>
                  <span className="text-emerald-400 font-mono">{atrMultiplier}x</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={4.0}
                  step={0.1}
                  value={atrMultiplier}
                  onChange={(e) => setAtrMultiplier(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>移动保本触发比例</span>
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
                  {syncing ? '同步数据湖中...' : '同步/更新本地行情数据湖'}
                </button>
              </div>
            </div>

            <button
              onClick={handleRunBacktest}
              disabled={loading}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold text-white shadow-lg transition"
            >
              <Play className="h-4 w-4" />
              {loading ? '回测矩阵计算中...' : '运行向量化回测'}
            </button>
          </div>

          {/* 右侧主视窗 */}
          <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">
            {/* 顶栏 Tab */}
            <div className="flex border-b border-gray-800 px-6 bg-[#161b22]/50 gap-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'overview'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                📊 回测综合指标与资金曲线
              </button>
              <button
                onClick={() => setActiveTab('trades')}
                className={`py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'trades'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                📝 逐笔成交流水 ({backtestResult?.trades.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('datalake')}
                className={`py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'datalake'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                💾 本地数据湖覆盖率 ({dataLakeStatus?.total_klines.toLocaleString() || 0} 根)
              </button>
            </div>

            {/* 视窗内容 */}
            <div className="flex-1 overflow-y-auto p-6">
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
                            年化: {backtestResult.annualized_return_pct}%
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
                          <div className="text-xs text-gray-400">夏普比率 (Sharpe)</div>
                          <div className="text-2xl font-bold font-mono mt-1 text-cyan-400">
                            {backtestResult.sharpe_ratio}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            盈亏比: {backtestResult.profit_factor}
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
                            账户资金权益走势曲线 (Equity Curve)
                          </div>
                          <div className="text-xs text-gray-400">
                            耗时: {backtestResult.execution_time_ms} ms • 包含手续费磨损: {backtestResult.total_fee_paid} USDT
                          </div>
                        </div>
                        {/* 简易 SVG 资金折线图 */}
                        <div className="h-60 w-full flex items-end gap-1 bg-[#0d1117] rounded p-4 border border-gray-800/80">
                          {backtestResult.equity_curve.map((pt, idx) => {
                            const minEq = backtestResult.initial_balance * 0.8;
                            const maxEq = Math.max(...backtestResult.equity_curve.map((p) => p.equity)) * 1.05;
                            const heightPct = Math.max(10, Math.min(100, ((pt.equity - minEq) / (maxEq - minEq)) * 100));
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
                      <p>请在左侧配置参数并点击「运行向量化回测」查看策略表现</p>
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
                        <th className="p-3">实现盈亏</th>
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
                          <td className="p-3">{t.entry_price.toFixed(2)}</td>
                          <td className="p-3">{t.exit_price.toFixed(2)}</td>
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