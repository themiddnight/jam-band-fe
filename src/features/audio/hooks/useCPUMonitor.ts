import { useState, useEffect, useCallback } from 'react';

interface CPUUsageData {
  usage: number;
  timestamp: number;
  isHigh: boolean;
}

interface UseCPUMonitorOptions {
  enabled?: boolean;
  interval?: number;
  highThreshold?: number;
  onHighUsage?: (usage: number) => void;
}

export function useCPUMonitor({
  enabled = true,
  interval = 5000, // 5 seconds
  highThreshold = 80,
  onHighUsage
}: UseCPUMonitorOptions = {}) {
  const [cpuUsage, setCpuUsage] = useState<number | null>(null);
  const [usageHistory, setUsageHistory] = useState<CPUUsageData[]>([]);
  const [isHigh, setIsHigh] = useState(false);

  // Simple CPU usage estimation based on performance.now() timing
  const measureCPUUsage = useCallback(() => {
    const start = performance.now();
    
    // Simulate some CPU work
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.random();
    }
    // Use result to prevent optimization
    if (result > 1000000) result = 0;
    
    const end = performance.now();
    const duration = end - start;
    
    // Estimate CPU usage based on how long the work takes
    // Lower duration = higher CPU performance = lower usage
    // Higher duration = lower CPU performance = higher usage
    const estimatedUsage = Math.min(100, Math.max(0, (duration - 10) / 2));
    
    return Math.round(estimatedUsage);
  }, []);

  // Get CPU usage from navigator.hardwareConcurrency if available
  const getHardwareInfo = useCallback(() => {
    return {
      cores: navigator.hardwareConcurrency || 'unknown',
      memory: (navigator as any).deviceMemory || 'unknown',
      userAgent: navigator.userAgent
    };
  }, []);

  // Monitor CPU usage
  useEffect(() => {
    if (!enabled) return;

    const measureAndUpdate = () => {
      const usage = measureCPUUsage();
      const timestamp = Date.now();
      const isHighUsage = usage > highThreshold;
      
      setCpuUsage(usage);
      setIsHigh(isHighUsage);
      
      // Add to history
      const newData: CPUUsageData = { usage, timestamp, isHigh: isHighUsage };
      setUsageHistory(prev => {
        const updated = [...prev, newData];
        // Keep only last 20 measurements
        return updated.slice(-20);
      });
      
      // Notify if usage is high
      if (isHighUsage && onHighUsage) {
        onHighUsage(usage);
      }
    };

    // Initial measurement
    measureAndUpdate();
    
    // Set up interval
    const intervalId = setInterval(measureAndUpdate, interval);
    
    return () => clearInterval(intervalId);
  }, [enabled, interval, highThreshold, measureCPUUsage, onHighUsage]);

  // Get average CPU usage from recent measurements
  const getAverageUsage = useCallback(() => {
    if (usageHistory.length === 0) return null;
    
    const recent = usageHistory.slice(-5); // Last 5 measurements
    const sum = recent.reduce((acc, data) => acc + data.usage, 0);
    return Math.round(sum / recent.length);
  }, [usageHistory]);

  // Get CPU usage trend
  const getUsageTrend = useCallback(() => {
    if (usageHistory.length < 2) return 'stable';
    
    const recent = usageHistory.slice(-3);
    const first = recent[0].usage;
    const last = recent[recent.length - 1].usage;
    
    if (last > first + 10) return 'increasing';
    if (last < first - 10) return 'decreasing';
    return 'stable';
  }, [usageHistory]);

  // Get recommendations based on CPU usage
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = [];
    
    if (cpuUsage && cpuUsage > 90) {
      recommendations.push('CPU usage is very high - consider closing other applications');
    } else if (cpuUsage && cpuUsage > 80) {
      recommendations.push('CPU usage is high - audio quality may be reduced');
    } else if (cpuUsage && cpuUsage > 60) {
      recommendations.push('CPU usage is moderate - monitor for performance issues');
    }
    
    const trend = getUsageTrend();
    if (trend === 'increasing') {
      recommendations.push('CPU usage is trending upward - consider reducing audio quality');
    }
    
    return recommendations;
  }, [cpuUsage, getUsageTrend]);

  return {
    // Current state
    cpuUsage,
    isHigh,
    
    // History and analysis
    usageHistory,
    averageUsage: getAverageUsage(),
    usageTrend: getUsageTrend(),
    
    // Hardware info
    hardwareInfo: getHardwareInfo(),
    
    // Recommendations
    recommendations: getRecommendations(),
    
    // Actions
    measureCPUUsage,
    getHardwareInfo
  };
} 