// Metronome Hook

import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { MetronomeSoundService } from '../services/MetronomeSoundService';
import { MetronomeSocketService } from '../services/MetronomeSocketService';
import { TapTempoCalculator, validateBpm } from '../utils';
import { METRONOME_CONFIG } from '../constants';
import { useMetronomeStore } from '../stores/metronomeStore';

interface UseMetronomeOptions {
  socket: Socket | null;
  canEdit: boolean; // Whether user can edit metronome (room owner or band member)
}

export const useMetronome = ({ socket, canEdit }: UseMetronomeOptions) => {
  // Metronome state (synced across room)
  const [bpm, setBpm] = useState<number>(METRONOME_CONFIG.DEFAULT_BPM);

  // Personal settings from Zustand store
  const { 
    volume, 
    isMuted, 
    setVolume, 
    toggleMute 
  } = useMetronomeStore();

  // Services
  const soundServiceRef = useRef<MetronomeSoundService | null>(null);
  const socketServiceRef = useRef<MetronomeSocketService | null>(null);
  const tapCalculatorRef = useRef(new TapTempoCalculator());

  // Initialize services
  useEffect(() => {
    soundServiceRef.current = new MetronomeSoundService();
    socketServiceRef.current = new MetronomeSocketService(socket);

    return () => {
      socketServiceRef.current?.removeListeners();
    };
  }, [socket]);

  // Update socket service when socket changes
  useEffect(() => {
    if (socketServiceRef.current) {
      socketServiceRef.current.updateSocket(socket);
    }
  }, [socket]);

  // Setup socket event listeners
  useEffect(() => {
    if (!socketServiceRef.current) return;

    const socketService = socketServiceRef.current;

    // Listen for metronome state updates
    socketService.onMetronomeUpdated(({ bpm: newBpm }) => {
      setBpm(newBpm);
    });

    // Listen for metronome ticks
    socketService.onMetronomeTick(() => {
      // Only play sound if not muted and metronome is playing
      if (!isMuted && soundServiceRef.current) {
        soundServiceRef.current.playTick(volume);
      }
    });

    // Listen for initial metronome state
    socketService.onMetronomeState(({ bpm: initialBpm }) => {
      setBpm(initialBpm);
    });

    // Request current metronome state when component mounts
    socketService.requestMetronomeState();

    return () => {
      socketService.removeListeners();
    };
  }, [isMuted, volume]);

  // Handle BPM change
  const handleBpmChange = useCallback((newBpm: number) => {
    const validBpm = validateBpm(newBpm);
    
    if (canEdit && socketServiceRef.current) {
      socketServiceRef.current.updateBpm(validBpm);
    }
  }, [canEdit]);

  // Handle mute toggle (personal setting)
  const handleToggleMute = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  // Handle volume change (personal setting)
  const handleVolumeChange = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
  }, [setVolume]);

  // Handle tap tempo
  const handleTapTempo = useCallback(() => {
    const newBpm = tapCalculatorRef.current.tap();
    if (newBpm && canEdit) {
      handleBpmChange(newBpm);
    }
  }, [canEdit, handleBpmChange]);

  // Reset tap tempo
  const resetTapTempo = useCallback(() => {
    tapCalculatorRef.current.reset();
  }, []);

  // Get tap count for UI feedback
  const getTapCount = useCallback(() => {
    return tapCalculatorRef.current.tapCount;
  }, []);

  return {
    // State
    bpm,
    isMuted,
    volume,
    canEdit,

    // Actions
    handleBpmChange,
    handleToggleMute,
    handleVolumeChange,
    handleTapTempo,
    resetTapTempo,
    getTapCount,

    // Utilities
    hasAudioFile: soundServiceRef.current?.hasAudioFile ?? false,
    reloadSound: soundServiceRef.current?.reloadSound.bind(soundServiceRef.current),
  };
};
