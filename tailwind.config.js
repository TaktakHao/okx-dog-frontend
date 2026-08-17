/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 暗黑金融交易终端配色
        bg: {
          primary: '#0B0E14',   // 最底层深黑
          secondary: '#151921', // 卡片/面板背景
          elevated: '#1E232E',  // 浮层/弹窗背景
          border: '#2A303C'     // 边框分界线
        },
        trade: {
          up: '#00C087',        // 上涨亮绿
          down: '#F6465D',      // 下跌霓虹红
          warning: '#F59E0B',   // 警告琥珀黄
          ai: '#6366F1'         // AI/智能科技靛蓝
        },
        text: {
          primary: '#F3F4F6',
          secondary: '#9CA3AF',
          muted: '#6B7280'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}
