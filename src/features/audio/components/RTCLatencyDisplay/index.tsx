import React from "react";

interface RTCLatencyDisplayProps {
  latency: number | null;
  isActive: boolean;
  showLabel?: boolean;
  showMs?: boolean;
  size?: "sm" | "md" | "lg";
  // New props for combined latency display
  browserAudioLatency?: number;
  meshLatency?: number | null;
  // Connection state props
  isConnecting?: boolean;
  connectionError?: boolean;
  onRetry?: () => void;
}

const RTCLatencyDisplay: React.FC<RTCLatencyDisplayProps> = ({
  latency,
  isActive,
  showMs = true,
  size = "sm",
  browserAudioLatency,
  meshLatency,
  isConnecting = false,
  connectionError = false,
  onRetry,
}) => {
  // Calculate merged latency value
  const getMergedLatency = () => {
    if (
      browserAudioLatency !== undefined &&
      meshLatency !== null &&
      meshLatency !== undefined
    ) {
      return browserAudioLatency + meshLatency;
    }
    return latency;
  };

  const mergedLatency = getMergedLatency();

  // Get latency color based on value with more granular thresholds
  const getLatencyColor = (latencyValue: number | null) => {
    if (!isActive || latencyValue === null) return "text-base-content/50";
    if (latencyValue < 20) return "text-success"; // Excellent: < 20ms
    if (latencyValue < 40) return "text-success"; // Good: 20-40ms
    if (latencyValue < 60) return "text-warning"; // Fair: 40-60ms
    if (latencyValue < 100) return "text-orange-500"; // Poor: 60-100ms
    return "text-error"; // Very Poor: > 100ms
  };

  // Get latency status text with more detailed descriptions
  const getLatencyStatus = (latencyValue: number | null) => {
    if (!isActive) return "No voice connections";
    if (latencyValue === null) return "Measuring...";
    if (latencyValue < 20) return "Excellent";
    if (latencyValue < 40) return "Good";
    if (latencyValue < 60) return "Fair";
    if (latencyValue < 100) return "Poor";
    return "Very Poor";
  };

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "text-xs";
      case "md":
        return "text-sm";
      case "lg":
        return "text-base";
      default:
        return "text-xs";
    }
  };

  // Format latency value with appropriate precision
  const formatLatencyValue = (latencyValue: number | null) => {
    if (latencyValue === null) return "---";

    // For very low latency (< 10ms), show 1 decimal place
    if (latencyValue < 10) {
      return `${latencyValue.toFixed(1)}${showMs ? "ms+" : ""}`;
    }

    // For higher latency, round to nearest integer
    return `${Math.round(latencyValue)}${showMs ? "ms+" : ""}`;
  };

  // Create breakdown tooltip text
  const getBreakdownTooltip = () => {
    if (
      browserAudioLatency !== undefined &&
      meshLatency !== null &&
      meshLatency !== undefined
    ) {
      return `Total: ${formatLatencyValue(mergedLatency)}\nAudio Processing: ${browserAudioLatency}ms\nRTC Latency: ${meshLatency}ms`;
    }

    return `RTC Latency: ${formatLatencyValue(mergedLatency)} (${getLatencyStatus(mergedLatency)})`;
  };

  const sizeClass = getSizeClasses();

  // Handle different connection states
  if (isConnecting) {
    return (
      <div
        className={`flex items-center gap-1 ${sizeClass}`}
        title="Connecting..."
      >
        <div className="loading loading-spinner loading-xs"></div>
        <span className="text-base-content/60">---</span>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className={`flex items-center gap-1 ${sizeClass}`}>
        {onRetry ? (
          <button
            onClick={onRetry}
            className="text-error hover:text-error/80 cursor-pointer"
            title="Connection failed. Click to retry"
          >
            🔄
          </button>
        ) : (
          <span className="text-error" title="Connection failed">
            ❌
          </span>
        )}
        <span className="text-base-content/60">---</span>
      </div>
    );
  }

  if (!isActive) {
    return (
      <span
        className={`text-base-content/50 ${sizeClass} font-mono`}
        title="No voice connections"
      >
        ---
      </span>
    );
  }

  const displayValue = formatLatencyValue(mergedLatency);
  const colorClass = getLatencyColor(mergedLatency);

  // Connected state - show latency
  return (
    <span
      className={`${colorClass} ${sizeClass} font-mono`}
      title={getBreakdownTooltip()}
    >
      {displayValue}
    </span>
  );
};

export default RTCLatencyDisplay;
