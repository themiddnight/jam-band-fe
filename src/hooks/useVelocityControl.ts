import { useCallback, useEffect } from "react";

const VELOCITY_STEP = 0.1; // 10 steps from 0 to 1
const MIN_VELOCITY = 0.1; // Minimum velocity (to avoid silence)
const MAX_VELOCITY = 1.0;

export interface UseVelocityControlProps {
  velocity: number;
  setVelocity: (velocity: number) => void;
}

export const useVelocityControl = ({
  velocity,
  setVelocity,
}: UseVelocityControlProps) => {
  const handleVelocityChange = useCallback(
    (key: string) => {
      if (key === "-") {
        const newVelocity = Math.max(MIN_VELOCITY, velocity - VELOCITY_STEP);
        setVelocity(newVelocity);
        return true;
      }
      if (key === "=") {
        const newVelocity = Math.min(MAX_VELOCITY, velocity + VELOCITY_STEP);
        setVelocity(newVelocity);
        return true;
      }
      return false;
    },
    [velocity, setVelocity],
  );

  // Set up keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      handleVelocityChange(event.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleVelocityChange]);

  return {
    handleVelocityChange,
  };
};
