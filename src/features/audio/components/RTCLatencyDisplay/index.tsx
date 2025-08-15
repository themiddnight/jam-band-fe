import React from 'react';

interface RTCLatencyDisplayProps {
  latency: number | null;
  isActive: boolean;
  showLabel?: boolean;
  showMs?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'text' | 'compact';
}

const RTCLatencyDisplay: React.FC<RTCLatencyDisplayProps> = ({
  latency,
  isActive,
  showLabel = true,
  showMs = true,
  size = 'sm',
  variant = 'compact'
}) => {
  // Get latency color based on value
  const getLatencyColor = (latencyValue: number | null) => {
    if (!isActive || latencyValue === null) return 'text-base-content/50';
    if (latencyValue < 30) return 'text-success';
    if (latencyValue < 60) return 'text-warning';
    if (latencyValue < 100) return 'text-orange-500';
    return 'text-error';
  };

  // Get latency status text
  const getLatencyStatus = (latencyValue: number | null) => {
    if (!isActive) return 'No voice connections';
    if (latencyValue === null) return 'Measuring...';
    if (latencyValue < 30) return 'Excellent';
    if (latencyValue < 60) return 'Good';
    if (latencyValue < 100) return 'Fair';
    return 'Poor';
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

  const displayValue = latency !== null ? `${Math.round(latency)}${showMs ? 'ms' : ''}` : '---';
  const colorClass = getLatencyColor(latency);
  const sizeClass = getSizeClasses();

  if (variant === 'badge') {
    return (
      <div className={`badge badge-outline ${isActive ? 'badge-info' : 'badge-ghost'} ${sizeClass}`}>
        {showLabel && <span className="mr-1">RTC:</span>}
        <span className={colorClass}>{displayValue}</span>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={`flex items-center gap-1 ${sizeClass}`}>
        {showLabel && <span className="text-base-content/70">RTC:</span>}
        <span className={colorClass} title={getLatencyStatus(latency)}>
          {displayValue}
        </span>
      </div>
    );
  }

  // Compact variant (default)
  return (
    <span 
      className={`${colorClass} ${sizeClass} font-mono`}
      title={`RTC Latency: ${displayValue} (${getLatencyStatus(latency)})`}
    >
      {displayValue}
    </span>
  );
};

export default RTCLatencyDisplay;
