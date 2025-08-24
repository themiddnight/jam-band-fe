import React, { useEffect, useState } from 'react';
import { getSequencerWorker } from '../services/SequencerWorkerService';

interface PerformanceStats {
  isWorkerReady: boolean;
  pendingRequests: number;
  mainThreadFps: number;
  lastUpdateTime: number;
}

interface SequencerPerformanceMonitorProps {
  isVisible?: boolean;
  className?: string;
}

export const SequencerPerformanceMonitor: React.FC<SequencerPerformanceMonitorProps> = ({
  isVisible = false,
  className = ''
}) => {
  const [stats, setStats] = useState<PerformanceStats>({
    isWorkerReady: false,
    pendingRequests: 0,
    mainThreadFps: 0,
    lastUpdateTime: 0
  });

  const [isUIResponsive, setIsUIResponsive] = useState(true);

  useEffect(() => {
    if (!isVisible) return;

    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsSum = 0;

    const updateStats = () => {
      const now = performance.now();
      const deltaTime = now - lastFrameTime;
      
      if (deltaTime > 0) {
        const currentFps = 1000 / deltaTime;
        fpsSum += currentFps;
        frameCount++;
        
        // Update every 10 frames for smoothed FPS
        if (frameCount >= 10) {
          const avgFps = fpsSum / frameCount;
          
          // Check UI responsiveness (consider unresponsive if FPS < 30)
          const responsive = avgFps > 30;
          setIsUIResponsive(responsive);
          
          // Get worker stats
          const workerStats = getSequencerWorker().getStats();
          
          setStats({
            isWorkerReady: workerStats.isReady,
            pendingRequests: workerStats.pendingRequests,
            mainThreadFps: Math.round(avgFps),
            lastUpdateTime: now
          });
          
          // Reset counters
          frameCount = 0;
          fpsSum = 0;
        }
      }
      
      lastFrameTime = now;
      requestAnimationFrame(updateStats);
    };

    requestAnimationFrame(updateStats);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className={`bg-base-200 p-3 rounded-lg text-xs space-y-2 ${className}`}>
      <div className="font-bold text-base-content">🎵 Performance Monitor</div>
      
      {/* Worker Status */}
      <div className="flex items-center gap-2">
        <span className="font-medium">Web Worker:</span>
        <span className={`px-2 py-1 rounded text-xs ${
          stats.isWorkerReady 
            ? 'bg-success text-success-content' 
            : 'bg-warning text-warning-content'
        }`}>
          {stats.isWorkerReady ? 'Ready' : 'Not Ready'}
        </span>
      </div>

      {/* Pending Requests */}
      <div className="flex items-center gap-2">
        <span className="font-medium">Pending:</span>
        <span className={`px-2 py-1 rounded text-xs ${
          stats.pendingRequests > 0 
            ? 'bg-warning text-warning-content' 
            : 'bg-base-100 text-base-content'
        }`}>
          {stats.pendingRequests} requests
        </span>
      </div>

      {/* Main Thread FPS */}
      <div className="flex items-center gap-2">
        <span className="font-medium">Main Thread:</span>
        <span className={`px-2 py-1 rounded text-xs ${
          stats.mainThreadFps >= 50 ? 'bg-success text-success-content' :
          stats.mainThreadFps >= 30 ? 'bg-warning text-warning-content' :
          'bg-error text-error-content'
        }`}>
          {stats.mainThreadFps} FPS
        </span>
      </div>

      {/* UI Responsiveness */}
      <div className="flex items-center gap-2">
        <span className="font-medium">UI Status:</span>
        <span className={`px-2 py-1 rounded text-xs ${
          isUIResponsive 
            ? 'bg-success text-success-content' 
            : 'bg-error text-error-content'
        }`}>
          {isUIResponsive ? 'Responsive' : 'Lagging'}
        </span>
      </div>

      {/* Instructions */}
      <div className="text-base-content/70 text-xs border-t border-base-300 pt-2">
        💡 Add many notes and play to test worker performance
      </div>
    </div>
  );
};

export default SequencerPerformanceMonitor; 