import { useRef, useCallback, useEffect, useState } from "react";

interface UseInputLevelMonitoringProps {
  analyser: AnalyserNode | null;
  isConnected: boolean;
  isMuted: boolean; // Add muted state parameter
}

export const useInputLevelMonitoring = ({
  analyser,
  isConnected,
  isMuted, // Add muted state parameter
}: UseInputLevelMonitoringProps) => {
  const [inputLevel, setInputLevel] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  // Start monitoring input levels
  const startInputLevelMonitoring = useCallback(() => {
    if (!analyser || animationFrameRef.current) return;

    const timeDomainBuffer = new Float32Array(analyser.fftSize);

    const updateLevel = () => {
      if (!analyser) {
        // Stop monitoring if no analyser
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      analyser.getFloatTimeDomainData(timeDomainBuffer);

      // Calculate RMS level from time-domain data for responsiveness
      let sumSquares = 0;
      for (let i = 0; i < timeDomainBuffer.length; i++) {
        const v = timeDomainBuffer[i];
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / timeDomainBuffer.length);
      const level = Math.min(1, rms * 1.5); // Normalize to 0..1 with soft gain

      // Only show input level when not muted
      setInputLevel(isMuted ? 0 : level);

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [analyser, isMuted]); // Add isMuted to dependencies

  // Stop input level monitoring
  const stopInputLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setInputLevel(0);
  }, []);

  // Start/stop monitoring based on connection state and mute state
  useEffect(() => {
    if (isConnected && analyser && !isMuted) {
      startInputLevelMonitoring();
    } else {
      stopInputLevelMonitoring();
    }

    return () => {
      stopInputLevelMonitoring();
    };
  }, [
    isConnected,
    analyser,
    isMuted, // Add isMuted to dependencies
    startInputLevelMonitoring,
    stopInputLevelMonitoring,
  ]);

  return {
    inputLevel,
    startInputLevelMonitoring,
    stopInputLevelMonitoring,
  };
};
