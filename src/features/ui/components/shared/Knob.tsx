import { throttle } from "@/shared/utils/performanceUtils";
import React, { useState, useMemo, useCallback } from "react";

// Knob angle limits and visuals
const KNOB_MIN_ANGLE = -150;
const KNOB_MAX_ANGLE = 150;
const KNOB_ANGLE_SPAN = KNOB_MAX_ANGLE - KNOB_MIN_ANGLE;
const KNOB_BORDER_WIDTH = 3;
const DRAG_SENSITIVITY = 0.005; // px -> percent

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
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [startPos, setStartPos] = useState(0);
  const [startValue, setStartValue] = useState(0);

  // Throttle onChange to ~60fps
  const throttledOnChange = useMemo(() => throttle(onChange, 16), [onChange]);

  // Value <-> percentage
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

  // Angle from value
  const currentPercentage = valueToPercentage(value);
  const rotationAngle = KNOB_MIN_ANGLE + currentPercentage * KNOB_ANGLE_SPAN;

  // Pointer events unify mouse/touch/pen
  const handlePointerDown = useCallback<
    React.PointerEventHandler<HTMLDivElement>
  >(
    (e) => {
      if (disabled) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      const initialAxis = orientation === "vertical" ? e.clientY : e.clientX;
      setStartPos(initialAxis);
      setStartValue(value);
    },
    [disabled, orientation, value],
  );

  const handlePointerMove = useCallback<
    React.PointerEventHandler<HTMLDivElement>
  >(
    (e) => {
      if (!isDragging || disabled) return;
      e.preventDefault();
      const currentAxis = orientation === "vertical" ? e.clientY : e.clientX;
      const delta = startPos - currentAxis;
      const deltaPct = delta * DRAG_SENSITIVITY;

      const newPct = Math.max(
        0,
        Math.min(1, valueToPercentage(startValue) + deltaPct),
      );
      const newValue = percentageToValue(newPct);

      const stepped = Math.round(newValue / step) * step;
      const clamped = Math.max(min, Math.min(max, stepped));
      throttledOnChange(clamped);
    },
    [
      isDragging,
      disabled,
      orientation,
      startPos,
      startValue,
      valueToPercentage,
      percentageToValue,
      step,
      min,
      max,
      throttledOnChange,
    ],
  );

  const handlePointerUp = useCallback<
    React.PointerEventHandler<HTMLDivElement>
  >(() => {
    setIsDragging(false);
  }, []);

  // Tooltip visibility
  const showTooltipNow = showTooltip && !disabled && (isHovering || isDragging);

  // Styles
  const knobStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    transform: `rotate(${rotationAngle}deg)`,
  };

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    touchAction: "none", // prevent scrolling on touch devices
  };

  // Color utility
  const getColorClasses = (elementType: "border" | "bg" | "text") => {
    const colorMap = {
      primary:
        elementType === "border"
          ? "border-primary"
          : elementType === "bg"
            ? "bg-primary"
            : "text-primary",
      secondary:
        elementType === "border"
          ? "border-secondary"
          : elementType === "bg"
            ? "bg-secondary"
            : "text-secondary",
      accent:
        elementType === "border"
          ? "border-accent"
          : elementType === "bg"
            ? "bg-accent"
            : "text-accent",
      neutral:
        elementType === "border"
          ? "border-neutral"
          : elementType === "bg"
            ? "bg-neutral"
            : "text-neutral",
      info:
        elementType === "border"
          ? "border-info"
          : elementType === "bg"
            ? "bg-info"
            : "text-info",
      success:
        elementType === "border"
          ? "border-success"
          : elementType === "bg"
            ? "bg-success"
            : "text-success",
      warning:
        elementType === "border"
          ? "border-warning"
          : elementType === "bg"
            ? "bg-warning"
            : "text-warning",
      error:
        elementType === "border"
          ? "border-error"
          : elementType === "bg"
            ? "bg-error"
            : "text-error",
    } as const;
    return colorMap[color] || colorMap.primary;
  };

  // Arc path for the knob border
  const cx = size / 2;
  const cy = size / 2;
  const radius = Math.max(0, size / 2 - KNOB_BORDER_WIDTH / 2);
  const startDeg = KNOB_MIN_ANGLE - 90; // offset so 0° is at top
  const endDeg = KNOB_MAX_ANGLE - 90;

  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const polarToCartesian = (
    centerX: number,
    centerY: number,
    r: number,
    angleDeg: number,
  ) => {
    const a = toRadians(angleDeg);
    return { x: centerX + r * Math.cos(a), y: centerY + r * Math.sin(a) };
  };

  const describeArc = (
    centerX: number,
    centerY: number,
    r: number,
    aStart: number,
    aEnd: number,
  ) => {
    const start = polarToCartesian(centerX, centerY, r, aStart);
    const end = polarToCartesian(centerX, centerY, r, aEnd);
    let delta = aEnd - aStart;
    delta = ((delta % 360) + 360) % 360; // normalize to [0, 360)
    const largeArcFlag = delta > 180 ? 1 : 0;
    const sweepFlag = 1; // clockwise
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
  };

  const arcPath = describeArc(cx, cy, radius, startDeg, endDeg);

  const innerDiscInset = Math.max(2, Math.floor(KNOB_BORDER_WIDTH * 0.6));
  const innerDiscStyle: React.CSSProperties = {
    position: "absolute",
    top: innerDiscInset,
    left: innerDiscInset,
    right: innerDiscInset,
    bottom: innerDiscInset,
    borderRadius: "9999px",
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      style={containerStyle}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Adjustable range arc (acts as the "border") */}
      <svg
        className={`absolute inset-0 z-10 pointer-events-none ${getColorClasses("text")}`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        focusable="false"
      >
        <path
          d={arcPath}
          stroke="currentColor"
          strokeWidth={KNOB_BORDER_WIDTH}
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Rotating indicator carrier (outer) */}
      <div
        className={`absolute inset-0 z-0 cursor-pointer transition-transform duration-100 ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        style={knobStyle}
      >
        {/* Inner disc */}
        <div className="bg-base-200 rounded-full" style={innerDiscStyle}>
          {/* Knob indicator */}
          <div
            className={`absolute top-1 left-1/2 w-1 h-3 ${getColorClasses(
              "bg",
            )} rounded-full transform -translate-x-1/2`}
          />
          {/* Knob center dot */}
          <div
            className={`absolute top-1/2 left-1/2 w-2 h-2 ${getColorClasses(
              "bg",
            )} rounded-full transform -translate-x-1/2 -translate-y-1/2`}
          />
        </div>
      </div>

      {/* Tooltip */}
      {showTooltipNow && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
          {tooltipFormat(value)}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
};
