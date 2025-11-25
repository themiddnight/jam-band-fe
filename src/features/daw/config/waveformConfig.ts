/**
 * Waveform Rendering Configuration
 * 
 * Adjust these constants to control waveform detail level and performance.
 * Lower detail = better performance, higher detail = more visual accuracy.
 */

/**
 * WAVEFORM DETAIL PRESETS
 * 
 * Use these presets or customize individual settings below:
 * - ULTRA_LOW: Minimal detail, best performance (recommended for 10+ tracks)
 * - LOW: Reduced detail, good performance (recommended for 5-10 tracks)
 * - MEDIUM: Balanced detail and performance (default, recommended for 3-5 tracks)
 * - HIGH: High detail, moderate performance (recommended for 1-3 tracks)
 * - ULTRA_HIGH: Maximum detail, lower performance (recommended for mastering/final mix)
 */
export const WAVEFORM_DETAIL_PRESET = {
  ULTRA_LOW: {
    maxPixelWidth: 2000,
    lodThresholds: {
      level3: 800,  // Extremely zoomed in
      level2: 300,  // Very zoomed in
      level1: 80,   // Medium zoom
    },
    barWidthRange: { min: 1, max: 3 },
  },
  LOW: {
    maxPixelWidth: 4000,
    lodThresholds: {
      level3: 600,
      level2: 200,
      level1: 60,
    },
    barWidthRange: { min: 0.8, max: 3 },
  },
  MEDIUM: {
    maxPixelWidth: 10000,
    lodThresholds: {
      level3: 400,
      level2: 150,
      level1: 40,
    },
    barWidthRange: { min: 0.5, max: 2 },
  },
  HIGH: {
    maxPixelWidth: 15000,
    lodThresholds: {
      level3: 300,
      level2: 100,
      level1: 30,
    },
    barWidthRange: { min: 0.3, max: 2 },
  },
  ULTRA_HIGH: {
    maxPixelWidth: 20000,
    lodThresholds: {
      level3: 200,
      level2: 80,
      level1: 20,
    },
    barWidthRange: { min: 0.2, max: 1.5 },
  },
} as const;

/**
 * ACTIVE PRESET
 * 
 * Change this to switch between presets:
 * 'ULTRA_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA_HIGH'
 * 
 * Note: This is now controlled by the performance settings store.
 * This default is used as a fallback.
 */
export const ACTIVE_WAVEFORM_PRESET: keyof typeof WAVEFORM_DETAIL_PRESET = 'MEDIUM'

/**
 * Get active configuration based on quality setting
 * Maps performance store quality to waveform presets
 */
export const getActiveConfig = (quality?: "low" | "medium" | "high") => {
  if (!quality) {
    return WAVEFORM_DETAIL_PRESET[ACTIVE_WAVEFORM_PRESET];
  }
  
  const qualityMap: Record<"low" | "medium" | "high", keyof typeof WAVEFORM_DETAIL_PRESET> = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
  };
  
  return WAVEFORM_DETAIL_PRESET[qualityMap[quality]];
};

/**
 * Get max pixel width based on quality setting
 */
export const getMaxPixelWidthForQuality = (quality?: "low" | "medium" | "high"): number => {
  const config = getActiveConfig(quality);
  return config.maxPixelWidth;
};

// Get active configuration (default fallback)
const activeConfig = WAVEFORM_DETAIL_PRESET[ACTIVE_WAVEFORM_PRESET];

/**
 * Maximum expected width in pixels for waveform rendering
 * Lower values = less detail but better performance
 * 
 * Recommended values:
 * - 2000-4000: Low detail, best performance
 * - 5000-10000: Medium detail, balanced (default)
 * - 15000-20000: High detail, lower performance
 */
export const MAX_WAVEFORM_PIXEL_WIDTH = activeConfig.maxPixelWidth;

/**
 * LOD Level Selection Thresholds (pixels per beat)
 * These control when to switch between detail levels
 * 
 * Higher values = switch to higher detail at lower zoom levels
 * Lower values = stay at lower detail longer (better performance)
 */
export const LOD_THRESHOLDS = {
  /**
   * Threshold for Level 3 (finest detail - 2 samples per pixel)
   * Only use at extreme zoom levels
   */
  LEVEL_3_THRESHOLD: activeConfig.lodThresholds.level3,

  /**
   * Threshold for Level 2 (high detail - 1 sample per pixel)
   * Use for detailed editing
   */
  LEVEL_2_THRESHOLD: activeConfig.lodThresholds.level2,

  /**
   * Threshold for Level 1 (medium detail - 1 sample per 2 pixels)
   * Use for normal viewing
   */
  LEVEL_1_THRESHOLD: activeConfig.lodThresholds.level1,

  /**
   * Below this threshold, use Level 0 (coarse detail - 1 sample per 4 pixels)
   * Use when zoomed out
   */
};

/**
 * Waveform bar width constraints
 * Controls the visual thickness of waveform bars
 */
export const WAVEFORM_BAR_WIDTH = {
  /**
   * Minimum bar width in pixels
   * Prevents bars from becoming invisible
   */
  MIN: activeConfig.barWidthRange.min,

  /**
   * Maximum bar width in pixels
   * Prevents overdraw and performance issues
   */
  MAX: activeConfig.barWidthRange.max,
};

/**
 * Viewport culling configuration
 * Controls when to skip rendering off-screen waveform sections
 */
export const VIEWPORT_CULLING = {
  /**
   * Only apply culling when visible peaks are less than this ratio of total
   * Lower values = more aggressive culling = better performance
   * Higher values = less culling = smoother scrolling
   * 
   * Recommended: 0.5-0.8
   */
  VISIBLE_RATIO_THRESHOLD: 0.5,

  /**
   * Minimum peak count to consider culling
   * Below this, culling overhead isn't worth it
   */
  MIN_PEAK_COUNT: 500,

  /**
   * Buffer percentage for viewport culling (0.0 - 1.0)
   * Adds extra rendering area around visible viewport
   * 
   * Lower values = better performance but may show blank areas during fast scrolling
   * Higher values = smoother scrolling but more rendering overhead
   */
  BUFFER_PERCENTAGE: 0.1, // 10% buffer
};

/**
 * LOD Cache configuration
 */
export const LOD_CACHE = {
  /**
   * Maximum number of waveforms to cache
   * Higher values = more memory usage but less recomputation
   */
  MAX_SIZE: 20,
};

/**
 * Performance optimization flags
 */
export const WAVEFORM_PERFORMANCE = {
  /**
   * Enable viewport culling (skip rendering off-screen sections)
   * Recommended: true for better performance
   */
  ENABLE_VIEWPORT_CULLING: true,

  /**
   * Enable LOD caching
   * Recommended: true to avoid recomputing waveforms
   */
  ENABLE_LOD_CACHE: true,

  /**
   * Minimum peak count to use optimized rendering
   * Below this, use simple rendering
   */
  OPTIMIZED_RENDERING_THRESHOLD: 50,
};

/**
 * Helper function to get current configuration summary
 */
export const getWaveformConfigSummary = () => {
  return {
    preset: ACTIVE_WAVEFORM_PRESET,
    maxPixelWidth: MAX_WAVEFORM_PIXEL_WIDTH,
    lodThresholds: LOD_THRESHOLDS,
    barWidth: WAVEFORM_BAR_WIDTH,
    viewportCulling: VIEWPORT_CULLING,
    performance: WAVEFORM_PERFORMANCE,
  };
};

/**
 * Helper function to estimate memory usage per waveform
 * Returns approximate memory in MB
 * 
 * Note: Memory usage is based on LOD levels, not duration.
 */
export const estimateWaveformMemoryUsage = (): number => {
  // Each LOD level stores min/max pairs as Float32Array
  // 4 LOD levels, each with different sample counts
  const level0Samples = Math.ceil(MAX_WAVEFORM_PIXEL_WIDTH / 4);
  const level1Samples = Math.ceil(MAX_WAVEFORM_PIXEL_WIDTH / 2);
  const level2Samples = MAX_WAVEFORM_PIXEL_WIDTH;
  const level3Samples = MAX_WAVEFORM_PIXEL_WIDTH * 2;

  const totalSamples = level0Samples + level1Samples + level2Samples + level3Samples;

  // Each sample is 2 floats (min/max), each float is 4 bytes
  const bytesPerSample = 2 * 4;
  const totalBytes = totalSamples * bytesPerSample;

  return totalBytes / (1024 * 1024); // Convert to MB
};
