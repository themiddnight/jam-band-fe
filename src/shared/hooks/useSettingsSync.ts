import { useEffect, useRef } from "react";
import { useUserStore } from "../stores/userStore";
import * as userPresetsAPI from "../api/userPresets";
import { debounce } from "lodash";

/**
 * Hook to sync settings to API with debouncing
 */
export function useSettingsSync<T>(
  settingsType: string,
  settings: T,
  enabled: boolean = true
) {
  const { isAuthenticated, userType } = useUserStore();
  const isGuest = userType === "GUEST" || !isAuthenticated;
  const hasSyncedRef = useRef(false);

  // Load settings from API on mount (if authenticated)
  useEffect(() => {
    if (!isGuest && isAuthenticated && enabled && !hasSyncedRef.current) {
      userPresetsAPI
        .getSettings(settingsType)
        .then((response) => {
          if (response.settings.length > 0) {
            // Settings exist in API, could merge with local if needed
            hasSyncedRef.current = true;
          }
        })
        .catch((error) => {
          console.error(`Error loading ${settingsType} settings:`, error);
        });
    }
  }, [isGuest, isAuthenticated, settingsType, enabled]);

  // Debounced save to API
  const debouncedSave = useRef(
    debounce(async (data: T) => {
      if (!isGuest && isAuthenticated) {
        try {
          await userPresetsAPI.updateSettings({
            settingsType,
            data,
          });
        } catch (error) {
          console.error(`Error saving ${settingsType} settings:`, error);
        }
      }
    }, 1000) // 1 second debounce
  ).current;

  // Save to API when settings change (debounced)
  useEffect(() => {
    if (!isGuest && isAuthenticated && enabled && hasSyncedRef.current) {
      debouncedSave(settings);
    }
  }, [settings, isGuest, isAuthenticated, enabled, debouncedSave]);

  return {
    saveToAPI: async (data: T) => {
      if (!isGuest && isAuthenticated) {
        await userPresetsAPI.updateSettings({
          settingsType,
          data,
        });
      }
    },
    loadFromAPI: async () => {
      if (!isGuest && isAuthenticated) {
        const response = await userPresetsAPI.getSettings(settingsType);
        if (response.settings.length > 0) {
          return response.settings[0].data as T;
        }
      }
      return null;
    },
  };
}

