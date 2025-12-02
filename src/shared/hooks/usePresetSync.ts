import { useEffect } from "react";
import { useUserStore } from "../stores/userStore";
import { useSequencerStore } from "@/features/sequencer/stores/sequencerStore";

/**
 * Hook to sync presets from API when user logs in
 * and sync local presets to API on first login
 */
export function usePresetSync() {
  const { isAuthenticated, userType } = useUserStore();
  const { loadPresetsFromAPI, syncPresetsToAPI, presets } = useSequencerStore();
  const isGuest = userType === "GUEST" || !isAuthenticated;

  useEffect(() => {
    if (!isGuest && isAuthenticated) {
      // Load presets from API when authenticated
      loadPresetsFromAPI().then(() => {
        // If we have local presets but no API presets, sync them
        // This handles migration from localStorage to API
        const hasLocalPresets = presets.length > 0;
        if (hasLocalPresets) {
          // Check if we've already synced (could use a flag in localStorage)
          const syncKey = "sequencer-presets-synced";
          const alreadySynced = localStorage.getItem(syncKey);
          if (!alreadySynced) {
            syncPresetsToAPI().then(() => {
              localStorage.setItem(syncKey, "true");
            });
          }
        }
      });
    }
  }, [isAuthenticated, isGuest, loadPresetsFromAPI, syncPresetsToAPI, presets.length]);
}

