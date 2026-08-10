import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 bg-rose-50 border border-rose-200 rounded-2xl animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Something went wrong in {this.props.componentName || 'this component'}
          </h2>
          <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
            We've caught an unexpected error. The rest of the application should still work.
            {this.state.error && (
              <span className="block mt-2 font-mono text-[10px] text-rose-600 bg-rose-100/50 p-2 rounded">
                {this.state.error.message}
              </span>
            )}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center space-x-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-sm shadow-rose-200"
          >
            <RefreshCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
