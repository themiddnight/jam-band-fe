// Migration utility for metronome settings
// This helps migrate from old localStorage approach to Zustand store

import { useEffect } from 'react';
import { useMetronomeStore } from '../stores/metronomeStore';
import { METRONOME_STORAGE_KEYS, METRONOME_CONFIG } from '../constants';

export const migrateMetronomeSettings = () => {
  try {
    // Check if we have old localStorage values
    const oldVolume = localStorage.getItem(METRONOME_STORAGE_KEYS.VOLUME);
    const oldIsMuted = localStorage.getItem(METRONOME_STORAGE_KEYS.IS_MUTED);

    // Get current store state
    const store = useMetronomeStore.getState();
    
    // Only migrate if there are old values and store has default values
    if (oldVolume !== null && store.volume === METRONOME_CONFIG.DEFAULT_VOLUME) {
      const volume = parseFloat(oldVolume);
      if (!isNaN(volume)) {
        store.setVolume(Math.max(0, Math.min(1, volume)));
        console.log('Migrated metronome volume from localStorage to Zustand');
      }
    }

    if (oldIsMuted !== null && store.isMuted === true) { // Default is true
      const isMuted = oldIsMuted === 'true';
      store.setIsMuted(isMuted);
      console.log('Migrated metronome mute state from localStorage to Zustand');
    }

    // Clean up old localStorage keys after migration
    if (oldVolume !== null) {
      localStorage.removeItem(METRONOME_STORAGE_KEYS.VOLUME);
    }
    if (oldIsMuted !== null) {
      localStorage.removeItem(METRONOME_STORAGE_KEYS.IS_MUTED);
    }

  } catch (error) {
    console.warn('Failed to migrate metronome settings:', error);
  }
};

// Hook to automatically run migration on component mount
export const useMetronomeMigration = () => {
  useEffect(() => {
    migrateMetronomeSettings();
  }, []);
};
