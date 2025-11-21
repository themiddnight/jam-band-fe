/**
 * Waveform Configuration Helper Utilities
 * 
 * Provides runtime utilities for monitoring and debugging waveform configuration
 */

import {
  ACTIVE_WAVEFORM_PRESET,
  WAVEFORM_DETAIL_PRESET,
  MAX_WAVEFORM_PIXEL_WIDTH,
  LOD_THRESHOLDS,
  WAVEFORM_BAR_WIDTH,
  VIEWPORT_CULLING,
  LOD_CACHE,
  WAVEFORM_PERFORMANCE,
  getWaveformConfigSummary,
  estimateWaveformMemoryUsage,
} from './waveformConfig';

/**
 * Log current waveform configuration to console
 * Useful for debugging and verifying settings
 */
export const logWaveformConfig = (): void => {
  console.group('🎵 Waveform Configuration');
  console.log('Active Preset:', ACTIVE_WAVEFORM_PRESET);
  console.log('Max Pixel Width:', MAX_WAVEFORM_PIXEL_WIDTH);
  console.log('LOD Thresholds:', LOD_THRESHOLDS);
  console.log('Bar Width Range:', WAVEFORM_BAR_WIDTH);
  console.log('Viewport Culling:', VIEWPORT_CULLING);
  console.log('Performance Flags:', WAVEFORM_PERFORMANCE);
  console.groupEnd();
};

/**
 * Compare all presets and show their characteristics
 */
export const comparePresets = (): void => {
  console.group('📊 Waveform Preset Comparison');
  
  Object.entries(WAVEFORM_DETAIL_PRESET).forEach(([name, config]) => {
    const memoryUsage = estimateWaveformMemoryUsage();
    console.group(`${name} ${name === ACTIVE_WAVEFORM_PRESET ? '✓ (Active)' : ''}`);
    console.log('Max Pixel Width:', config.maxPixelWidth);
    console.log('LOD Thresholds:', config.lodThresholds);
    console.log('Bar Width:', config.barWidthRange);
    console.log('Est. Memory per waveform:', `${memoryUsage.toFixed(2)} MB`);
    console.groupEnd();
  });
  
  console.groupEnd();
};

/**
 * Calculate and display estimated memory usage for a project
 */
export const estimateProjectMemory = (
  audioTrackCount: number,
): void => {
  const memoryPerTrack = estimateWaveformMemoryUsage();
  const totalMemory = memoryPerTrack * audioTrackCount;
  
  console.group('💾 Estimated Memory Usage');
  console.log('Audio Tracks:', audioTrackCount);
  console.log('Memory per Track:', `${memoryPerTrack.toFixed(2)} MB`);
  console.log('Total Memory:', `${totalMemory.toFixed(2)} MB`);
  console.log('Cache Size:', `${LOD_CACHE.MAX_SIZE} waveforms`);
  console.groupEnd();
};

/**
 * Get performance recommendations based on track count
 */
export const getPerformanceRecommendation = (
  audioTrackCount: number,
): {
  recommendedPreset: keyof typeof WAVEFORM_DETAIL_PRESET;
  reason: string;
  estimatedMemory: number;
} => {
  let recommendedPreset: keyof typeof WAVEFORM_DETAIL_PRESET;
  let reason: string;
  
  if (audioTrackCount >= 10) {
    recommendedPreset = 'ULTRA_LOW';
    reason = 'Many tracks detected. Use minimal detail for best performance.';
  } else if (audioTrackCount >= 5) {
    recommendedPreset = 'LOW';
    reason = 'Multiple tracks detected. Use reduced detail for good performance.';
  } else if (audioTrackCount >= 3) {
    recommendedPreset = 'MEDIUM';
    reason = 'Moderate track count. Balanced detail and performance.';
  } else if (audioTrackCount >= 2) {
    recommendedPreset = 'HIGH';
    reason = 'Few tracks. Can afford higher detail.';
  } else {
    recommendedPreset = 'ULTRA_HIGH';
    reason = 'Single track. Maximum detail available.';
  }
  
  const estimatedMemory = estimateWaveformMemoryUsage() * audioTrackCount;
  
  return {
    recommendedPreset,
    reason,
    estimatedMemory,
  };
};

/**
 * Display performance recommendation in console
 */
export const showPerformanceRecommendation = (audioTrackCount: number): void => {
  const recommendation = getPerformanceRecommendation(audioTrackCount);
  
  console.group('💡 Performance Recommendation');
  console.log('Track Count:', audioTrackCount);
  console.log('Current Preset:', ACTIVE_WAVEFORM_PRESET);
  console.log('Recommended Preset:', recommendation.recommendedPreset);
  console.log('Reason:', recommendation.reason);
  console.log('Est. Memory:', `${recommendation.estimatedMemory.toFixed(2)} MB`);
  
  if (ACTIVE_WAVEFORM_PRESET !== recommendation.recommendedPreset) {
    console.warn(
      `⚠️ Consider switching to '${recommendation.recommendedPreset}' preset for better performance.`
    );
    console.log(
      `Edit: src/features/daw/config/waveformConfig.ts`
    );
  } else {
    console.log('✅ Current preset is optimal for your track count.');
  }
  
  console.groupEnd();
};

/**
 * Get LOD level name from pixels per beat
 */
export const getLODLevelName = (pixelsPerBeat: number): string => {
  if (pixelsPerBeat > LOD_THRESHOLDS.LEVEL_3_THRESHOLD) {
    return 'Level 3 (Finest - 2 samples/pixel)';
  } else if (pixelsPerBeat > LOD_THRESHOLDS.LEVEL_2_THRESHOLD) {
    return 'Level 2 (High - 1 sample/pixel)';
  } else if (pixelsPerBeat > LOD_THRESHOLDS.LEVEL_1_THRESHOLD) {
    return 'Level 1 (Medium - 1 sample/2 pixels)';
  } else {
    return 'Level 0 (Coarse - 1 sample/4 pixels)';
  }
};

/**
 * Display current rendering statistics
 */
export const logRenderingStats = (
  pixelsPerBeat: number,
  peakCount: number,
  visiblePeakCount: number,
): void => {
  const lodLevel = getLODLevelName(pixelsPerBeat);
  const cullingActive = visiblePeakCount < peakCount;
  const cullingRatio = ((1 - visiblePeakCount / peakCount) * 100).toFixed(1);
  
  console.group('📈 Rendering Statistics');
  console.log('Pixels per Beat:', pixelsPerBeat.toFixed(2));
  console.log('Active LOD Level:', lodLevel);
  console.log('Total Peaks:', peakCount);
  console.log('Visible Peaks:', visiblePeakCount);
  
  if (cullingActive) {
    console.log('Viewport Culling:', `✅ Active (${cullingRatio}% saved)`);
  } else {
    console.log('Viewport Culling:', '❌ Inactive (all peaks visible)');
  }
  
  console.groupEnd();
};

/**
 * Export configuration as JSON for sharing/debugging
 */
export const exportConfigAsJSON = (): string => {
  const config = getWaveformConfigSummary();
  return JSON.stringify(config, null, 2);
};

/**
 * Check if current configuration is optimal for given constraints
 */
export const validateConfiguration = (
  audioTrackCount: number,
): {
  isOptimal: boolean;
  warnings: string[];
  suggestions: string[];
} => {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  const recommendation = getPerformanceRecommendation(audioTrackCount);
  const estimatedMemory = recommendation.estimatedMemory;
  
  // Check if preset matches recommendation
  if (ACTIVE_WAVEFORM_PRESET !== recommendation.recommendedPreset) {
    warnings.push(
      `Current preset (${ACTIVE_WAVEFORM_PRESET}) may not be optimal for ${audioTrackCount} tracks`
    );
    suggestions.push(
      `Consider switching to '${recommendation.recommendedPreset}' preset`
    );
  }
  
  // Check memory usage
  if (estimatedMemory > 100) {
    warnings.push(`High memory usage estimated: ${estimatedMemory.toFixed(2)} MB`);
    suggestions.push('Consider using a lower detail preset or reducing cache size');
  }
  
  // Check viewport culling
  if (!WAVEFORM_PERFORMANCE.ENABLE_VIEWPORT_CULLING && audioTrackCount > 5) {
    warnings.push('Viewport culling is disabled with many tracks');
    suggestions.push('Enable viewport culling for better performance');
  }
  
  // Check LOD cache
  if (!WAVEFORM_PERFORMANCE.ENABLE_LOD_CACHE) {
    warnings.push('LOD cache is disabled');
    suggestions.push('Enable LOD cache to avoid recomputing waveforms');
  }
  
  const isOptimal = warnings.length === 0;
  
  return {
    isOptimal,
    warnings,
    suggestions,
  };
};

/**
 * Display configuration validation results
 */
export const showConfigurationValidation = (audioTrackCount: number): void => {
  const validation = validateConfiguration(audioTrackCount);
  
  console.group('🔍 Configuration Validation');
  console.log('Track Count:', audioTrackCount);
  console.log('Current Preset:', ACTIVE_WAVEFORM_PRESET);
  
  if (validation.isOptimal) {
    console.log('✅ Configuration is optimal');
  } else {
    console.warn('⚠️ Configuration could be improved');
    
    if (validation.warnings.length > 0) {
      console.group('Warnings:');
      validation.warnings.forEach(warning => console.warn(`• ${warning}`));
      console.groupEnd();
    }
    
    if (validation.suggestions.length > 0) {
      console.group('Suggestions:');
      validation.suggestions.forEach(suggestion => console.log(`• ${suggestion}`));
      console.groupEnd();
    }
  }
  
  console.groupEnd();
};

// Expose helpers to window for easy console access (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).waveformConfig = {
    log: logWaveformConfig,
    compare: comparePresets,
    estimateMemory: estimateProjectMemory,
    recommend: showPerformanceRecommendation,
    validate: showConfigurationValidation,
    export: exportConfigAsJSON,
  };
  
  console.log(
    '💡 Waveform config helpers available: window.waveformConfig',
    '\n  • log() - Show current config',
    '\n  • compare() - Compare all presets',
    '\n  • estimateMemory(trackCount) - Estimate memory usage',
    '\n  • recommend(trackCount) - Get performance recommendation',
    '\n  • validate(trackCount) - Validate configuration',
    '\n  • export() - Export config as JSON'
  );
}
