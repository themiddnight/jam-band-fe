import {
  ADAPTIVE_AUDIO_CONFIG,
  getAdaptiveAudioConfig,
  shouldReduceQuality,
  getPerformanceMetrics,
} from "../constants/audioConfig";

export interface AdaptiveAudioState {
  currentConfig: typeof ADAPTIVE_AUDIO_CONFIG.SMALL_MESH;
  userCount: number;
  currentLatency: number | null;
  cpuUsage: number | null;
  quality: "ultra-low-latency" | "balanced" | "stable";
  lastAdjustment: number;
  performanceHistory: Array<{
    timestamp: number;
    latency: number;
    cpuUsage: number;
    userCount: number;
    quality: string;
  }>;
}

export class AdaptiveAudioManager {
  private state: AdaptiveAudioState;
  private audioContext: AudioContext | null = null;
  private adjustmentInterval: number | null = null;
  private performanceMonitorInterval: number | null = null;
  private onConfigChange:
    | ((config: typeof ADAPTIVE_AUDIO_CONFIG.SMALL_MESH) => void)
    | null = null;

  constructor() {
    this.state = {
      currentConfig: ADAPTIVE_AUDIO_CONFIG.SMALL_MESH,
      userCount: 0,
      currentLatency: null,
      cpuUsage: null,
      quality: "ultra-low-latency",
      lastAdjustment: Date.now(),
      performanceHistory: [],
    };
  }

  // Initialize the adaptive audio manager
  public initialize(
    audioContext: AudioContext,
    onConfigChange?: (config: typeof ADAPTIVE_AUDIO_CONFIG.SMALL_MESH) => void,
  ) {
    this.audioContext = audioContext;
    this.onConfigChange = onConfigChange || null;

    // Start performance monitoring
    this.startPerformanceMonitoring();

    console.log("🎵 AdaptiveAudioManager initialized");
  }

  // Update user count and automatically adjust configuration
  public updateUserCount(userCount: number) {
    const previousConfig = this.state.currentConfig;
    this.state.userCount = userCount;

    // Get new configuration based on user count
    const newConfig = getAdaptiveAudioConfig(userCount);

    // Only adjust if configuration actually changed
    if (newConfig.quality !== this.state.currentConfig.quality) {
      this.state.currentConfig = newConfig;
      this.state.quality = newConfig.quality as
        | "ultra-low-latency"
        | "balanced"
        | "stable";
      this.state.lastAdjustment = Date.now();

      // Apply new configuration
      this.applyConfiguration(newConfig);

      // Log the adjustment
      console.log(
        `🎵 Audio quality adjusted: ${previousConfig.quality} → ${newConfig.quality} (${userCount} users)`,
      );
      console.log(
        `📊 New config: ${newConfig.description} (target: ${newConfig.latencyTarget})`,
      );
    }
  }

  // Update current latency for performance monitoring
  public updateLatency(latency: number) {
    this.state.currentLatency = latency;
    this.checkPerformanceThresholds();
  }

  // Update CPU usage for performance monitoring
  public updateCPUUsage(cpuUsage: number) {
    this.state.cpuUsage = cpuUsage;
    this.checkPerformanceThresholds();
  }

  // Check if we need to reduce quality based on performance
  private checkPerformanceThresholds() {
    if (!this.state.currentLatency || !this.state.cpuUsage) return;

    const shouldReduce = shouldReduceQuality(
      this.state.userCount,
      this.state.currentLatency,
      this.state.cpuUsage,
    );

    if (shouldReduce) {
      this.reduceQuality();
    }
  }

  // Reduce quality when performance is poor
  private reduceQuality() {
    const currentQuality = this.state.quality;
    let newConfig = this.state.currentConfig;

    // Reduce quality by one level
    if (currentQuality === "ultra-low-latency") {
      newConfig = ADAPTIVE_AUDIO_CONFIG.MEDIUM_MESH;
    } else if (currentQuality === "balanced") {
      newConfig = ADAPTIVE_AUDIO_CONFIG.LARGE_MESH;
    }
    // If already at 'stable', can't reduce further

    if (newConfig.quality !== currentQuality) {
      this.state.currentConfig = newConfig;
      this.state.quality = newConfig.quality as
        | "ultra-low-latency"
        | "balanced"
        | "stable";
      this.state.lastAdjustment = Date.now();

      // Apply new configuration
      this.applyConfiguration(newConfig);

      console.log(
        `⚠️ Quality reduced due to performance: ${currentQuality} → ${newConfig.quality}`,
      );
      console.log(
        `📊 New config: ${newConfig.description} (target: ${newConfig.latencyTarget})`,
      );
    }
  }

  // Apply audio configuration to the audio context
  private applyConfiguration(config: typeof ADAPTIVE_AUDIO_CONFIG.SMALL_MESH) {
    if (!this.audioContext) return;

    try {
      // Note: Some of these properties might not be directly settable on AudioContext
      // In a real implementation, you'd need to recreate the context or use workarounds

      // For now, we'll log what we would apply
      console.log(`🔧 Applying audio configuration:`, {
        sampleSize: config.sampleSize,
        bufferSize: config.bufferSize,
        lookAhead: config.lookAhead,
        updateInterval: config.updateInterval,
      });

      // Notify listeners of configuration change
      if (this.onConfigChange) {
        this.onConfigChange(config);
      }
    } catch (error) {
      console.warn("Failed to apply audio configuration:", error);
    }
  }

  // Start performance monitoring
  private startPerformanceMonitoring() {
    // Monitor performance every 10 seconds
    this.performanceMonitorInterval = window.setInterval(() => {
      this.recordPerformanceMetrics();
    }, 10000);
  }

  // Record performance metrics for analysis
  private recordPerformanceMetrics() {
    const metrics = {
      timestamp: Date.now(),
      latency: this.state.currentLatency || 0,
      cpuUsage: this.state.cpuUsage || 0,
      userCount: this.state.userCount,
      quality: this.state.quality,
    };

    this.state.performanceHistory.push(metrics);

    // Keep only last 100 measurements
    if (this.state.performanceHistory.length > 100) {
      this.state.performanceHistory = this.state.performanceHistory.slice(-100);
    }

    // Log performance summary
    this.logPerformanceSummary();
  }

  // Log performance summary
  private logPerformanceSummary() {
    const recentMetrics = this.state.performanceHistory.slice(-10);
    const avgLatency =
      recentMetrics.reduce((sum, m) => sum + m.latency, 0) /
      recentMetrics.length;
    const avgCPU =
      recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) /
      recentMetrics.length;

    console.log(`📊 Performance Summary (last 10 measurements):`, {
      avgLatency: `${avgLatency.toFixed(1)}ms`,
      avgCPU: `${avgCPU.toFixed(1)}%`,
      currentQuality: this.state.quality,
      userCount: this.state.userCount,
      targetLatency: this.state.currentConfig.latencyTarget,
    });
  }

  // Get current configuration
  public getCurrentConfig() {
    return this.state.currentConfig;
  }

  // Get current state
  public getCurrentState() {
    return { ...this.state };
  }

  // Get performance metrics
  public getPerformanceMetrics() {
    return getPerformanceMetrics();
  }

  // Get configuration recommendations
  public getRecommendations() {
    const recommendations = [];

    if (
      this.state.currentLatency &&
      this.state.currentLatency >
        parseFloat(this.state.currentConfig.latencyTarget.split("-")[1])
    ) {
      recommendations.push(
        `Latency (${this.state.currentLatency}ms) exceeds target (${this.state.currentConfig.latencyTarget})`,
      );
    }

    if (this.state.cpuUsage && this.state.cpuUsage > 80) {
      recommendations.push(`CPU usage (${this.state.cpuUsage}%) is high`);
    }

    if (this.state.userCount > 6) {
      recommendations.push(
        `Large mesh (${this.state.userCount} users) - consider reducing quality for stability`,
      );
    }

    return recommendations;
  }

  // Cleanup
  public cleanup() {
    if (this.adjustmentInterval) {
      clearInterval(this.adjustmentInterval);
      this.adjustmentInterval = null;
    }

    if (this.performanceMonitorInterval) {
      clearInterval(this.performanceMonitorInterval);
      this.performanceMonitorInterval = null;
    }

    console.log("🎵 AdaptiveAudioManager cleaned up");
  }
}

// Export singleton instance
export const adaptiveAudioManager = new AdaptiveAudioManager();
