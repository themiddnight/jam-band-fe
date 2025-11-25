/**
 * Progressive Waveform Renderer with Multi-Resolution LOD
 * 
 * Based on architectural research for handling large audio files (10+ mins, 50+ MB)
 * Implements viewport-based rendering with MinMax sampling for accurate dynamic range
 * 
 * Configuration: See src/features/daw/config/waveformConfig.ts to adjust detail levels
 */

import {
  MAX_WAVEFORM_PIXEL_WIDTH,
  LOD_THRESHOLDS,
  WAVEFORM_BAR_WIDTH,
  VIEWPORT_CULLING,
  LOD_CACHE,
  WAVEFORM_PERFORMANCE,
  getMaxPixelWidthForQuality,
} from '../config/waveformConfig';

export interface WaveformLOD {
  samplesPerPixel: number;
  peaks: Float32Array; // Interleaved min/max pairs
}

export interface WaveformLODData {
  levels: WaveformLOD[];
  duration: number;
  sampleRate: number;
}

/**
 * Compute MinMax peaks for a given resolution
 * Each peak is a pair: [min, max] to preserve dynamic range
 */
const computeMinMaxPeaks = (
  channelData: Float32Array,
  targetSamples: number,
): Float32Array => {
  const sourceLength = channelData.length;
  if (sourceLength === 0 || targetSamples <= 0) {
    return new Float32Array(0);
  }

  // Ensure we don't request more samples than we have
  const actualTargetSamples = Math.min(targetSamples, sourceLength);
  
  // Each sample needs min and max, so double the array size
  const peaks = new Float32Array(actualTargetSamples * 2);
  const blockSize = Math.max(1, Math.floor(sourceLength / actualTargetSamples));

  for (let i = 0; i < actualTargetSamples; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, sourceLength);
    let min = 0;
    let max = 0;

    // Ensure we have at least one sample in the block
    if (end > start) {
      min = channelData[start];
      max = channelData[start];
      
      for (let j = start; j < end; j++) {
        const value = channelData[j];
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }

    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }

  return peaks;
};

/**
 * Generate multi-resolution LOD data for progressive rendering
 * Creates multiple levels of detail for smooth zooming
 * 
 * Uses MAX_WAVEFORM_PIXEL_WIDTH from config to control detail level
 */
export const generateWaveformLOD = (
  audioBuffer: AudioBuffer,
  maxPixelWidth: number = MAX_WAVEFORM_PIXEL_WIDTH,
): WaveformLODData => {
  const channelData = new Float32Array(audioBuffer.length);
  audioBuffer.copyFromChannel(channelData, 0);

  const duration = audioBuffer.duration;
  const sampleRate = audioBuffer.sampleRate;

  // Generate LOD levels: from coarse to fine
  // Level 0: Very zoomed out (1 sample per 4 pixels)
  // Level 1: Medium zoom (1 sample per 2 pixels)
  // Level 2: Zoomed in (1 sample per pixel)
  // Level 3: Maximum detail (2 samples per pixel)
  const lodLevels: WaveformLOD[] = [
    {
      samplesPerPixel: 4,
      peaks: computeMinMaxPeaks(channelData, Math.ceil(maxPixelWidth / 4)),
    },
    {
      samplesPerPixel: 2,
      peaks: computeMinMaxPeaks(channelData, Math.ceil(maxPixelWidth / 2)),
    },
    {
      samplesPerPixel: 1,
      peaks: computeMinMaxPeaks(channelData, maxPixelWidth),
    },
    {
      samplesPerPixel: 0.5,
      peaks: computeMinMaxPeaks(channelData, maxPixelWidth * 2),
    },
  ];

  return {
    levels: lodLevels,
    duration,
    sampleRate,
  };
};

/**
 * Select appropriate LOD level based on current zoom and pixel width
 * 
 * Uses LOD_THRESHOLDS from config to control when to switch detail levels
 */
export const selectLODLevel = (
  lodData: WaveformLODData,
  pixelWidth: number,
  durationBeats: number,
): WaveformLOD => {
  if (!lodData.levels || lodData.levels.length === 0) {
    throw new Error('No LOD levels available');
  }

  // If pixel width is very small, use the coarsest level
  if (pixelWidth < 10) {
    return lodData.levels[0];
  }

  // Calculate how many pixels per beat we have
  const pixelsPerBeat = pixelWidth / durationBeats;
  
  // Select LOD based on pixel density using configurable thresholds
  // More pixels per beat = more zoomed in = need higher detail
  let selectedLevel = lodData.levels[0]; // Default to coarsest
  
  if (pixelsPerBeat > LOD_THRESHOLDS.LEVEL_3_THRESHOLD) {
    // Extremely zoomed in - use finest detail (Level 3)
    // Only use this for very high zoom where detail is critical
    selectedLevel = lodData.levels[3] || lodData.levels[lodData.levels.length - 1];
  } else if (pixelsPerBeat > LOD_THRESHOLDS.LEVEL_2_THRESHOLD) {
    // Very zoomed in - use high detail (Level 2)
    // This is sufficient for most editing tasks
    selectedLevel = lodData.levels[2] || lodData.levels[lodData.levels.length - 1];
  } else if (pixelsPerBeat > LOD_THRESHOLDS.LEVEL_1_THRESHOLD) {
    // Medium zoom - use medium detail (Level 1)
    selectedLevel = lodData.levels[1] || lodData.levels[0];
  } else {
    // Zoomed out - use coarse detail (Level 0)
    selectedLevel = lodData.levels[0];
  }

  return selectedLevel;
};

/**
 * Extract visible peaks from LOD data based on viewport
 */
export const extractVisiblePeaks = (
  lodLevel: WaveformLOD,
  trimStart: number,
  length: number,
  originalLength: number,
): Float32Array => {
  const peaks = lodLevel.peaks;
  if (!peaks || peaks.length === 0) {
    return new Float32Array(0);
  }

  // Ensure we have valid parameters
  if (originalLength <= 0 || length <= 0) {
    return new Float32Array(0);
  }

  // Calculate which part of the waveform to show based on trim
  const trimRatio = Math.max(0, Math.min(1, trimStart / originalLength));
  const lengthRatio = Math.max(0, Math.min(1, length / originalLength));
  
  // Each peak is a min/max pair, so divide by 2 for actual peak count
  const peakCount = Math.floor(peaks.length / 2);
  
  if (peakCount === 0) {
    return new Float32Array(0);
  }

  const startIdx = Math.floor(trimRatio * peakCount);
  const endIdx = Math.min(
    peakCount,
    Math.max(startIdx + 1, Math.ceil((trimRatio + lengthRatio) * peakCount)),
  );

  // Ensure we have valid indices
  if (startIdx >= peakCount || endIdx <= startIdx) {
    return new Float32Array(0);
  }

  // Extract the visible portion (remember each peak is 2 values)
  const result = peaks.subarray(startIdx * 2, endIdx * 2);
  
  // Ensure we return at least some data
  if (result.length === 0 && peaks.length > 0) {
    // Return first few peaks as fallback
    return peaks.subarray(0, Math.min(20, peaks.length));
  }
  
  return result;
};

/**
 * Extract peaks for a specific viewport range (for scrollable editors)
 * This allows rendering only the visible portion when zoomed in
 */
export const extractViewportPeaks = (
  lodLevel: WaveformLOD,
  viewportStartBeat: number,
  viewportEndBeat: number,
  totalBeats: number,
): Float32Array => {
  const peaks = lodLevel.peaks;
  if (!peaks || peaks.length === 0) {
    return new Float32Array(0);
  }

  // Ensure we have valid parameters
  if (totalBeats <= 0 || viewportEndBeat <= viewportStartBeat) {
    return peaks; // Return all peaks if invalid viewport
  }

  // Calculate viewport ratios
  const startRatio = Math.max(0, Math.min(1, viewportStartBeat / totalBeats));
  const endRatio = Math.max(0, Math.min(1, viewportEndBeat / totalBeats));
  
  // Each peak is a min/max pair, so divide by 2 for actual peak count
  const peakCount = Math.floor(peaks.length / 2);
  
  if (peakCount === 0) {
    return new Float32Array(0);
  }

  // Add small buffer to avoid edge artifacts
  const bufferRatio = 0.05; // 5% buffer on each side
  const bufferedStartRatio = Math.max(0, startRatio - bufferRatio);
  const bufferedEndRatio = Math.min(1, endRatio + bufferRatio);

  const startIdx = Math.floor(bufferedStartRatio * peakCount);
  const endIdx = Math.min(peakCount, Math.ceil(bufferedEndRatio * peakCount));

  // Ensure we have valid indices
  if (startIdx >= peakCount || endIdx <= startIdx) {
    return peaks; // Return all peaks if invalid range
  }

  // Extract the visible portion (remember each peak is 2 values)
  return peaks.subarray(startIdx * 2, endIdx * 2);
};

/**
 * Calculate adaptive buffer size based on zoom level
 * Higher zoom = smaller buffer (less off-screen rendering)
 * Lower zoom = larger buffer (smoother scrolling)
 */
export const calculateAdaptiveBuffer = (
  pixelsPerBeat: number,
  containerWidth: number,
): number => {
  // At high zoom (>300 ppb), use smaller buffer (10%)
  if (pixelsPerBeat > 300) {
    return containerWidth * 0.1;
  }
  // At medium zoom (100-300 ppb), use medium buffer (15%)
  else if (pixelsPerBeat > 100) {
    return containerWidth * 0.15;
  }
  // At low zoom (<100 ppb), use larger buffer (20%)
  else {
    return containerWidth * 0.2;
  }
};

/**
 * Check if viewport culling should be applied
 * Only cull when zoomed in enough that it provides benefit
 * 
 * Uses VIEWPORT_CULLING config to control culling behavior
 * Can be overridden by passing enableCulling parameter
 */
export const shouldApplyViewportCulling = (
  peakCount: number,
  visiblePeakCount: number,
  enableCulling: boolean = WAVEFORM_PERFORMANCE.ENABLE_VIEWPORT_CULLING,
): boolean => {
  if (!enableCulling) {
    return false;
  }

  // Only cull if we're rendering less than threshold % of total peaks
  // Below this threshold, culling overhead isn't worth it
  const visibleRatio = visiblePeakCount / peakCount;
  return (
    visibleRatio < VIEWPORT_CULLING.VISIBLE_RATIO_THRESHOLD &&
    peakCount > VIEWPORT_CULLING.MIN_PEAK_COUNT
  );
};

/**
 * Cache for LOD data to avoid recomputation
 * 
 * Uses LOD_CACHE config to control cache size
 */
class WaveformLODCache {
  private cache = new Map<string, WaveformLODData>();
  private maxSize = LOD_CACHE.MAX_SIZE;

  get(key: string): WaveformLODData | undefined {
    if (!WAVEFORM_PERFORMANCE.ENABLE_LOD_CACHE) {
      return undefined;
    }
    return this.cache.get(key);
  }

  set(key: string, data: WaveformLODData): void {
    if (!WAVEFORM_PERFORMANCE.ENABLE_LOD_CACHE) {
      return;
    }

    // Simple LRU: if cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, data);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const waveformLODCache = new WaveformLODCache();

/**
 * Get or generate LOD data for an audio buffer
 * 
 * Uses MAX_WAVEFORM_PIXEL_WIDTH from config as default
 * Pass quality parameter to use performance settings
 */
export const getOrGenerateLOD = (
  audioBuffer: AudioBuffer,
  regionId: string,
  maxPixelWidth: number = MAX_WAVEFORM_PIXEL_WIDTH,
  quality?: "low" | "medium" | "high",
): WaveformLODData => {
  // If quality is specified, use it to determine max pixel width
  if (quality) {
    maxPixelWidth = getMaxPixelWidthForQuality(quality);
  }

  // Create a cache key that includes quality setting
  const cacheKey = quality ? `${regionId}_${quality}` : regionId;
  
  const cached = waveformLODCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const lodData = generateWaveformLOD(audioBuffer, maxPixelWidth);
  waveformLODCache.set(cacheKey, lodData);
  return lodData;
};

/**
 * Calculate optimal rendering strategy based on peak count
 * Returns whether to use Shape rendering (efficient) or fallback to simple rect
 * 
 * Uses WAVEFORM_PERFORMANCE config to control threshold
 */
export const shouldUseOptimizedRendering = (peakCount: number): boolean => {
  // Use optimized rendering for any significant number of peaks
  // Even 100 peaks benefit from single-pass rendering vs individual components
  return peakCount > WAVEFORM_PERFORMANCE.OPTIMIZED_RENDERING_THRESHOLD;
};

/**
 * Calculate optimal bar width to prevent overdraw
 * When bars are too wide, they overlap and cause overdraw
 * 
 * Uses WAVEFORM_BAR_WIDTH config for min/max constraints
 */
export const calculateOptimalBarWidth = (
  totalWidth: number,
  peakCount: number,
  minWidth: number = WAVEFORM_BAR_WIDTH.MIN,
  maxWidth: number = WAVEFORM_BAR_WIDTH.MAX,
): number => {
  const calculatedWidth = totalWidth / peakCount;
  
  // Clamp between min and max to prevent:
  // - Too thin: invisible bars
  // - Too wide: overdraw and performance issues
  return Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
};

/**
 * Get rendering statistics for debugging/monitoring
 */
export const getRenderingStats = (
  lodData: WaveformLODData,
  selectedLevel: WaveformLOD,
  visiblePeaks: Float32Array,
): {
  totalSamples: number;
  selectedLevelSamplesPerPixel: number;
  visiblePeakCount: number;
  compressionRatio: number;
} => {
  const totalSamples = lodData.sampleRate * lodData.duration;
  const visiblePeakCount = Math.floor(visiblePeaks.length / 2);
  const compressionRatio = totalSamples / Math.max(visiblePeakCount, 1);

  return {
    totalSamples,
    selectedLevelSamplesPerPixel: selectedLevel.samplesPerPixel,
    visiblePeakCount,
    compressionRatio,
  };
};
