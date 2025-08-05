import { throttle } from "../../utils/performanceUtils";
import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";

export interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  size?: number;
  orientation?: "horizontal" | "vertical";
  curve?: "linear" | "logarithmic";
  className?: string;
  disabled?: boolean;
  showTooltip?: boolean;
  tooltipFormat?: (value: number) => string;
  color?:
    | "primary"
    | "secondary"
    | "accent"
    | "neutral"
    | "info"
    | "success"
    | "warning"
    | "error";
}

export const Knob: React.FC<KnobProps> = ({
  value,
  min,
  max,
  step = 0.001,
  onChange,
  size = 60,
  orientation = "vertical",
  curve = "linear",
  className = "",
  disabled = false,
  showTooltip = true,
  tooltipFormat = (val) => val.toFixed(3),
  color = "primary",
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);
  const [showTooltipState, setShowTooltipState] = useState(false);

  // Create throttled onChange to prevent excessive updates
  const throttledOnChange = useMemo(
    () => throttle(onChange, 16), // ~60fps
    [onChange],
  );

  // Convert value to percentage (0-1)
  const valueToPercentage = useCallback(
    (val: number) => {
      if (curve === "logarithmic") {
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logValue = Math.log(val);
        return (logValue - logMin) / (logMax - logMin);
      }
      return (val - min) / (max - min);
    },
    [min, max, curve],
  );

  // Convert percentage to value
  const percentageToValue = useCallback(
    (percentage: number) => {
      if (curve === "logarithmic") {
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logValue = logMin + percentage * (logMax - logMin);
        return Math.exp(logValue);
      }
      return min + percentage * (max - min);
    },
    [min, max, curve],
  );

  // Calculate current rotation angle
  const currentPercentage = valueToPercentage(value);
  const rotationAngle =
    orientation === "vertical"
      ? -120 + currentPercentage * 240 // -120° to +120°
      : -120 + currentPercentage * 240; // Same range for horizontal

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(true);
      setStartY(orientation === "vertical" ? e.clientY : e.clientX);
      setStartValue(value);
      // Show tooltip when starting to drag
      if (showTooltip) {
        setShowTooltipState(true);
      }
    },
    [disabled, orientation, value, showTooltip],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || disabled) return;
      e.preventDefault();

      const currentY = orientation === "vertical" ? e.clientY : e.clientX;
      const delta = startY - currentY;
      const sensitivity = 0.005; // Adjust for sensitivity
      const deltaPercentage = delta * sensitivity;

      const newPercentage = Math.max(
        0,
        Math.min(1, valueToPercentage(startValue) + deltaPercentage),
      );
      const newValue = percentageToValue(newPercentage);

      // Apply step
      const steppedValue = Math.round(newValue / step) * step;
      const clampedValue = Math.max(min, Math.min(max, steppedValue));

      throttledOnChange(clampedValue);
    },
    [
      isDragging,
      disabled,
      startY,
      startValue,
      orientation,
      valueToPercentage,
      percentageToValue,
      throttledOnChange,
      step,
      min,
      max,
    ],
  );

  const handleMouseUp = useCallback((e?: MouseEvent) => {
    setIsDragging(false);
    // Hide tooltip when finishing drag (unless still hovering)
    if (e) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const isHovering =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!isHovering) {
          setShowTooltipState(false);
        }
      }
    } else {
      // If no event provided, hide tooltip
      setShowTooltipState(false);
    }
  }, []);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;
      e.preventDefault(); // Prevent scrolling
      e.stopPropagation(); // Stop event bubbling
      setIsDragging(true);
      const touch = e.touches[0];
      setStartY(orientation === "vertical" ? touch.clientY : touch.clientX);
      setStartValue(value);
      // Show tooltip when starting to drag on touch
      if (showTooltip) {
        setShowTooltipState(true);
      }
    },
    [disabled, orientation, value, showTooltip],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || disabled) return;
      e.preventDefault(); // Prevent scrolling
      e.stopPropagation(); // Stop event bubbling

      const touch = e.touches[0];
      const currentY =
        orientation === "vertical" ? touch.clientY : touch.clientX;
      const delta = startY - currentY;
      const sensitivity = 0.005; // Adjust for sensitivity
      const deltaPercentage = delta * sensitivity;

      const newPercentage = Math.max(
        0,
        Math.min(1, valueToPercentage(startValue) + deltaPercentage),
      );
      const newValue = percentageToValue(newPercentage);

      // Apply step
      const steppedValue = Math.round(newValue / step) * step;
      const clampedValue = Math.max(min, Math.min(max, steppedValue));

      throttledOnChange(clampedValue);
    },
    [
      isDragging,
      disabled,
      startY,
      startValue,
      orientation,
      valueToPercentage,
      percentageToValue,
      throttledOnChange,
      step,
      min,
      max,
    ],
  );

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault(); // Prevent any default behavior
    e.stopPropagation(); // Stop event bubbling
    setIsDragging(false);
    // Hide tooltip when finishing touch drag
    setShowTooltipState(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (showTooltip && !disabled) {
      setShowTooltipState(true);
    }
  }, [showTooltip, disabled]);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setShowTooltipState(false);
    }
  }, [isDragging]);

  // Set up touch event listeners on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const touchStartHandler = (e: TouchEvent) => handleTouchStart(e);
    const touchMoveHandler = (e: TouchEvent) => handleTouchMove(e);
    const touchEndHandler = (e: TouchEvent) => handleTouchEnd(e);

    container.addEventListener("touchstart", touchStartHandler, {
      passive: false,
    });
    container.addEventListener("touchmove", touchMoveHandler, {
      passive: false,
    });
    container.addEventListener("touchend", touchEndHandler, { passive: false });

    return () => {
      container.removeEventListener("touchstart", touchStartHandler);
      container.removeEventListener("touchmove", touchMoveHandler);
      container.removeEventListener("touchend", touchEndHandler);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const knobStyle = {
    width: `${size}px`,
    height: `${size}px`,
    transform: `rotate(${rotationAngle}deg)`,
  };

  const containerStyle = {
    width: `${size}px`,
    height: `${size}px`,
  };

  // Get color classes based on color prop
  const getColorClasses = (elementType: "border" | "bg") => {
    const colorMap = {
      primary: elementType === "border" ? "border-primary" : "bg-primary",
      secondary: elementType === "border" ? "border-secondary" : "bg-secondary",
      accent: elementType === "border" ? "border-accent" : "bg-accent",
      neutral: elementType === "border" ? "border-neutral" : "bg-neutral",
      info: elementType === "border" ? "border-info" : "bg-info",
      success: elementType === "border" ? "border-success" : "bg-success",
      warning: elementType === "border" ? "border-warning" : "bg-warning",
      error: elementType === "border" ? "border-error" : "bg-error",
    };
    return colorMap[color] || colorMap.primary;
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      style={containerStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      ref={containerRef}
    >
      <div
        ref={knobRef}
        className={`absolute inset-0 rounded-full border-2 ${getColorClasses(
          "border",
        )} bg-base-200 cursor-pointer transition-transform duration-100 ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        style={knobStyle}
      >
        {/* Knob indicator */}
        <div
          className={`absolute top-1 left-1/2 w-1 h-3 ${getColorClasses(
            "bg",
          )} rounded-full transform -translate-x-1/2`}
        />
      </div>

      {/* Knob center dot */}
      <div
        className={`absolute top-1/2 left-1/2 w-2 h-2 ${getColorClasses(
          "bg",
        )} rounded-full transform -translate-x-1/2 -translate-y-1/2`}
      />

      {/* Tooltip */}
      {showTooltip && (showTooltipState || isDragging) && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
          {tooltipFormat(value)}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
};
