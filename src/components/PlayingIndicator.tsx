import { useEffect, useState } from "react";

interface PlayingIndicatorProps {
  // Backward compatibility with existing usage
  velocity?: number;
  // New generic props
  value?: number; // 0..1 normalized
  color?: string; // any valid CSS color or named color
  mode?: "pulse" | "continuous";
}

export const PlayingIndicator = ({
  velocity,
  value,
  color = "hsl(120, 100%, 50%)", // default green
  mode = "pulse",
}: PlayingIndicatorProps) => {
  const normalizedValue = Math.max(
    0,
    Math.min(1, value !== undefined ? value : (velocity ?? 0)),
  );

  const [trigger, setTrigger] = useState(false);
  const [displayValue, setDisplayValue] = useState(normalizedValue);

  useEffect(() => {
    if (mode === "pulse") {
      if (normalizedValue > 0) {
        setDisplayValue(normalizedValue);
        setTrigger(true);
        setTimeout(() => {
          setTrigger(false);
        }, 100);
      }
    } else {
      // continuous mode just reflects the current value
      setDisplayValue(normalizedValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedValue, mode]);

  // Derive color based on value if the color is in HSL form and caller expects intensity change
  // If a static color string like 'orange' is passed, use it directly with opacity scaling.
  const isHsl = color.trim().startsWith("hsl");

  const backgroundStyle = isHsl
    ? {
        // If HSL is provided, we attempt to scale its saturation by the value
        // Expecting format hsl(h, s%, l%) — we will replace only the saturation token heuristically
        background:
          typeof color === "string"
            ? color.replace(
                /hsl\((\s*\d+\s*),\s*(\d+)%\s*,\s*(\d+)%\)/,
                (_m, h, _s, l) => {
                  const s = Math.round(displayValue * 100);
                  return `hsl(${h}, ${s}%, ${l}%)`;
                },
              )
            : color,
        opacity: mode === "continuous" ? Math.max(0.2, displayValue) : 1,
      }
    : ({
        backgroundColor: color,
        opacity: mode === "continuous" ? Math.max(0.2, displayValue) : 1,
      } as React.CSSProperties);

  return (
    <div className="relative w-2 h-2 rounded-full overflow-hidden">
      <div className="absolute w-full h-full bg-neutral-500/50" />
      <div
        className={`absolute w-full h-full ${mode === "pulse" ? (trigger ? "user-on" : "user-off") : ""}`}
        style={backgroundStyle}
      />
    </div>
  );
};

export default PlayingIndicator;
