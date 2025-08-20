/**
 * Enhanced audio buffer cache for better performance with compression and streaming
 * Optimized for smplr soundfonts, Tone.js, and future effects processing
 */

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  memoryUsage: number; // in bytes
}

interface CachedBuffer {
  buffer: AudioBuffer;
  lastAccessed: number;
  accessCount: number;
  size: number; // buffer size in bytes
  compressed?: boolean;
}

class EnhancedAudioBufferCache {
  private cache = new Map<string, CachedBuffer>();
  private readonly maxSize: number;
  private readonly maxMemoryMB: number;
  private hits = 0;
  private misses = 0;
  private currentMemoryUsage = 0;

  constructor(maxSize: number = 50, maxMemoryMB: number = 100) {
    this.maxSize = maxSize;
    this.maxMemoryMB = maxMemoryMB;
  }

  /**
   * Get cached audio buffer or null if not found
   */
  get(key: string): AudioBuffer | null {
    const cached = this.cache.get(key);
    if (cached) {
      this.hits++;
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      return cached.buffer;
    }
    this.misses++;
    return null;
  }

  /**
   * Set audio buffer in cache with intelligent eviction
   */
  set(key: string, buffer: AudioBuffer, compressed: boolean = false): void {
    const bufferSize = this.calculateBufferSize(buffer);
    
    // Check if we need to free memory
    this.ensureMemoryAvailable(bufferSize);
    
    const cached: CachedBuffer = {
      buffer,
      lastAccessed: Date.now(),
      accessCount: 1,
      size: bufferSize,
      compressed
    };

    // Remove existing entry if updating
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentMemoryUsage -= existing.size;
    }

    this.cache.set(key, cached);
    this.currentMemoryUsage += bufferSize;

    console.log(`🎵 AudioCache: Cached ${key} (${(bufferSize / 1024 / 1024).toFixed(1)}MB, compressed: ${compressed})`);
  }

  /**
   * Preload multiple buffers with priority and streaming support
   */
  async preloadBuffers(
    urls: { url: string; priority: number }[], 
    audioContext: AudioContext,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    // Sort by priority (higher priority first)
    const sortedUrls = urls.sort((a, b) => b.priority - a.priority);
    
    let loaded = 0;
    const total = urls.length;

    // Load high priority items first (priority >= 8)
    const highPriority = sortedUrls.filter(item => item.priority >= 8);
    const mediumPriority = sortedUrls.filter(item => item.priority >= 5 && item.priority < 8);
    const lowPriority = sortedUrls.filter(item => item.priority < 5);

    // Load high priority items immediately
    await Promise.all(
      highPriority.map(async ({ url }) => {
        try {
          await this.loadAudioBufferWithCache(url, audioContext);
          loaded++;
          onProgress?.(loaded, total);
        } catch (error) {
          console.warn(`Failed to preload high priority buffer: ${url}`, error);
        }
      })
    );

    // Load medium priority with slight delay
    setTimeout(async () => {
      await Promise.all(
        mediumPriority.map(async ({ url }) => {
          try {
            await this.loadAudioBufferWithCache(url, audioContext);
            loaded++;
            onProgress?.(loaded, total);
          } catch (error) {
            console.warn(`Failed to preload medium priority buffer: ${url}`, error);
          }
        })
      );
    }, 100);

    // Load low priority items last
    setTimeout(async () => {
      await Promise.all(
        lowPriority.map(async ({ url }) => {
          try {
            await this.loadAudioBufferWithCache(url, audioContext);
            loaded++;
            onProgress?.(loaded, total);
          } catch (error) {
            console.warn(`Failed to preload low priority buffer: ${url}`, error);
          }
        })
      );
    }, 500);
  }

  /**
   * Load audio buffer with caching and optional compression
   */
  private async loadAudioBufferWithCache(
    url: string,
    audioContext: AudioContext,
    enableCompression: boolean = false
  ): Promise<AudioBuffer> {
    // Check cache first
    const cached = this.get(url);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      let audioBuffer: AudioBuffer;
      
      if (enableCompression && arrayBuffer.byteLength > 1024 * 1024) { // 1MB threshold
        // For large files, consider using compressed audio formats or chunked loading
        audioBuffer = await this.decodeWithOptimization(arrayBuffer, audioContext);
      } else {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      }

      // Cache the result
      this.set(url, audioBuffer, enableCompression);
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load audio buffer: ${url}`, error);
      throw error;
    }
  }

  /**
   * Decode audio with optimization for large files
   */
  private async decodeWithOptimization(arrayBuffer: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
    // For future implementation: could add audio compression or streaming
    // For now, use standard decoding
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Calculate buffer size in bytes
   */
  private calculateBufferSize(buffer: AudioBuffer): number {
    return buffer.length * buffer.numberOfChannels * 4; // 32-bit float = 4 bytes
  }

  /**
   * Ensure memory is available by evicting least recently used items
   */
  private ensureMemoryAvailable(requiredSize: number): void {
    const maxMemoryBytes = this.maxMemoryMB * 1024 * 1024;
    
    while (
      (this.currentMemoryUsage + requiredSize > maxMemoryBytes || 
       this.cache.size >= this.maxSize) &&
      this.cache.size > 0
    ) {
      this.evictLeastRecentlyUsed();
    }
  }

  /**
   * Evict the least recently used item
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let lowestScore = Infinity;

    // Find item with lowest score (combines recency and access count)
    for (const [key, cached] of this.cache.entries()) {
      const score = cached.accessCount / (Date.now() - cached.lastAccessed + 1);
      if (score < lowestScore) {
        lowestScore = score;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const evicted = this.cache.get(oldestKey)!;
      this.currentMemoryUsage -= evicted.size;
      this.cache.delete(oldestKey);
      console.log(`🗑️ AudioCache: Evicted ${oldestKey} (${(evicted.size / 1024 / 1024).toFixed(1)}MB)`);
    }
  }

  /**
   * Get enhanced cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: this.currentMemoryUsage,
    };
  }

  /**
   * Clear cache and reset statistics
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.currentMemoryUsage = 0;
  }

  /**
   * Remove expired entries (older than specified time)
   */
  cleanupExpired(maxAgeMs: number = 30 * 60 * 1000): void { // 30 minutes default
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.lastAccessed > maxAgeMs) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => {
      const cached = this.cache.get(key)!;
      this.currentMemoryUsage -= cached.size;
      this.cache.delete(key);
    });

    if (toDelete.length > 0) {
      console.log(`🧹 AudioCache: Cleaned up ${toDelete.length} expired entries`);
    }
  }
}

// Global enhanced audio buffer cache instance
export const audioBufferCache = new EnhancedAudioBufferCache(100, 150); // 100 items, 150MB max

/**
 * Load audio buffer with enhanced caching
 */
export const loadAudioBufferWithCache = async (
  url: string,
  audioContext: AudioContext,
): Promise<AudioBuffer> => {
  return await (audioBufferCache as any).loadAudioBufferWithCache(url, audioContext);
};

/**
 * Preload audio buffers with priority support
 */
export const preloadAudioBuffers = async (
  urls: string[] | { url: string; priority: number }[],
  audioContext: AudioContext,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> => {
  // Convert simple string array to priority array
  const urlsWithPriority = urls.map(item => 
    typeof item === 'string' ? { url: item, priority: 5 } : item
  );
  
  await audioBufferCache.preloadBuffers(urlsWithPriority, audioContext, onProgress);
};

/**
 * Get enhanced cache statistics
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

/**
 * Start automatic cache cleanup
 */
export const startCacheCleanup = (intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout => {
  return setInterval(() => {
    audioBufferCache.cleanupExpired();
  }, intervalMs);
};
