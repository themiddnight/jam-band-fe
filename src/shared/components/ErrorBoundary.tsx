import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('🚨 ErrorBoundary: React component error caught', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Store error info for display in development
    this.setState({ errorInfo });

    // Auto-recovery: Clear localStorage and reload once
    const hasTriedRecovery = sessionStorage.getItem('error-recovery-attempted');
    
    if (!hasTriedRecovery) {
      console.warn('🔄 Auto-recovery: Clearing localStorage and reloading...');
      sessionStorage.setItem('error-recovery-attempted', 'true');
      localStorage.clear();
      window.location.reload();
      return;
    }

    // If recovery was already attempted, show error UI
    console.error('❌ Recovery failed, showing error UI');
    
    // In a real app, you might want to send this to an error reporting service
    // Example: sendErrorToService(error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-red-400">
                Something went wrong
              </h1>
              <p className="text-gray-300">
                The app encountered an unexpected error. Don't worry, your jam session data is safe!
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleClearAndReload}
                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors"
              >
                Clear Storage & Reload
              </button>
              <button
                onClick={this.handleReload}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Refresh Page
              </button>
            </div>

            {/* Show error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <details className="text-left text-xs bg-gray-800 p-3 rounded">
                <summary className="cursor-pointer text-gray-400 mb-2">
                  Error Details (Development)
                </summary>
                <div className="space-y-2 text-gray-300">
                  <div>
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap break-all">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap break-all">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
} 