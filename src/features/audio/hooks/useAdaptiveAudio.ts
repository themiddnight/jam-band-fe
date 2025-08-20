import { useState, useEffect, useCallback, useRef } from 'react';
import { adaptiveAudioManager } from '../services/AdaptiveAudioManager';
import type { AdaptiveAudioState } from '../services/AdaptiveAudioManager';
import { ADAPTIVE_AUDIO_CONFIG } from '../constants/audioConfig';

interface UseAdaptiveAudioOptions {
  audioContext?: AudioContext | null;
  userCount?: number;
  currentLatency?: number | null;
  onConfigChange?: (config: typeof ADAPTIVE_AUDIO_CONFIG.SMALL_MESH) => void;
}

export function useAdaptiveAudio({
  audioContext,
  userCount = 0,
  currentLatency = null,
  onConfigChange
}: UseAdaptiveAudioOptions = {}) {
  const [state, setState] = useState<AdaptiveAudioState>(adaptiveAudioManager.getCurrentState());
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const initializedRef = useRef(false);

  // Initialize adaptive audio manager
  useEffect(() => {
    if (audioContext && !initializedRef.current) {
      adaptiveAudioManager.initialize(audioContext, (config) => {
        // Update local state when configuration changes
        setState(adaptiveAudioManager.getCurrentState());
        
        // Call external callback if provided
        if (onConfigChange) {
          onConfigChange(config);
        }
        
        console.log('🎵 Adaptive audio configuration changed:', config);
      });
      
      initializedRef.current = true;
    }
  }, [audioContext, onConfigChange]);

  // Update user count
  useEffect(() => {
    if (initializedRef.current && userCount > 0) {
      adaptiveAudioManager.updateUserCount(userCount);
      setState(adaptiveAudioManager.getCurrentState());
    }
  }, [userCount]);

  // Update latency
  useEffect(() => {
    if (initializedRef.current && currentLatency !== null) {
      adaptiveAudioManager.updateLatency(currentLatency);
      setState(adaptiveAudioManager.getCurrentState());
    }
  }, [currentLatency]);

  // Get current configuration
  const getCurrentConfig = useCallback(() => {
    return adaptiveAudioManager.getCurrentConfig();
  }, []);

  // Get current state
  const getCurrentState = useCallback(() => {
    return adaptiveAudioManager.getCurrentState();
  }, []);

  // Get performance metrics
  const getPerformanceMetrics = useCallback(() => {
    const metrics = adaptiveAudioManager.getPerformanceMetrics();
    setPerformanceMetrics(metrics);
    return metrics;
  }, []);

  // Get recommendations
  const getRecommendations = useCallback(() => {
    const recs = adaptiveAudioManager.getRecommendations();
    setRecommendations(recs);
    return recs;
  }, []);

  // Force quality reduction (for testing)
  const forceQualityReduction = useCallback(() => {
    // This would trigger the quality reduction logic
    // In a real implementation, you might want to simulate poor performance
    console.log('🧪 Force quality reduction triggered');
  }, []);

  // Get configuration summary
  const getConfigSummary = useCallback(() => {
    const config = getCurrentConfig();
    return {
      quality: config.quality,
      description: config.description,
      latencyTarget: config.latencyTarget,
      cpuTarget: config.cpuTarget,
      sampleSize: config.sampleSize,
      bufferSize: config.bufferSize,
      lookAhead: `${(config.lookAhead * 1000).toFixed(1)}ms`,
      updateInterval: `${(config.updateInterval * 1000).toFixed(1)}ms`
    };
  }, [getCurrentConfig]);

  // Monitor performance and update recommendations
  useEffect(() => {
    const interval = setInterval(() => {
      getRecommendations();
      getPerformanceMetrics();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [getRecommendations, getPerformanceMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initializedRef.current) {
        adaptiveAudioManager.cleanup();
        initializedRef.current = false;
      }
    };
  }, []);

  return {
    // State
    state,
    recommendations,
    performanceMetrics,
    
    // Configuration
    currentConfig: getCurrentConfig(),
    configSummary: getConfigSummary(),
    
    // Actions
    getCurrentConfig,
    getCurrentState,
    getPerformanceMetrics,
    getRecommendations,
    forceQualityReduction,
    
    // Helper properties
    isUltraLowLatency: state.quality === 'ultra-low-latency',
    isBalanced: state.quality === 'balanced',
    isStable: state.quality === 'stable',
    qualityLevel: state.quality,
    userCount: state.userCount,
    currentLatency: state.currentLatency,
    lastAdjustment: state.lastAdjustment
  };
} 