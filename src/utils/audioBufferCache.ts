/**
 * Shared audio buffer cache for better performance
 * Reduces repeated audio file loading and decoding
 */

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
}

class AudioBufferCache {
  private cache = new Map<string, AudioBuffer>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * Get cached audio buffer or null if not found
   */
  get(key: string): AudioBuffer | null {
    const buffer = this.cache.get(key);
    if (buffer) {
      this.hits++;
      return buffer;
    }
    this.misses++;
    return null;
  }

  /**
   * Set audio buffer in cache with LRU eviction
   */
  set(key: string, buffer: AudioBuffer): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, buffer);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

// Global audio buffer cache instance
export const audioBufferCache = new AudioBufferCache(50);

/**
 * Load audio buffer with caching
 */
export const loadAudioBufferWithCache = async (
  url: string,
  audioContext: AudioContext,
): Promise<AudioBuffer> => {
  // Check cache first
  const cached = audioBufferCache.get(url);
  if (cached) {
    return cached;
  }

  // Load and decode audio
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Cache the result
    audioBufferCache.set(url, audioBuffer);

    return audioBuffer;
  } catch (error) {
    console.error(`Failed to load audio buffer: ${url}`, error);
    throw error;
  }
};

/**
 * Preload audio buffers for better performance
 */
export const preloadAudioBuffers = async (
  urls: string[],
  audioContext: AudioContext,
): Promise<void> => {
  const loadPromises = urls.map((url) =>
    loadAudioBufferWithCache(url, audioContext).catch((error) => {
      console.warn(`Failed to preload audio buffer: ${url}`, error);
    }),
  );

  await Promise.allSettled(loadPromises);
};

/**
 * Get cache statistics for monitoring
 */
export const getAudioBufferCacheStats = (): CacheStats => {
  return audioBufferCache.getStats();
};

/**
 * Clear audio buffer cache
 */
export const clearAudioBufferCache = (): void => {
  audioBufferCache.clear();
};
