/**
 * @file SecurityModal.tsx
 * @description OKX-Dog 安全与凭证管理中枢 (Security Vault & Model Hub)
 * 支持 OKX API 凭证管理 (AES-256 加密/提现权限物理强阻断/连通性与权限探测)
 * 支持大模型 (OpenAI 标准) 接入配置 (Base URL / 脱敏 Key / 模型切换 / 连通性测试)
 * 支持硬风控安全锁规则配置 (单笔限额/单日熔断/杠杆上限/滑点保护)
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Bot,
  Sliders,
  Eye,
  EyeOff,
  Zap,
  Trash2,
  Server,
  RefreshCw,
  Cpu,
  ShieldCheck,
  Globe,
  Radio,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { vaultApi, riskApi } from '../services/api';
import { LLMConfig, TestConnectionResponse, TestLLMResponse } from '../types';

export const SecurityModal: React.FC = () => {
  const {
    isSecurityModalOpen,
    closeSecurityModal,
    securityModalTab,
    setSecurityModalTab,
    isLiveMode,
    apiKeyMasked,
    permissions,
    setCredentialsInfo,
    clearCredentials,
    llmConfig,
    setLLMConfig,
    riskRules,
    setRiskRules,
    riskStatus,
    resetRiskLock,
  } = useAppStore();

  // Tab 切换状态
  const [activeTab, setActiveTab] = useState<'okx' | 'llm' | 'risk'>('okx');

  // =========================================================================
  // 1. OKX 凭证表单状态
  // =========================================================================
  const [okxMasterPassword, setOkxMasterPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [targetLiveMode, setTargetLiveMode] = useState(isLiveMode);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  const [okxLoading, setOkxLoading] = useState(false);
  const [okxTestLoading, setOkxTestLoading] = useState(false);
  const [okxClearLoading, setOkxClearLoading] = useState(false);
  const [okxErrorMsg, setOkxErrorMsg] = useState<string | null>(null);
  const [okxSuccessMsg, setOkxSuccessMsg] = useState<string | null>(null);
  const [okxTestResult, setOkxTestResult] = useState<TestConnectionResponse | null>(null);

  // =========================================================================
  // 2. 大模型 (LLM) 表单状态
  // =========================================================================
  const [llmProvider, setLlmProvider] = useState<'deepseek' | 'openai' | 'anthropic' | 'custom'>('deepseek');
  const [llmBaseUrl, setLlmBaseUrl] = useState('https://api.deepseek.com');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [llmModel, setLlmModel] = useState('deepseek-reasoner');
  const [llmTemperature, setLlmTemperature] = useState(0.2);
  const [llmMaxTokens, setLlmMaxTokens] = useState(4096);
  const [llmMasterPassword, setLlmMasterPassword] = useState('');

  const [llmLoading, setLlmLoading] = useState(false);
  const [llmTestLoading, setLlmTestLoading] = useState(false);
  const [llmClearLoading, setLlmClearLoading] = useState(false);
  const [llmErrorMsg, setLlmErrorMsg] = useState<string | null>(null);
  const [llmSuccessMsg, setLlmSuccessMsg] = useState<string | null>(null);
  const [llmTestResult, setLlmTestResult] = useState<TestLLMResponse | null>(null);

  // =========================================================================
  // 3. 硬风控规则表单状态
  // =========================================================================
  const [maxOrderUsdt, setMaxOrderUsdt] = useState(riskRules.max_order_usdt || 500);
  const [maxDailyLossUsdt, setMaxDailyLossUsdt] = useState(riskRules.max_daily_loss_usdt || 200);
  const [maxLeverage, setMaxLeverage] = useState(riskRules.max_leverage || 5);
  const [maxSlippagePct, setMaxSlippagePct] = useState(riskRules.max_slippage_pct || 0.5);
  const [maxOpenPositions, setMaxOpenPositions] = useState(riskRules.max_open_positions || 3);
  const [maxPositionUsdt, setMaxPositionUsdt] = useState(riskRules.max_position_usdt || 2000);

  const [riskLoading, setRiskLoading] = useState(false);
  const [riskSuccessMsg, setRiskSuccessMsg] = useState<string | null>(null);
  const [riskErrorMsg, setRiskErrorMsg] = useState<string | null>(null);

  // 同步外部传入的 tab
  useEffect(() => {
    if (securityModalTab) {
      setActiveTab(securityModalTab);
    }
  }, [securityModalTab]);

  // 打开弹窗时，拉取后端最新的脱敏状态与大模型配置
  useEffect(() => {
    if (isSecurityModalOpen) {
      // 1. 拉取 OKX 状态
      vaultApi
        .getCredentialsStatus()
        .then((res) => {
          if (res.has_configured_okx) {
            setCredentialsInfo({
              apiKeyMasked: res.api_key_masked || '****',
              isLiveMode: res.is_live_mode,
              permissions: res.permissions || ['read', 'trade'],
            });
            setTargetLiveMode(res.is_live_mode);
          }
        })
        .catch(() => {});

      // 2. 拉取大模型配置
      vaultApi
        .getLLMConfig()
        .then((res) => {
          if (res) {
            setLlmProvider(res.llm_provider || 'deepseek');
            setLlmBaseUrl(res.llm_base_url || 'https://api.deepseek.com');
            setLlmModel(res.llm_model || 'deepseek-reasoner');
            setLlmTemperature(res.llm_temperature ?? 0.2);
            setLlmMaxTokens(res.llm_max_tokens ?? 4096);
            setLLMConfig(res);
          }
        })
        .catch(() => {});

      // 3. 拉取风控规则
      riskApi
        .getRiskStatus()
        .then((res) => {
          if (res?.rules) {
            setMaxOrderUsdt(res.rules.max_order_usdt);
            setMaxDailyLossUsdt(res.rules.max_daily_loss_usdt);
            setMaxLeverage(res.rules.max_leverage);
            setMaxSlippagePct(res.rules.max_slippage_pct);
            setMaxOpenPositions(res.rules.max_open_positions);
            setMaxPositionUsdt(res.rules.max_position_usdt);
          }
        })
        .catch(() => {});
    }
  }, [isSecurityModalOpen, setCredentialsInfo, setLLMConfig]);

  if (!isSecurityModalOpen) return null;

  // =========================================================================
  // 厂商快捷预设 (LLM Presets)
  // =========================================================================
  const applyLLMPreset = (preset: 'deepseek' | 'openai' | 'anthropic' | 'qwen' | 'ollama' | 'custom') => {
    switch (preset) {
      case 'deepseek':
        setLlmProvider('deepseek');
        setLlmBaseUrl('https://api.deepseek.com');
        setLlmModel('deepseek-reasoner');
        setLlmTemperature(0.2);
        setLlmMaxTokens(4096);
        break;
      case 'openai':
        setLlmProvider('openai');
        setLlmBaseUrl('https://api.openai.com/v1');
        setLlmModel('gpt-4o');
        setLlmTemperature(0.2);
        setLlmMaxTokens(4096);
        break;
      case 'anthropic':
        setLlmProvider('anthropic');
        setLlmBaseUrl('https://api.anthropic.com/v1');
        setLlmModel('claude-3-5-sonnet-20241022');
        setLlmTemperature(0.2);
        setLlmMaxTokens(4096);
        break;
      case 'qwen':
        setLlmProvider('custom');
        setLlmBaseUrl('https://dashscope.aliyuncs.com/compatible-mode/v1');
        setLlmModel('qwen-max');
        setLlmTemperature(0.2);
        setLlmMaxTokens(4096);
        break;
      case 'ollama':
        setLlmProvider('custom');
        setLlmBaseUrl('http://localhost:11434/v1');
        setLlmModel('deepseek-r1:8b');
        setLlmTemperature(0.2);
        setLlmMaxTokens(4096);
        break;
      case 'custom':
        setLlmProvider('custom');
        break;
    }
  };

  // =========================================================================
  // OKX 凭证保存与测试
  // =========================================================================
  const handleSaveOkx = async (e: React.FormEvent) => {
    e.preventDefault();
    setOkxErrorMsg(null);
    setOkxSuccessMsg(null);

    if (!apiKey || !secretKey || !passphrase) {
      setOkxErrorMsg('请填写完整的 OKX API Key, Secret Key 与 Passphrase');
      return;
    }

    setOkxLoading(true);
    try {
      const data = await vaultApi.saveCredentials({
        master_password: okxMasterPassword || 'OKXDog_Master_2026',
        api_key: apiKey,
        secret_key: secretKey,
        passphrase: passphrase,
        is_live_mode: targetLiveMode,
      });

      if (data.has_withdraw_permission) {
        throw new Error('【严重安全违规】检测到此 API Key 开启了提现权限！系统强制阻断连接以防资产风险。');
      }

      setOkxSuccessMsg('OKX 凭证已通过 AES-256-GCM 本地加密保存！');
      setCredentialsInfo({
        apiKeyMasked: data.api_key_masked || `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`,
        isLiveMode: targetLiveMode,
        permissions: data.permissions || ['read', 'trade'],
      });
      setApiKey('');
      setSecretKey('');
      setPassphrase('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败，请检查网络或格式';
      setOkxErrorMsg(msg);
    } finally {
      setOkxLoading(false);
    }
  };

  const handleTestOkxConnection = async () => {
    setOkxTestLoading(true);
    setOkxErrorMsg(null);
    setOkxTestResult(null);
    try {
      const res = await vaultApi.testConnection({
        master_password: okxMasterPassword || 'OKXDog_Master_2026',
        is_live_mode: targetLiveMode,
      });
      setOkxTestResult(res);
      if (res.connected) {
        setOkxSuccessMsg(`OKX 连通成功！延迟: ${res.latency_ms}ms, 权限: ${res.permissions.join(', ')}`);
      } else {
        setOkxErrorMsg(res.security_warning || '连通性测试未通过');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '测试异常';
      setOkxErrorMsg(msg);
    } finally {
      setOkxTestLoading(false);
    }
  };

  const handleClearOkxCredentials = async () => {
    if (!window.confirm(`确定要安全清除当前【${targetLiveMode ? '实盘' : '模拟盘'}】的 OKX API 凭证吗？`)) {
      return;
    }
    setOkxClearLoading(true);
    try {
      await vaultApi.clearCredentials(targetLiveMode);
      clearCredentials();
      setOkxSuccessMsg('已成功清除本地加密凭证');
      setOkxTestResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '清除失败';
      setOkxErrorMsg(msg);
    } finally {
      setOkxClearLoading(false);
    }
  };

  // =========================================================================
  // 大模型 (LLM) 保存与测试
  // =========================================================================
  const handleSaveLLM = async (e: React.FormEvent) => {
    e.preventDefault();
    setLlmErrorMsg(null);
    setLlmSuccessMsg(null);

    setLlmLoading(true);
    try {
      const payload: LLMConfig = {
        llm_provider: llmProvider,
        llm_base_url: llmBaseUrl.trim(),
        llm_model: llmModel.trim(),
        llm_temperature: Number(llmTemperature),
        llm_max_tokens: Number(llmMaxTokens),
        master_password: llmMasterPassword || 'OKXDog_Master_2026',
      };
      if (llmApiKey && llmApiKey.trim()) {
        payload.llm_api_key = llmApiKey.trim();
      }

      const res = await vaultApi.saveLLMConfig(payload);
      setLLMConfig(res);
      setLlmSuccessMsg('大模型配置已安全保存！API Key 已通过 AES-256 加密落库。');
      setLlmApiKey('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '大模型配置保存失败';
      setLlmErrorMsg(msg);
    } finally {
      setLlmLoading(false);
    }
  };

  const handleTestLLMConnection = async () => {
    setLlmTestLoading(true);
    setLlmErrorMsg(null);
    setLlmTestResult(null);
    try {
      const res = await vaultApi.testLLMConnection({
        master_password: llmMasterPassword || 'OKXDog_Master_2026',
        llm_provider: llmProvider,
        llm_base_url: llmBaseUrl.trim(),
        llm_model: llmModel.trim(),
        llm_api_key: llmApiKey.trim() || undefined,
      });
      setLlmTestResult(res);
      if (res.connected) {
        setLlmSuccessMsg(`大模型 API 测试成功！耗时: ${res.latency_ms}ms, 响应: ${res.message || 'OK'}`);
      } else {
        setLlmErrorMsg(res.message || '大模型连通性测试失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '网络请求失败';
      setLlmErrorMsg(msg);
    } finally {
      setLlmTestLoading(false);
    }
  };

  const handleClearLLMKey = async () => {
    if (!window.confirm('确定要清除已加密保存的大模型 API Key 吗？')) {
      return;
    }
    setLlmClearLoading(true);
    try {
      await vaultApi.clearLLMConfig();
      if (llmConfig) {
        setLLMConfig({ ...llmConfig, llm_api_key_masked: null });
      }
      setLlmSuccessMsg('大模型 API Key 已安全清除');
      setLlmTestResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '清除失败';
      setLlmErrorMsg(msg);
    } finally {
      setLlmClearLoading(false);
    }
  };

  // =========================================================================
  // 硬风控规则保存与熔断重置
  // =========================================================================
  const handleSaveRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    setRiskErrorMsg(null);
    setRiskSuccessMsg(null);

    setRiskLoading(true);
    try {
      const updated = await riskApi.updateRiskConfig({
        max_order_usdt: Number(maxOrderUsdt),
        max_daily_loss_usdt: Number(maxDailyLossUsdt),
        max_leverage: Number(maxLeverage),
        max_slippage_pct: Number(maxSlippagePct),
        max_open_positions: Number(maxOpenPositions),
        max_position_usdt: Number(maxPositionUsdt),
      });
      setRiskRules(updated);
      setRiskSuccessMsg('硬风控参数已成功更新并生效！');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '风控规则更新失败';
      setRiskErrorMsg(msg);
    } finally {
      setRiskLoading(false);
    }
  };

  const handleResetCircuit = async () => {
    try {
      await riskApi.resetCircuitBreaker('OKXDog_Master_2026', '交易员在控制台中主动解除');
      resetRiskLock();
      setRiskSuccessMsg('熔断状态已解除，系统恢复正常交易');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '解除熔断失败';
      setRiskErrorMsg(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-bg-border bg-bg-secondary p-6 shadow-2xl shadow-black/60 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-bg-border shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-trade-ai/15 text-trade-ai ring-1 ring-trade-ai/30 shadow-inner">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                系统安全与凭证管理中枢
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-trade-up/10 text-trade-up border border-trade-up/30 font-mono font-medium">
                  AES-256-GCM 密盒
                </span>
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                密钥本地加密存储 · 页面严格脱敏不显明文 · 物理隔离提现权限
              </p>
            </div>
          </div>
          <button
            onClick={closeSecurityModal}
            className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 mt-4 p-1 rounded-xl bg-bg-primary border border-bg-border shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('okx');
              setSecurityModalTab('okx');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'okx'
                ? 'bg-bg-elevated text-text-primary shadow-sm border border-bg-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-trade-up" />
            <span>OKX API 凭证</span>
            {apiKeyMasked && (
              <span className="w-2 h-2 rounded-full bg-trade-up animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('llm');
              setSecurityModalTab('llm');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'llm'
                ? 'bg-bg-elevated text-text-primary shadow-sm border border-bg-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-trade-ai" />
            <span>大模型 (AI) 接入</span>
            {llmConfig?.llm_api_key_masked && (
              <span className="w-2 h-2 rounded-full bg-trade-ai animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('risk');
              setSecurityModalTab('risk');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'risk'
                ? 'bg-bg-elevated text-text-primary shadow-sm border border-bg-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-trade-warning" />
            <span>硬风控安全锁</span>
            {riskStatus !== 'NORMAL' && (
              <span className="w-2 h-2 rounded-full bg-trade-down animate-ping" />
            )}
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 mt-4 space-y-4 text-xs">
          {/* ========================================================================= */}
          {/* TAB 1: OKX API 凭证管理 */}
          {/* ========================================================================= */}
          {activeTab === 'okx' && (
            <div className="space-y-4">
              {/* Status Card */}
              <div className="p-3.5 rounded-xl bg-bg-primary border border-bg-border flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-bg-elevated text-trade-up">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                      当前已配置 Key:
                      <span className="font-mono text-trade-up bg-trade-up/10 px-2 py-0.5 rounded border border-trade-up/20">
                        {apiKeyMasked || '尚未配置'}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                      <span>环境: {isLiveMode ? '🔴 实盘 (Live)' : '🟢 模拟盘 (Demo)'}</span>
                      <span>·</span>
                      <span>权限: {permissions.length > 0 ? permissions.join(', ') : '无'}</span>
                    </div>
                  </div>
                </div>
                {apiKeyMasked && (
                  <button
                    type="button"
                    onClick={handleClearOkxCredentials}
                    disabled={okxClearLoading}
                    className="px-2.5 py-1.5 rounded-lg bg-trade-down/10 hover:bg-trade-down/20 text-trade-down border border-trade-down/30 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清除凭证</span>
                  </button>
                )}
              </div>

              {/* Safety Alert Banner */}
              <div className="p-3.5 rounded-xl bg-trade-warning/10 border border-trade-warning/30 flex items-start space-x-3">
                <ShieldAlert className="w-5 h-5 text-trade-warning shrink-0 mt-0.5" />
                <div className="text-xs text-text-secondary leading-relaxed">
                  <span className="font-semibold text-trade-warning">金融安全红线：</span>
                  请在 OKX 创建 API 时
                  <strong className="text-trade-down font-bold"> 绝对不要勾选「提现 (Withdrawal)」权限</strong>。
                  系统底层具备主动安全探测，若检测到提现权限将直接熔断阻断！
                </div>
              </div>

              {/* OKX Form */}
              <form onSubmit={handleSaveOkx} className="space-y-3">
                {/* Environment Toggle */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">运行环境选择</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetLiveMode(false)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                        !targetLiveMode
                          ? 'bg-trade-ai/20 border-trade-ai text-trade-ai shadow-sm ring-1 ring-trade-ai/30'
                          : 'bg-bg-primary border-bg-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>模拟盘 (Demo Sandbox)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetLiveMode(true)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                        targetLiveMode
                          ? 'bg-trade-up/20 border-trade-up text-trade-up shadow-sm ring-1 ring-trade-up/30'
                          : 'bg-bg-primary border-bg-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>实盘环境 (Live Real)</span>
                    </button>
                  </div>
                </div>

                {/* Master Password */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    本地主密码 (Master Password)
                  </label>
                  <input
                    type="password"
                    value={okxMasterPassword}
                    onChange={(e) => setOkxMasterPassword(e.target.value)}
                    placeholder="用于本地 AES-256 密钥派生 (留空将使用默认安全密钥)"
                    className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai font-mono"
                  />
                </div>

                {/* API Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-text-secondary">OKX API Key</label>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-text-muted hover:text-text-secondary text-[11px] flex items-center gap-1"
                    >
                      {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showApiKey ? '隐藏' : '显示'}</span>
                    </button>
                  </div>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={apiKeyMasked ? `已配置 (${apiKeyMasked})，输入新 Key 则覆盖` : '请输入 OKX v5 API Key'}
                    className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai font-mono"
                  />
                </div>

                {/* Secret Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-text-secondary">Secret Key</label>
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="text-text-muted hover:text-text-secondary text-[11px] flex items-center gap-1"
                    >
                      {showSecretKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showSecretKey ? '隐藏' : '显示'}</span>
                    </button>
                  </div>
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="请输入 OKX API Secret Key"
                    className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai font-mono"
                  />
                </div>

                {/* Passphrase */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-text-secondary">Passphrase (密码短语)</label>
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="text-text-muted hover:text-text-secondary text-[11px] flex items-center gap-1"
                    >
                      {showPassphrase ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassphrase ? '隐藏' : '显示'}</span>
                    </button>
                  </div>
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="请输入 API 密码短语"
                    className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai font-mono"
                  />
                </div>

                {/* Test Result Card */}
                {okxTestResult && (
                  <div className="p-3 rounded-xl bg-bg-primary border border-bg-border flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary">
                      探测网络延迟: <strong className="text-trade-up font-mono">{okxTestResult.latency_ms}ms</strong>
                    </span>
                    <span className="text-text-secondary">
                      检测权限: <strong className="text-text-primary font-mono">{okxTestResult.permissions.join(', ')}</strong>
                    </span>
                  </div>
                )}

                {/* Feedback Messages */}
                {okxErrorMsg && (
                  <div className="p-3 rounded-xl bg-trade-down/10 border border-trade-down/30 text-xs text-trade-down flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{okxErrorMsg}</span>
                  </div>
                )}
                {okxSuccessMsg && (
                  <div className="p-3 rounded-xl bg-trade-up/10 border border-trade-up/30 text-xs text-trade-up flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{okxSuccessMsg}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-bg-border">
                  <button
                    type="button"
                    onClick={handleTestOkxConnection}
                    disabled={okxTestLoading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-bg-elevated hover:bg-bg-border text-text-primary border border-bg-border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5 text-trade-warning" />
                    <span>{okxTestLoading ? '连通探测中...' : '测试连通性与权限'}</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={closeSecurityModal}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-text-secondary hover:bg-bg-elevated transition-colors"
                    >
                      关闭
                    </button>
                    <button
                      type="submit"
                      disabled={okxLoading}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-trade-ai hover:bg-trade-ai/90 text-white transition-all disabled:opacity-50 flex items-center space-x-1.5 shadow-md shadow-trade-ai/20 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{okxLoading ? '加密校验中...' : '加密保存凭证'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: 大模型 (AI / LLM) 接入管理 */}
          {/* ========================================================================= */}
          {activeTab === 'llm' && (
            <div className="space-y-4">
              {/* LLM Status Card */}
              <div className="p-3.5 rounded-xl bg-bg-primary border border-bg-border flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-bg-elevated text-trade-ai">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                      当前模型:
                      <span className="font-mono text-trade-ai bg-trade-ai/10 px-2 py-0.5 rounded border border-trade-ai/20">
                        {llmModel}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        Key: {llmConfig?.llm_api_key_masked || '未配置'}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5 truncate max-w-md">
                      Base URL: {llmBaseUrl}
                    </div>
                  </div>
                </div>
                {llmConfig?.llm_api_key_masked && (
                  <button
                    type="button"
                    onClick={handleClearLLMKey}
                    disabled={llmClearLoading}
                    className="px-2.5 py-1.5 rounded-lg bg-trade-down/10 hover:bg-trade-down/20 text-trade-down border border-trade-down/30 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清除 Key</span>
                  </button>
                )}
              </div>

              {/* Provider Quick Presets */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  服务商快捷预设 (遵循 OpenAI 协议标准)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyLLMPreset('deepseek')}
                    className={`p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                      llmProvider === 'deepseek' && llmBaseUrl.includes('deepseek')
                        ? 'bg-trade-ai/20 border-trade-ai text-trade-ai font-semibold shadow-sm'
                        : 'bg-bg-primary border-bg-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>DeepSeek</span>
                      <span className="text-[10px] text-trade-up font-mono">推荐</span>
                    </div>
                    <div className="text-[10px] text-text-muted truncate mt-0.5">deepseek-reasoner</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyLLMPreset('openai')}
                    className={`p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                      llmProvider === 'openai' && llmBaseUrl.includes('openai')
                        ? 'bg-trade-ai/20 border-trade-ai text-trade-ai font-semibold shadow-sm'
                        : 'bg-bg-primary border-bg-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="font-bold">OpenAI 官方</div>
                    <div className="text-[10px] text-text-muted truncate mt-0.5">gpt-4o / o1</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyLLMPreset('qwen')}
                    className={`p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                      llmBaseUrl.includes('aliyuncs')
                        ? 'bg-trade-ai/20 border-trade-ai text-trade-ai font-semibold shadow-sm'
                        : 'bg-bg-primary border-bg-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="font-bold">通义千问 (Qwen)</div>
                    <div className="text-[10px] text-text-muted truncate mt-0.5">qwen-max / plus</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyLLMPreset('anthropic')}
                    className={`p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                      llmProvider === 'anthropic'
                        ? 'bg-trade-ai/20 border-trade-ai text-trade-ai font-semibold shadow-sm'
                        : 'bg-bg-primary border-bg-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="font-bold">Claude (代理)</div>
                    <div className="text-[10px] text-text-muted truncate mt-0.5">claude-3-5-sonnet</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyLLMPreset('ollama')}
                    className={`p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                      llmBaseUrl.includes('11434')
                        ? 'bg-trade-ai/20 border-trade-ai text-trade-ai font-semibold shadow-sm'
                        : 'bg-bg-primary border-bg-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="font-bold">本地 Ollama</div>
                    <div className="text-[10px] text-text-muted truncate mt-0.5">localhost:11434</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyLLMPreset('custom')}
                    className={`p-2 rounded-xl text-xs font-medium border text-left transition-all ${
                      llmProvider === 'custom' && !llmBaseUrl.includes('11434') && !llmBaseUrl.includes('aliyuncs')
                        ? 'bg-trade-ai/20 border-trade-ai text-trade-ai font-semibold shadow-sm'
                        : 'bg-bg-primary border-bg-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="font-bold">自定义 (Custom)</div>
                    <div className="text-[10px] text-text-muted truncate mt-0.5">任何 OpenAI 规范中转</div>
                  </button>
                </div>
              </div>

              {/* LLM Form */}
              <form onSubmit={handleSaveLLM} className="space-y-3">
                {/* Base URL */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    API Base URL (必须兼容 OpenAI `/chat/completions`)
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={llmBaseUrl}
                      onChange={(e) => setLlmBaseUrl(e.target.value)}
                      placeholder="https://api.deepseek.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary font-mono focus:outline-none focus:border-trade-ai"
                    />
                  </div>
                </div>

                {/* API Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-text-secondary">
                      大模型 API Key
                      <span className="text-[11px] text-text-muted ml-2">
                        {llmConfig?.llm_api_key_masked ? `(已加密脱敏: ${llmConfig.llm_api_key_masked})` : '(未配置)'}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                      className="text-text-muted hover:text-text-secondary text-[11px] flex items-center gap-1"
                    >
                      {showLlmApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showLlmApiKey ? '隐藏' : '显示'}</span>
                    </button>
                  </div>
                  <input
                    type={showLlmApiKey ? 'text' : 'password'}
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    placeholder={
                      llmConfig?.llm_api_key_masked
                        ? `保持现有加密 Key (${llmConfig.llm_api_key_masked})，输入新 Key 则更新`
                        : '请输入大模型 API Key (sk-...)'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai font-mono"
                  />
                </div>

                {/* Model Name */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    模型名称 (Model Identifier)
                  </label>
                  <input
                    type="text"
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="deepseek-reasoner 或 gpt-4o"
                    className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary font-mono focus:outline-none focus:border-trade-ai"
                  />
                </div>

                {/* Temperature & Max Tokens Sliders */}
                <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-bg-primary border border-bg-border">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-text-secondary text-[11px]">采样温度 (Temperature)</span>
                      <span className="font-mono text-trade-ai font-bold">{llmTemperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.5"
                      step="0.05"
                      value={llmTemperature}
                      onChange={(e) => setLlmTemperature(parseFloat(e.target.value))}
                      className="w-full accent-trade-ai cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
                      <span>0.0 (最严谨)</span>
                      <span>1.5 (发散)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-text-secondary text-[11px]">最大输出 (Max Tokens)</span>
                      <span className="font-mono text-trade-ai font-bold">{llmMaxTokens}</span>
                    </div>
                    <input
                      type="range"
                      min="1024"
                      max="16384"
                      step="512"
                      value={llmMaxTokens}
                      onChange={(e) => setLlmMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-trade-ai cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
                      <span>1024</span>
                      <span>16384</span>
                    </div>
                  </div>
                </div>

                {/* Master Password for LLM */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    本地主密码 (Master Password)
                  </label>
                  <input
                    type="password"
                    value={llmMasterPassword}
                    onChange={(e) => setLlmMasterPassword(e.target.value)}
                    placeholder="用于本地 AES-256 加密保存大模型 API Key (留空使用默认安全密钥)"
                    className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-trade-ai font-mono"
                  />
                </div>

                {/* LLM Test Result Card */}
                {llmTestResult && (
                  <div className="p-3 rounded-xl bg-bg-primary border border-bg-border flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary">
                      响应耗时: <strong className="text-trade-ai font-mono">{llmTestResult.latency_ms}ms</strong>
                    </span>
                    <span className="text-text-secondary truncate max-w-xs">
                      模型: <strong className="text-text-primary font-mono">{llmTestResult.model}</strong>
                    </span>
                  </div>
                )}

                {/* Feedback Messages */}
                {llmErrorMsg && (
                  <div className="p-3 rounded-xl bg-trade-down/10 border border-trade-down/30 text-xs text-trade-down flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{llmErrorMsg}</span>
                  </div>
                )}
                {llmSuccessMsg && (
                  <div className="p-3 rounded-xl bg-trade-up/10 border border-trade-up/30 text-xs text-trade-up flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{llmSuccessMsg}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-bg-border">
                  <button
                    type="button"
                    onClick={handleTestLLMConnection}
                    disabled={llmTestLoading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-bg-elevated hover:bg-bg-border text-text-primary border border-bg-border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5 text-trade-ai" />
                    <span>{llmTestLoading ? '模型测试中...' : '测试大模型连通性'}</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={closeSecurityModal}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-text-secondary hover:bg-bg-elevated transition-colors"
                    >
                      关闭
                    </button>
                    <button
                      type="submit"
                      disabled={llmLoading}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-trade-ai hover:bg-trade-ai/90 text-white transition-all disabled:opacity-50 flex items-center space-x-1.5 shadow-md shadow-trade-ai/20 cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>{llmLoading ? '保存中...' : '加密保存大模型配置'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: 硬风控安全锁 (Hard Risk Rules) */}
          {/* ========================================================================= */}
          {activeTab === 'risk' && (
            <div className="space-y-4">
              {/* Risk Status Card */}
              <div className="p-3.5 rounded-xl bg-bg-primary border border-bg-border flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${riskStatus === 'NORMAL' ? 'bg-trade-up/10 text-trade-up' : 'bg-trade-down/10 text-trade-down'}`}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                      硬风控中枢状态:
                      <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                        riskStatus === 'NORMAL'
                          ? 'bg-trade-up/10 text-trade-up border border-trade-up/30'
                          : 'bg-trade-down/10 text-trade-down border border-trade-down/30 animate-pulse'
                      }`}>
                        {riskStatus === 'NORMAL' ? '🛡️ 正常拦截保护中' : `🚨 熔断锁定 (${riskStatus})`}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      所有手动下单与 AI 采纳必须 100% 经由此拦截层校验
                    </div>
                  </div>
                </div>
                {riskStatus !== 'NORMAL' && (
                  <button
                    type="button"
                    onClick={handleResetCircuit}
                    className="px-3 py-1.5 rounded-lg bg-trade-up hover:bg-trade-up/90 text-white font-semibold text-xs transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>解除熔断</span>
                  </button>
                )}
              </div>

              {/* Risk Form */}
              <form onSubmit={handleSaveRisk} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  {/* Max Order USDT */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      单笔最大委托金额 (USDT)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="100000"
                      step="10"
                      value={maxOrderUsdt}
                      onChange={(e) => setMaxOrderUsdt(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary font-mono focus:outline-none focus:border-trade-ai"
                    />
                    <span className="text-[10px] text-text-muted">单笔名义价值超过该值直接拦截</span>
                  </div>

                  {/* Daily Max Loss */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      单日最大亏损熔断线 (USDT)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="50000"
                      step="10"
                      value={maxDailyLossUsdt}
                      onChange={(e) => setMaxDailyLossUsdt(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary font-mono focus:outline-none focus:border-trade-ai"
                    />
                    <span className="text-[10px] text-text-muted">达到阈值自动锁定并取消所有挂单</span>
                  </div>

                  {/* Max Leverage */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      强制锁死最高杠杆倍数
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={maxLeverage}
                        onChange={(e) => setMaxLeverage(parseInt(e.target.value))}
                        className="flex-1 accent-trade-warning cursor-pointer"
                      />
                      <span className="font-mono text-sm font-bold text-trade-warning w-8 text-right">
                        {maxLeverage}x
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted">物理锁死，防止误开高杠杆</span>
                  </div>

                  {/* Max Slippage */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      最大允许滑点百分比 (%)
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="0.1"
                        max="5.0"
                        step="0.1"
                        value={maxSlippagePct}
                        onChange={(e) => setMaxSlippagePct(parseFloat(e.target.value))}
                        className="flex-1 accent-trade-warning cursor-pointer"
                      />
                      <span className="font-mono text-sm font-bold text-trade-warning w-12 text-right">
                        {maxSlippagePct}%
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted">偏离最新标记价超过此比例时撤销</span>
                  </div>

                  {/* Max Open Positions */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      最大同时持仓标的数
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={maxOpenPositions}
                      onChange={(e) => setMaxOpenPositions(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary font-mono focus:outline-none focus:border-trade-ai"
                    />
                  </div>

                  {/* Max Position USDT */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      单标的最大持仓规模 (USDT)
                    </label>
                    <input
                      type="number"
                      min="100"
                      max="100000"
                      step="100"
                      value={maxPositionUsdt}
                      onChange={(e) => setMaxPositionUsdt(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-bg-border text-xs text-text-primary font-mono focus:outline-none focus:border-trade-ai"
                    />
                  </div>
                </div>

                {/* Feedback Messages */}
                {riskErrorMsg && (
                  <div className="p-3 rounded-xl bg-trade-down/10 border border-trade-down/30 text-xs text-trade-down flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{riskErrorMsg}</span>
                  </div>
                )}
                {riskSuccessMsg && (
                  <div className="p-3 rounded-xl bg-trade-up/10 border border-trade-up/30 text-xs text-trade-up flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{riskSuccessMsg}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-bg-border">
                  <button
                    type="button"
                    onClick={closeSecurityModal}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-text-secondary hover:bg-bg-elevated transition-colors"
                  >
                    关闭
                  </button>
                  <button
                    type="submit"
                    disabled={riskLoading}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-trade-warning hover:bg-trade-warning/90 text-black transition-all disabled:opacity-50 flex items-center space-x-1.5 shadow-md shadow-trade-warning/20 cursor-pointer font-bold"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{riskLoading ? '保存中...' : '更新硬风控规则'}</span>
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
