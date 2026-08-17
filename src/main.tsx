import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="OKX-Dog 个人量化智能交易终端初始化异常">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
