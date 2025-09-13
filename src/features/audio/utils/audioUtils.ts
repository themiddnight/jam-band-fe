/**
 * Audio utility functions for professional mixer-style gain control
 */

/**
 * Convert decibels to linear gain value for Web Audio API
 * @param db Decibel value (-60 to +36)
 * @returns Linear gain value for Web Audio API
 */
export const dbToGain = (db: number): number => {
  if (db <= -60) return 0; // Silence
  return Math.pow(10, db / 20);
};

/**
 * Convert linear gain value to decibels
 * @param gain Linear gain value (0 to ~63)
 * @returns Decibel value
 */
export const gainToDb = (gain: number): number => {
  if (gain <= 0) return -60; // Silence
  return 20 * Math.log10(gain);
};

/**
 * Format dB value for display
 * @param db Decibel value
 * @returns Formatted string (e.g., "+6.0dB", "0.0dB", "-12.0dB")
 */
export const formatDb = (db: number): string => {
  if (db <= -60) return "-∞dB";
  if (db === 0) return "0dB";
  const sign = db > 0 ? "+" : "";
  return `${sign}${db.toFixed(1)}dB`;
};

/**
 * Get color class based on dB level for visual feedback
 * @param db Decibel value
 * @returns Tailwind color class
 */
export const getDbColorClass = (db: number): string => {
  if (db <= -20) return "text-base-content/50"; // Very quiet
  if (db <= -6) return "text-success"; // Good level
  if (db <= 0) return "text-warning"; // Unity gain
  if (db <= 12) return "text-warning"; // Hot level
  if (db <= 24) return "text-error"; // Very hot
  return "text-error font-bold"; // Extreme level
};

/**
 * Get slider thumb color based on dB level
 * @param db Decibel value
 * @returns Tailwind color class for slider
 */
export const getSliderColorClass = (db: number): string => {
  if (db <= -6) return "range-success";
  if (db <= 12) return "range-warning";
  if (db <= 24) return "range-error";
  return "range-error"; // Keep red for extreme levels
};

/**
 * Default meter release factor for slow decay animation.
 * Range: 0..1 (closer to 1 = slower decay). Suggested 0.85 - 0.98
 */
export const DEFAULT_METER_RELEASE = 0.95;

/**
 * Apply fast-attack / slow-release smoothing.
 * - If nextLevel > prevLevel: snap immediately (fast attack)
 * - Else: exponentially decay toward nextLevel using release factor
 */
export const applyFastAttackSlowRelease = (
  prevLevel: number,
  nextLevel: number,
  release: number = DEFAULT_METER_RELEASE,
): number => {
  if (!isFinite(prevLevel)) prevLevel = 0;
  if (!isFinite(nextLevel)) nextLevel = 0;
  if (nextLevel > prevLevel) return nextLevel; // fast attack
  const r = Math.max(0, Math.min(0.999, release));
  return prevLevel * r + nextLevel * (1 - r);
};
