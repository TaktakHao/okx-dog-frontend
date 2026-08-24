/**
 * OKX-Dog 金融量化交易终端 - 标的工具集 (Symbol & Currency Helpers)
 * 模块: okx-dog-frontend/src/utils/symbolHelper.ts
 */

export interface SymbolMeta {
  symbol: string;
  name: string;
  category: 'tradfi' | 'rwa' | 'crypto' | 'equities' | 'commodities' | 'custom' | 'positions';
  isTradFi: boolean;
  baseCcy: string;
  quoteCcy: string;
  icon?: string;
  defaultPrice?: number;
}

/**
 * 从标的代码提取基础资产名称 (如 BTC-USDT-SWAP -> BTC, XAU-USDT-SWAP -> XAU, NVDA-USDT-SWAP -> NVDA)
 */
export function getBaseCurrency(symbol: string = 'BTC-USDT-SWAP'): string {
  if (!symbol) return 'BTC';
  const parts = symbol.split('-');
  return parts[0] || symbol;
}

/**
 * 从标的代码提取计价币种 (如 BTC-USDT-SWAP -> USDT)
 */
export function getQuoteCurrency(symbol: string = 'BTC-USDT-SWAP'): string {
  if (!symbol) return 'USDT';
  const parts = symbol.split('-');
  return parts[1] || 'USDT';
}

/**
 * 判断标的是否属于 TradFi / RWA / 大宗商品 / 美股代币化资产
 */
export function isTradFiSymbol(symbol: string = ''): boolean {
  if (!symbol) return false;
  const sym = symbol.toUpperCase();
  const tradFiTokens = [
    'XAU', 'XAG', 'GOLD', 'SILVER', 'OIL',
    'EUR', 'GBP', 'JPY', 'USD', 'AUD', 'CAD', 'CHF',
    'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'SPY', 'QQQ',
    'ONDO', 'PENDLE', 'PAXG', 'MKR', 'CFG', 'MPL', 'TRU'
  ];
  return tradFiTokens.some((t) => sym.includes(t));
}

/**
 * 获取标的中文友好展示名称
 */
export function getSymbolDisplayName(symbol: string = ''): string {
  if (!symbol) return '';
  const upper = symbol.toUpperCase();
  if (upper.includes('XAU')) return '黄金永续 (Gold)';
  if (upper.includes('XAG')) return '白银永续 (Silver)';
  if (upper.includes('EUR')) return '欧元/美元 (EUR/USDT)';
  if (upper.includes('GBP')) return '英镑/美元 (GBP/USDT)';
  if (upper.includes('PAXG')) return 'PAXG 黄金实物代币';
  if (upper.includes('NVDA')) return '英伟达代币化永续 (NVIDIA)';
  if (upper.includes('TSLA')) return '特斯拉代币化永续 (Tesla)';
  if (upper.includes('AAPL')) return '苹果代币化永续 (Apple)';
  if (upper.includes('ONDO')) return 'Ondo 美债 RWA 龙头';
  if (upper.includes('PENDLE')) return 'Pendle 利率拆分协议';
  if (upper.includes('MKR')) return 'MakerDAO Sky 协议';
  if (upper.includes('BTC')) return '比特币永续 (Bitcoin)';
  if (upper.includes('ETH')) return '以太坊永续 (Ethereum)';
  if (upper.includes('SOL')) return 'Solana 永续';
  if (upper.includes('DOGE')) return '狗狗币永续 (Dogecoin)';
  if (upper.includes('BNB')) return 'BNB 永续';
  if (upper.includes('XRP')) return 'Ripple 永续';
  if (upper.includes('SUI')) return 'Sui 永续';
  return `${getBaseCurrency(symbol)} 交易对`;
}

/**
 * 标的资产大类标签
 */
export function getSymbolBadge(symbol: string = ''): { label: string; color: string } {
  const upper = symbol.toUpperCase();
  if (upper.includes('XAU') || upper.includes('XAG') || upper.includes('PAXG')) {
    return { label: '大宗商品', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  }
  if (upper.includes('NVDA') || upper.includes('TSLA') || upper.includes('AAPL') || upper.includes('MSFT')) {
    return { label: '美股代币', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  }
  if (upper.includes('EUR') || upper.includes('GBP') || upper.includes('JPY')) {
    return { label: '外汇汇率', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  }
  if (upper.includes('ONDO') || upper.includes('PENDLE') || upper.includes('MKR')) {
    return { label: 'RWA美债', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
  }
  return { label: '加密资产', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
}

/**
 * 根据价格量级自适应格式化价格字符串
 */
export function formatPrice(price: number | null | undefined, symbol?: string): string {
  if (price === null || price === undefined || isNaN(price)) return '0.00';
  const sym = symbol ? symbol.toUpperCase() : '';

  if (sym.includes('EUR') || sym.includes('GBP') || sym.includes('JPY') || sym.includes('DOGE') || sym.includes('SUI') || sym.includes('ONDO')) {
    return price < 0.01 ? price.toFixed(6) : price.toFixed(4);
  }
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
  if (price >= 10) {
    return price.toFixed(2);
  }
  if (price >= 1) {
    return price.toFixed(3);
  }
  if (price > 0.0001) {
    return price.toFixed(4);
  }
  return price.toFixed(6);
}

/**
 * 自适应格式化数量字符串
 */
export function formatSize(size: number | null | undefined, symbol?: string): string {
  if (size === null || size === undefined || isNaN(size)) return '0.00';
  const sym = symbol ? symbol.toUpperCase() : '';
  if (sym.includes('BTC') || sym.includes('MKR') || sym.includes('PAXG')) {
    return size.toFixed(4);
  }
  if (sym.includes('ETH') || sym.includes('SOL') || sym.includes('XAU')) {
    return size.toFixed(2);
  }
  return size.toFixed(1);
}

/**
 * 获取标的基准默认保底价格 (用于离线/沙盒/初始化回退)
 */
export function getSymbolDefaultPrice(symbol: string = 'BTC-USDT-SWAP'): number {
  if (!symbol) return 63428.0;
  const sym = symbol.toUpperCase();
  if (sym.includes('ETH')) return 2680.0;
  if (sym.includes('BTC')) return 63428.0;
  if (sym.includes('SOL')) return 188.0;
  if (sym.includes('XAU') || sym.includes('PAXG')) return 2650.0;
  if (sym.includes('XAG')) return 31.5;
  if (sym.includes('NVDA')) return 128.5;
  if (sym.includes('TSLA')) return 245.0;
  if (sym.includes('AAPL')) return 185.0;
  if (sym.includes('EUR')) return 1.085;
  if (sym.includes('GBP')) return 1.275;
  if (sym.includes('ONDO')) return 0.725;
  if (sym.includes('PENDLE')) return 4.25;
  if (sym.includes('MKR')) return 1650.0;
  if (sym.includes('DOGE')) return 0.125;
  if (sym.includes('BNB')) return 580.0;
  if (sym.includes('XRP')) return 0.58;
  if (sym.includes('SUI')) return 1.85;
  return 100.0;
}

