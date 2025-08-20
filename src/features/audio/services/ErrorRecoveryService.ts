import { ConnectionState } from '../types/connectionState';

/**
 * Error Recovery Service for comprehensive error handling and recovery
 * Requirements: 6.10, 10.6, 10.7
 */

export enum ErrorType {
  NAMESPACE_CONNECTION_FAILED = 'namespace_connection_failed',
  WEBRTC_CONNECTION_FAILED = 'webrtc_connection_failed',
  AUDIO_INITIALIZATION_FAILED = 'audio_initialization_failed',
  STATE_INCONSISTENCY = 'state_inconsistency',
  APPROVAL_TIMEOUT = 'approval_timeout',
  GRACE_PERIOD_EXPIRED = 'grace_period_expired',
  NETWORK_ERROR = 'network_error',
  PERMISSION_DENIED = 'permission_denied',
  UNKNOWN_ERROR = 'unknown_error'
}

export enum RecoveryAction {
  RETRY_CONNECTION = 'retry_connection',
  FALLBACK_TO_HTTP = 'fallback_to_http',
  FORCE_RECONNECTION = 'force_reconnection',
  CLEAR_STATE = 'clear_state',
  RETURN_TO_LOBBY = 'return_to_lobby',
  SHOW_USER_PROMPT = 'show_user_prompt',
  RELOAD_PAGE = 'reload_page',
  NO_ACTION = 'no_action'
}

export interface ErrorContext {
  errorType: ErrorType;
  message: string;
  originalError?: Error;
  connectionState?: ConnectionState;
  roomId?: string;
  userId?: string;
  timestamp: number;
  retryCount?: number;
  additionalData?: Record<string, any>;
}

export interface RecoveryStrategy {
  action: RecoveryAction;
  delay?: number;
  maxRetries?: number;
  fallbackStrategy?: RecoveryStrategy;
  userMessage?: string;
  requiresUserAction?: boolean;
}

export interface ErrorRecoveryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  enableUserFeedback: boolean;
  enableAutoRecovery: boolean;
}

export class ErrorRecoveryService {
  private errorHistory: ErrorContext[] = [];
  private recoveryAttempts = new Map<string, number>();
  private activeRecoveries = new Set<string>();
  private errorHandlers = new Set<(error: ErrorContext) => void>();
  private recoveryHandlers = new Set<(recovery: { action: RecoveryAction; context: ErrorContext }) => void>();
  private userFeedbackHandlers = new Set<(message: string, type: 'error' | 'warning' | 'info' | 'success') => void>();

  private readonly options: ErrorRecoveryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBackoff: true,
    enableUserFeedback: true,
    enableAutoRecovery: true
  };

  constructor(options?: Partial<ErrorRecoveryOptions>) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  /**
   * Handle an error with automatic recovery
   * Requirements: 6.10 - Automatic state recovery for inconsistent connection states
   */
  async handleError(context: ErrorContext): Promise<void> {
    // Add to error history
    this.errorHistory.push(context);
    
    // Keep only last 50 errors to prevent memory leaks
    if (this.errorHistory.length > 50) {
      this.errorHistory = this.errorHistory.slice(-50);
    }

    console.error('🚨 ErrorRecoveryService: Handling error', context);

    // Notify error handlers
    this.notifyErrorHandlers(context);

    // Determine recovery strategy
    const strategy = this.determineRecoveryStrategy(context);
    
    if (strategy.requiresUserAction && this.options.enableUserFeedback) {
      this.showUserFeedback(strategy.userMessage || context.message, 'error');
    }

    // Execute recovery if auto-recovery is enabled
    if (this.options.enableAutoRecovery && strategy.action !== RecoveryAction.NO_ACTION) {
      await this.executeRecovery(context, strategy);
    }
  }

  /**
   * Determine the appropriate recovery strategy based on error context
   */
  private determineRecoveryStrategy(context: ErrorContext): RecoveryStrategy {
    const retryCount = this.getRetryCount(context);
    const hasExceededRetries = retryCount >= this.options.maxRetries;

    switch (context.errorType) {
      case ErrorType.NAMESPACE_CONNECTION_FAILED:
        if (hasExceededRetries) {
          return {
            action: RecoveryAction.FALLBACK_TO_HTTP,
            userMessage: 'Connection failed. Switching to basic mode.',
            fallbackStrategy: {
              action: RecoveryAction.RETURN_TO_LOBBY,
              userMessage: 'Unable to connect. Please try again later.',
              requiresUserAction: true
            }
          };
        }
        return {
          action: RecoveryAction.RETRY_CONNECTION,
          delay: this.calculateDelay(retryCount),
          maxRetries: this.options.maxRetries,
          userMessage: retryCount > 0 ? `Retrying connection (${retryCount + 1}/${this.options.maxRetries})...` : undefined
        };

      case ErrorType.WEBRTC_CONNECTION_FAILED:
        return {
          action: RecoveryAction.RETRY_CONNECTION,
          delay: this.calculateDelay(retryCount),
          maxRetries: 2, // Lower retry count for WebRTC
          userMessage: 'Voice connection failed. Continuing without voice chat.',
          fallbackStrategy: {
            action: RecoveryAction.NO_ACTION, // Continue without WebRTC
            userMessage: 'Voice chat unavailable. You can still play music together.'
          }
        };

      case ErrorType.AUDIO_INITIALIZATION_FAILED:
        return {
          action: RecoveryAction.RETRY_CONNECTION,
          delay: 2000,
          maxRetries: 2,
          userMessage: 'Audio system failed to initialize. Trying fallback...',
          fallbackStrategy: {
            action: RecoveryAction.SHOW_USER_PROMPT,
            userMessage: 'Audio initialization failed. Please check your browser permissions and try refreshing the page.',
            requiresUserAction: true
          }
        };

      case ErrorType.STATE_INCONSISTENCY:
        return {
          action: RecoveryAction.FORCE_RECONNECTION,
          userMessage: 'Connection state inconsistent. Reconnecting...',
          fallbackStrategy: {
            action: RecoveryAction.CLEAR_STATE,
            userMessage: 'Unable to recover connection state. Returning to lobby.',
            requiresUserAction: true
          }
        };

      case ErrorType.APPROVAL_TIMEOUT:
        return {
          action: RecoveryAction.RETURN_TO_LOBBY,
          userMessage: 'Room approval timed out. Returning to lobby.',
          requiresUserAction: true
        };

      case ErrorType.GRACE_PERIOD_EXPIRED:
        return {
          action: RecoveryAction.FORCE_RECONNECTION,
          userMessage: 'Connection lost. Attempting to reconnect...',
          fallbackStrategy: {
            action: RecoveryAction.RETURN_TO_LOBBY,
            userMessage: 'Unable to reconnect. Please refresh the page or return to lobby.',
            requiresUserAction: true
          }
        };

      case ErrorType.NETWORK_ERROR:
        if (hasExceededRetries) {
          return {
            action: RecoveryAction.SHOW_USER_PROMPT,
            userMessage: 'Network connection issues detected. Please check your internet connection.',
            requiresUserAction: true
          };
        }
        return {
          action: RecoveryAction.RETRY_CONNECTION,
          delay: this.calculateDelay(retryCount),
          maxRetries: this.options.maxRetries,
          userMessage: 'Network error. Retrying...'
        };

      case ErrorType.PERMISSION_DENIED:
        return {
          action: RecoveryAction.SHOW_USER_PROMPT,
          userMessage: 'Permission denied. Please check your browser settings and refresh the page.',
          requiresUserAction: true
        };

      default:
        return {
          action: RecoveryAction.SHOW_USER_PROMPT,
          userMessage: 'An unexpected error occurred. Please refresh the page.',
          requiresUserAction: true
        };
    }
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecovery(context: ErrorContext, strategy: RecoveryStrategy): Promise<void> {
    const recoveryKey = this.getRecoveryKey(context);
    
    if (this.activeRecoveries.has(recoveryKey)) {
      console.log('🔄 Recovery already in progress for', recoveryKey);
      return;
    }

    this.activeRecoveries.add(recoveryKey);

    try {
      // Apply delay if specified
      if (strategy.delay) {
        await this.delay(strategy.delay);
      }

      // Show user feedback if enabled
      if (strategy.userMessage && this.options.enableUserFeedback) {
        this.showUserFeedback(strategy.userMessage, 'info');
      }

      // Notify recovery handlers
      this.notifyRecoveryHandlers({ action: strategy.action, context });

      // Increment retry count
      this.incrementRetryCount(context);

      console.log('🔧 Executing recovery action:', strategy.action, 'for', context.errorType);

    } catch (error) {
      console.error('❌ Recovery execution failed:', error);
      
      // Try fallback strategy if available
      if (strategy.fallbackStrategy) {
        await this.executeRecovery(context, strategy.fallbackStrategy);
      }
    } finally {
      this.activeRecoveries.delete(recoveryKey);
    }
  }

  /**
   * Get retry count for a specific error context
   */
  private getRetryCount(context: ErrorContext): number {
    const key = this.getRecoveryKey(context);
    return this.recoveryAttempts.get(key) || 0;
  }

  /**
   * Increment retry count for a specific error context
   */
  private incrementRetryCount(context: ErrorContext): void {
    const key = this.getRecoveryKey(context);
    const currentCount = this.recoveryAttempts.get(key) || 0;
    this.recoveryAttempts.set(key, currentCount + 1);
  }

  /**
   * Generate a unique key for recovery tracking
   */
  private getRecoveryKey(context: ErrorContext): string {
    return `${context.errorType}-${context.roomId || 'global'}-${context.userId || 'anonymous'}`;
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(retryCount: number): number {
    if (!this.options.exponentialBackoff) {
      return this.options.baseDelay;
    }

    const delay = this.options.baseDelay * Math.pow(2, retryCount);
    return Math.min(delay, this.options.maxDelay);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Show user feedback
   */
  private showUserFeedback(message: string, type: 'error' | 'warning' | 'info' | 'success'): void {
    this.userFeedbackHandlers.forEach(handler => {
      try {
        handler(message, type);
      } catch (error) {
        console.error('Error in user feedback handler:', error);
      }
    });
  }

  /**
   * Notify error handlers
   */
  private notifyErrorHandlers(context: ErrorContext): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(context);
      } catch (error) {
        console.error('Error in error handler:', error);
      }
    });
  }

  /**
   * Notify recovery handlers
   */
  private notifyRecoveryHandlers(recovery: { action: RecoveryAction; context: ErrorContext }): void {
    this.recoveryHandlers.forEach(handler => {
      try {
        handler(recovery);
      } catch (error) {
        console.error('Error in recovery handler:', error);
      }
    });
  }

  /**
   * Add error handler
   */
  onError(handler: (error: ErrorContext) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Add recovery handler
   */
  onRecovery(handler: (recovery: { action: RecoveryAction; context: ErrorContext }) => void): () => void {
    this.recoveryHandlers.add(handler);
    return () => this.recoveryHandlers.delete(handler);
  }

  /**
   * Add user feedback handler
   */
  onUserFeedback(handler: (message: string, type: 'error' | 'warning' | 'info' | 'success') => void): () => void {
    this.userFeedbackHandlers.add(handler);
    return () => this.userFeedbackHandlers.delete(handler);
  }

  /**
   * Clear retry count for a specific context
   */
  clearRetryCount(context: Partial<ErrorContext>): void {
    const key = this.getRecoveryKey(context as ErrorContext);
    this.recoveryAttempts.delete(key);
  }

  /**
   * Clear all retry counts
   */
  clearAllRetryCounts(): void {
    this.recoveryAttempts.clear();
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    recentErrors: ErrorContext[];
    activeRecoveries: string[];
  } {
    const errorsByType = this.errorHistory.reduce((acc, error) => {
      acc[error.errorType] = (acc[error.errorType] || 0) + 1;
      return acc;
    }, {} as Record<ErrorType, number>);

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      recentErrors: this.errorHistory.slice(-10),
      activeRecoveries: Array.from(this.activeRecoveries)
    };
  }

  /**
   * Check if recovery is in progress for a specific context
   */
  isRecoveryInProgress(context: Partial<ErrorContext>): boolean {
    const key = this.getRecoveryKey(context as ErrorContext);
    return this.activeRecoveries.has(key);
  }

  /**
   * Force clear recovery state (for manual intervention)
   */
  clearRecoveryState(context?: Partial<ErrorContext>): void {
    if (context) {
      const key = this.getRecoveryKey(context as ErrorContext);
      this.activeRecoveries.delete(key);
      this.recoveryAttempts.delete(key);
    } else {
      this.activeRecoveries.clear();
      this.recoveryAttempts.clear();
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.errorHistory = [];
    this.recoveryAttempts.clear();
    this.activeRecoveries.clear();
    this.errorHandlers.clear();
    this.recoveryHandlers.clear();
    this.userFeedbackHandlers.clear();
  }
}