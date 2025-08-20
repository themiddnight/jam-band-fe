import React from 'react';

interface RTCLatencyDisplayProps {
  latency: number | null;
  isActive: boolean;
  showLabel?: boolean;
  showMs?: boolean;
  size?: 'sm' | 'md' | 'lg';
  // New props for combined latency display
  browserAudioLatency?: number;
  meshLatency?: number | null;
  showBreakdown?: boolean;
}

const RTCLatencyDisplay: React.FC<RTCLatencyDisplayProps> = ({
  latency,
  isActive,
  showMs = true,
  size = 'sm',
  browserAudioLatency,
  meshLatency,
  showBreakdown = false
}) => {

  // Get latency color based on value with more granular thresholds
  const getLatencyColor = (latencyValue: number | null) => {
    if (!isActive || latencyValue === null) return 'text-base-content/50';
    if (latencyValue < 20) return 'text-success'; // Excellent: < 20ms
    if (latencyValue < 40) return 'text-success'; // Good: 20-40ms
    if (latencyValue < 60) return 'text-warning'; // Fair: 40-60ms
    if (latencyValue < 100) return 'text-orange-500'; // Poor: 60-100ms
    return 'text-error'; // Very Poor: > 100ms
  };

  // Get latency status text with more detailed descriptions
  const getLatencyStatus = (latencyValue: number | null) => {
    if (!isActive) return 'No voice connections';
    if (latencyValue === null) return 'Measuring...';
    if (latencyValue < 20) return 'Excellent';
    if (latencyValue < 40) return 'Good';
    if (latencyValue < 60) return 'Fair';
    if (latencyValue < 100) return 'Poor';
    return 'Very Poor';
  };

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs';
      case 'md':
        return 'text-sm';
      case 'lg':
        return 'text-base';
      default:
        return 'text-xs';
    }
  };

  // Format latency value with appropriate precision
  const formatLatencyValue = (latencyValue: number | null) => {
    if (latencyValue === null) return '---';
    
    // If we have breakdown information, show it in the format "15+6 ms"
    if (showBreakdown && browserAudioLatency !== undefined && meshLatency !== undefined) {
      return `${browserAudioLatency}+${meshLatency}${showMs ? ' ms' : ''}`;
    }
    
    // For very low latency (< 10ms), show 1 decimal place
    if (latencyValue < 10) {
      return `${latencyValue.toFixed(1)}${showMs ? 'ms' : ''}`;
    }
    
    // For higher latency, round to nearest integer
    return `${Math.round(latencyValue)}${showMs ? 'ms' : ''}`;
  };

  // Create breakdown tooltip text
  const getBreakdownTooltip = () => {
    if (!showBreakdown || browserAudioLatency === undefined || meshLatency === undefined) {
      return `RTC Latency: ${formatLatencyValue(latency)} (${getLatencyStatus(latency)})`;
    }
    
    return `Total: ${formatLatencyValue(latency)}\nBrowser: ${browserAudioLatency}ms\nMesh: ${meshLatency}ms`;
  };

  const displayValue = formatLatencyValue(latency);
  const colorClass = getLatencyColor(latency);
  const sizeClass = getSizeClasses();

  // Compact variant (default)
  return (
    <span 
      className={`${colorClass} ${sizeClass} font-mono`}
      title={getBreakdownTooltip()}
    >
      {displayValue}
      {/* {showBreakdown && browserAudioLatency !== undefined && meshLatency !== undefined && (
        <span className="opacity-70 ml-1">
          ({browserAudioLatency}+{meshLatency})
        </span>
      )} */}
    </span>
  );
};

export default RTCLatencyDisplay;
