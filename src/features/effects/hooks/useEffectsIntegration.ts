/**
 * Effects Integration Hook
 * 
 * This hook provides a React interface for the effects integration service,
 * managing initialization and cleanup automatically with component lifecycle.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { effectsIntegration } from '../services/effectsIntegration';

interface UseEffectsIntegrationOptions {
  userId: string;
  enabled?: boolean;
}

interface UseEffectsIntegrationReturn {
  isInitialized: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export function useEffectsIntegration({ 
  userId, 
  enabled = true 
}: UseEffectsIntegrationOptions): UseEffectsIntegrationReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);

  const initialize = useCallback(async (): Promise<void> => {
    if (!enabled || !userId) return;

    // Prevent multiple initializations
    if (initializationRef.current) {
      return initializationRef.current;
    }

    try {
      setError(null);
      setIsInitialized(false);
      
      initializationRef.current = effectsIntegration.initialize(userId);
      await initializationRef.current;
      
      setIsInitialized(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to initialize effects integration: ${errorMessage}`);
      console.error('Effects integration initialization failed:', err);
    } finally {
      initializationRef.current = null;
    }
  }, [enabled, userId]);

  const cleanup = useCallback(async (): Promise<void> => {
    try {
      await effectsIntegration.cleanup();
      setIsInitialized(false);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to cleanup effects integration: ${errorMessage}`);
      console.error('Effects integration cleanup failed:', err);
    }
  }, []);

  // Auto-initialize when enabled and userId changes
  useEffect(() => {
    if (enabled && userId) {
      initialize();
    }
  }, [initialize, userId, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup().catch(console.error);
    };
  }, [cleanup]);

  return {
    isInitialized,
    error,
    initialize,
    cleanup,
  };
}
