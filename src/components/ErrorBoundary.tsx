/**
 * @file ErrorBoundary.tsx
 * @description React 错误边界守卫组件 - 防止任何子组件运行时异常导致页面整屏全黑崩溃
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到 React 渲染异常:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full min-h-[160px] flex-col items-center justify-center rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-center shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400 mb-3 animate-pulse">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-red-200">
            {this.props.fallbackTitle || '组件加载异常'}
          </h3>
          <p className="mt-1 max-w-md text-xs text-red-300/80 font-mono line-clamp-2">
            {this.state.error?.message || '未知前端渲染错误'}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-4 flex items-center space-x-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors shadow-md shadow-red-600/30 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>重新加载模块</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
