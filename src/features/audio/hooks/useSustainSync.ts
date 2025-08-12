import { useEffect } from "react";

interface SustainSyncProps {
  unifiedSustain: boolean;
  localSustain: boolean;
  setLocalSustain: (sustain: boolean) => void;
  unifiedSustainToggle: boolean;
  localSustainToggle: boolean;
  setLocalSustainToggle: (toggle: boolean) => void;
}

/**
 * Shared hook to synchronize sustain state between unified state and local store
 * Eliminates duplicate useEffect blocks across all instruments
 */
export const useSustainSync = ({
  unifiedSustain,
  localSustain,
  setLocalSustain,
  unifiedSustainToggle,
  localSustainToggle,
  setLocalSustainToggle,
}: SustainSyncProps) => {
  // Sync sustain state
  useEffect(() => {
    if (unifiedSustain !== localSustain) {
      setLocalSustain(unifiedSustain);
    }
  }, [unifiedSustain, localSustain, setLocalSustain]);

  // Sync sustain toggle state
  useEffect(() => {
    if (unifiedSustainToggle !== localSustainToggle) {
      setLocalSustainToggle(unifiedSustainToggle);
    }
  }, [unifiedSustainToggle, localSustainToggle, setLocalSustainToggle]);
};
