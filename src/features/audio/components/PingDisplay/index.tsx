import React from "react";

interface PingDisplayProps {
  ping: number | null;
  isConnected: boolean;
  showLabel?: boolean;
  showMs?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "badge" | "text" | "compact";
}

const PingDisplay: React.FC<PingDisplayProps> = ({
  ping,
  isConnected,
  showLabel = true,
  showMs = true,
  size = "sm",
  variant = "compact",
}) => {
  // Get ping color based on latency
  const getPingColor = (pingValue: number | null) => {
    if (!isConnected || pingValue === null) return "text-error";
    if (pingValue < 50) return "text-success";
    if (pingValue < 100) return "text-warning";
    if (pingValue < 200) return "text-orange-500";
    return "text-error";
  };

  // Get ping status text
  const getPingStatus = (pingValue: number | null) => {
    if (!isConnected) return "Disconnected";
    if (pingValue === null) return "Measuring...";
    if (pingValue < 50) return "Excellent";
    if (pingValue < 100) return "Good";
    if (pingValue < 200) return "Fair";
    return "Poor";
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

  const displayValue = ping !== null ? `${ping}${showMs ? "ms" : ""}` : "---";
  const colorClass = getPingColor(ping);
  const sizeClass = getSizeClasses();

  if (variant === "badge") {
    return (
      <div
        className={`badge badge-outline ${isConnected ? "badge-success" : "badge-error"} ${sizeClass}`}
      >
        {showLabel && <span className="mr-1">Ping:</span>}
        <span className={colorClass}>{displayValue}</span>
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={`flex items-center gap-1 ${sizeClass}`}>
        {showLabel && <span className="text-base-content/70">Ping:</span>}
        <span className={colorClass} title={getPingStatus(ping)}>
          {displayValue}
        </span>
      </div>
    );
  }

  // Compact variant (default)
  return (
    <span
      className={`${colorClass} ${sizeClass} font-mono`}
      title={`Ping: ${displayValue} (${getPingStatus(ping)})`}
    >
      {displayValue}
    </span>
  );
};

export default PingDisplay;
