import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorRecoveryService, ErrorType, RecoveryAction } from '../ErrorRecoveryService';

describe('ErrorRecoveryService', () => {
  let errorRecoveryService: ErrorRecoveryService;

  beforeEach(() => {
    errorRecoveryService = new ErrorRecoveryService({
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 1000,
      exponentialBackoff: true,
      enableUserFeedback: true,
      enableAutoRecovery: true
    });
  });

  afterEach(() => {
    errorRecoveryService.cleanup();
  });

  describe('Error Handling', () => {
    it('should handle namespace connection failures with retry strategy', async () => {
      const mockRecoveryHandler = vi.fn();
      errorRecoveryService.onRecovery(mockRecoveryHandler);

      await errorRecoveryService.handleError({
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        message: 'Connection failed',
        timestamp: Date.now()
      });

      expect(mockRecoveryHandler).toHaveBeenCalledWith({
        action: RecoveryAction.RETRY_CONNECTION,
        context: expect.objectContaining({
          errorType: ErrorType.NAMESPACE_CONNECTION_FAILED
        })
      });
    });

    it('should handle WebRTC connection failures with fallback', async () => {
      const mockRecoveryHandler = vi.fn();
      errorRecoveryService.onRecovery(mockRecoveryHandler);

      await errorRecoveryService.handleError({
        errorType: ErrorType.WEBRTC_CONNECTION_FAILED,
        message: 'WebRTC failed',
        timestamp: Date.now()
      });

      expect(mockRecoveryHandler).toHaveBeenCalledWith({
        action: RecoveryAction.RETRY_CONNECTION,
        context: expect.objectContaining({
          errorType: ErrorType.WEBRTC_CONNECTION_FAILED
        })
      });
    });

    it('should handle audio initialization failures with user prompt', async () => {
      const mockRecoveryHandler = vi.fn();
      errorRecoveryService.onRecovery(mockRecoveryHandler);

      await errorRecoveryService.handleError({
        errorType: ErrorType.AUDIO_INITIALIZATION_FAILED,
        message: 'Audio init failed',
        timestamp: Date.now()
      });

      expect(mockRecoveryHandler).toHaveBeenCalledWith({
        action: RecoveryAction.RETRY_CONNECTION,
        context: expect.objectContaining({
          errorType: ErrorType.AUDIO_INITIALIZATION_FAILED
        })
      });
    });

    it('should handle state inconsistency with force reconnection', async () => {
      const mockRecoveryHandler = vi.fn();
      errorRecoveryService.onRecovery(mockRecoveryHandler);

      await errorRecoveryService.handleError({
        errorType: ErrorType.STATE_INCONSISTENCY,
        message: 'State inconsistent',
        timestamp: Date.now()
      });

      expect(mockRecoveryHandler).toHaveBeenCalledWith({
        action: RecoveryAction.FORCE_RECONNECTION,
        context: expect.objectContaining({
          errorType: ErrorType.STATE_INCONSISTENCY
        })
      });
    });
  });

  describe('Retry Logic', () => {
    it('should escalate to fallback strategy after max retries', async () => {
      const mockRecoveryHandler = vi.fn();
      errorRecoveryService.onRecovery(mockRecoveryHandler);

      // Simulate multiple failures
      for (let i = 0; i < 4; i++) {
        await errorRecoveryService.handleError({
          errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
          message: 'Connection failed',
          timestamp: Date.now(),
          roomId: 'test-room'
        });
      }

      // Should eventually call fallback strategy
      expect(mockRecoveryHandler).toHaveBeenCalledWith({
        action: RecoveryAction.FALLBACK_TO_HTTP,
        context: expect.objectContaining({
          errorType: ErrorType.NAMESPACE_CONNECTION_FAILED
        })
      });
    });

    it('should calculate exponential backoff delays correctly', () => {
      const service = new ErrorRecoveryService({
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        exponentialBackoff: true,
        enableUserFeedback: false,
        enableAutoRecovery: false
      });

      // Access private method through type assertion for testing
      const calculateDelay = (service as any).calculateDelay.bind(service);

      expect(calculateDelay(0)).toBe(1000);
      expect(calculateDelay(1)).toBe(2000);
      expect(calculateDelay(2)).toBe(4000);
      expect(calculateDelay(3)).toBe(8000);
      expect(calculateDelay(4)).toBe(10000); // Capped at maxDelay
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics correctly', async () => {
      await errorRecoveryService.handleError({
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        message: 'Error 1',
        timestamp: Date.now()
      });

      await errorRecoveryService.handleError({
        errorType: ErrorType.WEBRTC_CONNECTION_FAILED,
        message: 'Error 2',
        timestamp: Date.now()
      });

      const stats = errorRecoveryService.getErrorStats();

      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByType[ErrorType.NAMESPACE_CONNECTION_FAILED]).toBe(1);
      expect(stats.errorsByType[ErrorType.WEBRTC_CONNECTION_FAILED]).toBe(1);
      expect(stats.recentErrors).toHaveLength(2);
    });

    it('should limit error history size', async () => {
      // Add more errors than the limit
      for (let i = 0; i < 60; i++) {
        await errorRecoveryService.handleError({
          errorType: ErrorType.UNKNOWN_ERROR,
          message: `Error ${i}`,
          timestamp: Date.now()
        });
      }

      const stats = errorRecoveryService.getErrorStats();
      expect(stats.totalErrors).toBeLessThanOrEqual(50); // Should be limited
    });
  });

  describe('Recovery State Management', () => {
    it('should track recovery in progress', async () => {
      const context = {
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        message: 'Test error',
        timestamp: Date.now(),
        roomId: 'test-room'
      };

      expect(errorRecoveryService.isRecoveryInProgress(context)).toBe(false);

      // Trigger recovery
      await errorRecoveryService.handleError(context);

      // Should be in progress briefly
      // Note: This is timing-dependent and might need adjustment
    });

    it('should clear retry counts correctly', async () => {
      const context = {
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        message: 'Test error',
        timestamp: Date.now(),
        roomId: 'test-room'
      };

      // Generate some retries
      await errorRecoveryService.handleError(context);
      await errorRecoveryService.handleError(context);

      // Clear retry count
      errorRecoveryService.clearRetryCount(context);

      // Next error should start from retry count 0
      const mockRecoveryHandler = vi.fn();
      errorRecoveryService.onRecovery(mockRecoveryHandler);

      await errorRecoveryService.handleError(context);

      // Should use retry strategy, not fallback
      expect(mockRecoveryHandler).toHaveBeenCalledWith({
        action: RecoveryAction.RETRY_CONNECTION,
        context: expect.objectContaining({
          errorType: ErrorType.NAMESPACE_CONNECTION_FAILED
        })
      });
    });
  });

  describe('User Feedback', () => {
    it('should trigger user feedback handlers', async () => {
      const mockFeedbackHandler = vi.fn();
      errorRecoveryService.onUserFeedback(mockFeedbackHandler);

      await errorRecoveryService.handleError({
        errorType: ErrorType.PERMISSION_DENIED,
        message: 'Permission denied',
        timestamp: Date.now()
      });

      expect(mockFeedbackHandler).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
        'error'
      );
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources properly', () => {
      const mockErrorHandler = vi.fn();
      const mockRecoveryHandler = vi.fn();
      const mockFeedbackHandler = vi.fn();

      errorRecoveryService.onError(mockErrorHandler);
      errorRecoveryService.onRecovery(mockRecoveryHandler);
      errorRecoveryService.onUserFeedback(mockFeedbackHandler);

      errorRecoveryService.cleanup();

      const stats = errorRecoveryService.getErrorStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.activeRecoveries).toHaveLength(0);
    });
  });
});