import {
  dbToGain,
  gainToDb,
  formatDb,
  getDbColorClass,
  getSliderColorClass,
} from "../../../utils/audioUtils";
import React, { useCallback } from "react";

interface GainControlProps {
  /** Current linear gain value (Web Audio API format) */
  gain: number;
  /** Callback when gain changes */
  onGainChange: (newGain: number) => void;
  /** Whether the control is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Professional mixer-style gain control with 0dB at center
 * Range: -48dB to +36dB (0dB at center position)
 */
export const GainControl: React.FC<GainControlProps> = ({
  gain,
  onGainChange,
  disabled = false,
  className = "",
}) => {
  // Convert current gain to dB for display and slider
  const currentDb = gainToDb(gain);

  // Handle dB slider change
  const handleDbChange = useCallback(
    (newDb: number) => {
      const newGain = dbToGain(newDb);
      onGainChange(newGain);
    },
    [onGainChange],
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with current value */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Input Gain</label>
        <span
          className={`text-xs font-mono px-2 py-1 rounded bg-base-200 ${getDbColorClass(currentDb)}`}
        >
          {formatDb(currentDb)}
        </span>
      </div>

      {/* Professional mixer-style slider */}
      <div className="relative">
        <input
          type="range"
          min={-48} // -48dB minimum (very quiet but not silence)
          max={36} // +36dB maximum (extreme amplification)
          step={0.5} // 0.5dB steps for precise control
          value={currentDb}
          onChange={(e) => handleDbChange(Number(e.target.value))}
          disabled={disabled}
          className={`range range-sm w-full ${getSliderColorClass(currentDb)}`}
        />

        {/* Tick marks with 0dB prominently marked */}
        <div className="flex justify-between text-xs text-base-content/50 mt-1 px-1">
          <span>-48</span>
          <span>-24</span>
          <span>-12</span>
          <span className="font-bold text-primary border-b border-primary">
            0dB
          </span>
          <span>+12</span>
          <span>+24</span>
          <span>+36</span>
        </div>

        {/* Center line indicator for 0dB */}
        <div
          className="absolute top-0 w-0.5 h-full bg-primary/30 pointer-events-none"
          style={{
            left: `${((0 - -48) / (36 - -48)) * 100}%`,
            transform: "translateX(-50%)",
          }}
        />
      </div>

      {/* Professional gain staging info */}
      {/* <div className="text-xs text-center text-base-content/60 space-y-0.5">
        <div>0dB = Unity Gain (Recommended)</div>
        {currentDb > 12 && (
          <div className="text-warning font-medium">
            ⚠️ High gain - watch for distortion
          </div>
        )}
        {currentDb > 24 && (
          <div className="text-error font-medium">
            🔥 Very high gain - use with extreme caution
          </div>
        )}
        {currentDb > 30 && (
          <div className="text-error font-bold animate-pulse">
            💥 EXTREME GAIN - May cause severe distortion!
          </div>
        )}
      </div> */}
    </div>
  );
};
