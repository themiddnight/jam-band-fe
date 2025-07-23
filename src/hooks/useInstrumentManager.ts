import { useRef, useCallback, useEffect } from 'react';
import { InstrumentManager } from '../utils/InstrumentManager';
import { InstrumentCategory } from '../constants/instruments';
import type { SynthState } from './useToneSynthesizer';

export const useInstrumentManager = () => {
  const instrumentManagerRef = useRef<InstrumentManager | null>(null);

  // Initialize the instrument manager
  const initialize = useCallback(async () => {
    if (!instrumentManagerRef.current) {
      instrumentManagerRef.current = new InstrumentManager();
    }
    await instrumentManagerRef.current.initialize();
  }, []);

  // Play notes from another user
  const playUserNotes = useCallback(async (
    userId: string,
    username: string,
    notes: string[],
    velocity: number,
    instrumentName: string,
    category: InstrumentCategory,
    isKeyHeld: boolean = false
  ) => {
    if (!instrumentManagerRef.current) {
      console.warn('InstrumentManager not initialized');
      return;
    }

    try {
      await instrumentManagerRef.current.playUserNotes(
        userId,
        username,
        notes,
        velocity,
        instrumentName,
        category,
        isKeyHeld
      );
    } catch (error) {
      console.error('Error playing user notes:', error);
    }
  }, []);

  // Stop notes from another user
  const stopUserNotes = useCallback(async (
    userId: string,
    notes: string[],
    instrumentName: string,
    category: InstrumentCategory
  ) => {
    if (!instrumentManagerRef.current) {
      return;
    }

    try {
      await instrumentManagerRef.current.stopUserNotes(
        userId,
        notes,
        instrumentName,
        category
      );
    } catch (error) {
      console.error('Error stopping user notes:', error);
    }
  }, []);

  // Set sustain state for a user's instrument
  const setUserSustain = useCallback((
    userId: string,
    sustain: boolean,
    instrumentName: string,
    category: InstrumentCategory
  ) => {
    if (!instrumentManagerRef.current) {
      return;
    }

    try {
      instrumentManagerRef.current.setUserSustain(
        userId,
        sustain,
        instrumentName,
        category
      );
    } catch (error) {
      console.error('Error setting user sustain:', error);
    }
  }, []);

  // Update synthesizer parameters for a remote user
  const updateUserSynthParams = useCallback(async (
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory,
    params: Partial<SynthState>
  ) => {
    if (!instrumentManagerRef.current) {
      console.warn('InstrumentManager not initialized');
      return;
    }

    try {
      await instrumentManagerRef.current.updateUserSynthParams(
        userId,
        username,
        instrumentName,
        category,
        params
      );
    } catch (error) {
      console.error('Error updating user synth parameters:', error);
    }
  }, []);

  // Preload instruments for all users in a room
  const preloadRoomInstruments = useCallback(async (roomUsers: Array<{
    id: string;
    username: string;
    currentInstrument?: string;
    currentCategory?: string;
  }>) => {
    if (!instrumentManagerRef.current) {
      console.warn('InstrumentManager not initialized');
      return;
    }

    try {
      await instrumentManagerRef.current.preloadRoomInstruments(roomUsers);
    } catch (error) {
      console.error('Error preloading room instruments:', error);
    }
  }, []);

  // Update a user's instrument
  const updateUserInstrument = useCallback(async (
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory
  ) => {
    if (!instrumentManagerRef.current) {
      console.warn('InstrumentManager not initialized');
      return;
    }

    try {
      await instrumentManagerRef.current.updateUserInstrument(
        userId,
        username,
        instrumentName,
        category
      );
    } catch (error) {
      console.error('Error updating user instrument:', error);
    }
  }, []);

  // Clean up instruments for a specific user
  const cleanupUserInstruments = useCallback((userId: string) => {
    if (instrumentManagerRef.current) {
      instrumentManagerRef.current.cleanupUserInstruments(userId);
    }
  }, []);

  // Clean up all instruments
  const cleanupAllInstruments = useCallback(() => {
    if (instrumentManagerRef.current) {
      instrumentManagerRef.current.cleanupAllInstruments();
    }
  }, []);

  // Get audio context
  const getAudioContext = useCallback(() => {
    return instrumentManagerRef.current?.getAudioContext() || null;
  }, []);

  // Check if ready
  const isReady = useCallback(() => {
    return instrumentManagerRef.current?.isReady() || false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (instrumentManagerRef.current) {
        instrumentManagerRef.current.dispose();
        instrumentManagerRef.current = null;
      }
    };
  }, []);

  return {
    initialize,
    playUserNotes,
    stopUserNotes,
    setUserSustain,
    updateUserSynthParams,
    preloadRoomInstruments,
    updateUserInstrument,
    cleanupUserInstruments,
    cleanupAllInstruments,
    getAudioContext,
    isReady,
  };
}; 