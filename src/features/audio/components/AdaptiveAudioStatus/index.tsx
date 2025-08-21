import { useAdaptiveAudio } from "../../hooks/useAdaptiveAudio";
import React from "react";

interface AdaptiveAudioStatusProps {
  audioContext?: AudioContext | null;
  userCount?: number;
  currentLatency?: number | null;
  variant?: "compact" | "detailed" | "badge";
  showRecommendations?: boolean;
}

const AdaptiveAudioStatus: React.FC<AdaptiveAudioStatusProps> = ({
  audioContext,
  userCount = 0,
  currentLatency = null,
  variant = "compact",
  showRecommendations = false,
}) => {
  const {
    configSummary,
    qualityLevel,
    isUltraLowLatency,
    isBalanced,
    isStable,
    recommendations,
    lastAdjustment,
  } = useAdaptiveAudio({
    audioContext,
    userCount,
    currentLatency,
  });

  // Get quality color
  const getQualityColor = () => {
    if (isUltraLowLatency) return "text-success";
    if (isBalanced) return "text-warning";
    if (isStable) return "text-info";
    return "text-base-content";
  };

  // Get quality icon
  const getQualityIcon = () => {
    if (isUltraLowLatency) return "⚡";
    if (isBalanced) return "⚖️";
    if (isStable) return "🛡️";
    return "🎵";
  };

  // Format time since last adjustment
  const formatTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (variant === "badge") {
    return (
      <div className={`badge badge-outline ${getQualityColor()}`}>
        {getQualityIcon()} {qualityLevel.replace("-", " ")}
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="card-title text-sm">Adaptive Audio</h4>
            <span className={`badge ${getQualityColor()}`}>
              {getQualityIcon()} {qualityLevel.replace("-", " ")}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Mode:</span>
              <span className="font-mono">{configSummary.description}</span>
            </div>
            <div className="flex justify-between">
              <span>Target Latency:</span>
              <span className="font-mono">{configSummary.latencyTarget}</span>
            </div>
            <div className="flex justify-between">
              <span>Buffer Size:</span>
              <span className="font-mono">
                {configSummary.bufferSize} samples
              </span>
            </div>
            <div className="flex justify-between">
              <span>Look-ahead:</span>
              <span className="font-mono">{configSummary.lookAhead}</span>
            </div>
            <div className="flex justify-between">
              <span>Users:</span>
              <span className="font-mono">{userCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Adjusted:</span>
              <span className="font-mono text-xs">
                {formatTimeSince(lastAdjustment)}
              </span>
            </div>
          </div>

          {showRecommendations && recommendations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-base-300">
              <div className="text-xs font-semibold mb-2">Recommendations:</div>
              <ul className="text-xs space-y-1">
                {recommendations.map((rec, index) => (
                  <li key={index} className="text-warning">
                    • {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Compact variant (default)
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={getQualityColor()}>{getQualityIcon()}</span>
      <span className="font-mono">{qualityLevel.replace("-", " ")}</span>
      <span className="text-base-content/60">({userCount} users)</span>
    </div>
  );
};

export default AdaptiveAudioStatus;
