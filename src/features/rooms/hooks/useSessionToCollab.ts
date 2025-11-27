import { useState, useRef, useCallback, useEffect } from 'react';
import { InstrumentCategory } from '@/shared/constants/instruments';
import type { Room, RoomUser, EffectChainState, Scale } from '@/shared/types';
import type { Socket } from 'socket.io-client';

// ============================================================================
// Types
// ============================================================================

export interface RecordedMidiEvent {
  userId: string;
  username: string;
  instrument: string;
  category: InstrumentCategory;
  note: string;
  velocity: number;
  eventType: 'note_on' | 'note_off' | 'sustain_on' | 'sustain_off';
  beatPosition: number;
}

export interface UserMetadata {
  userId: string;
  username: string;
  instrument: string;
  category: InstrumentCategory;
  effectChain?: EffectChainState;
}

interface AudioRecorderState {
  recorder: MediaRecorder;
  chunks: Blob[];
}

export interface SessionRecordingSnapshot {
  bpm: number;
  scale: { rootNote: string; scale: Scale };
  roomName: string;
  midiEvents: RecordedMidiEvent[];
  userMetadata: Map<string, UserMetadata>;
  audioBlobs: Map<string, Blob>; // odId -> audio blob (using "od" prefix to avoid userId confusion)
  durationBeats: number;
}

interface VoiceUser {
  userId: string;
  username: string;
  isMuted: boolean;
  audioLevel: number;
}

export interface UseSessionToCollabOptions {
  socket: Socket | null;
  currentRoom: Room | null;
  currentUser: RoomUser | null;
  localVoiceStream: MediaStream | null;
  voiceUsers: VoiceUser[];
  bpm: number;
  ownerScale?: { rootNote: string; scale: Scale };
  onRecordingComplete?: (snapshot: SessionRecordingSnapshot) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useSessionToCollab(options: UseSessionToCollabOptions) {
  const {
    currentRoom,
    currentUser,
    localVoiceStream,
    voiceUsers,
    bpm,
    ownerScale,
    onRecordingComplete,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Recording state refs (persist across renders)
  const startTimeRef = useRef<number>(0);
  const bpmAtStartRef = useRef<number>(120);
  const scaleAtStartRef = useRef<{ rootNote: string; scale: Scale }>({ rootNote: 'C', scale: 'major' });
  const roomNameAtStartRef = useRef<string>('Session');
  const midiEventsRef = useRef<RecordedMidiEvent[]>([]);
  const userMetadataRef = useRef<Map<string, UserMetadata>>(new Map());
  const audioRecordersRef = useRef<Map<string, AudioRecorderState>>(new Map());
  const durationIntervalRef = useRef<number | null>(null);

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Convert a timestamp (ms since recording start) to beat position
   */
  const timestampToBeats = useCallback((timestampMs: number): number => {
    const elapsedMs = timestampMs - startTimeRef.current;
    const beatsPerMs = bpmAtStartRef.current / 60000;
    return Math.max(0, elapsedMs * beatsPerMs);
  }, []);

  /**
   * Capture or update user metadata on first interaction
   */
  const captureUserMetadata = useCallback((
    userId: string,
    username: string,
    instrument: string,
    category: InstrumentCategory,
    effectChain?: EffectChainState
  ) => {
    if (!userMetadataRef.current.has(userId)) {
      userMetadataRef.current.set(userId, {
        userId,
        username,
        instrument,
        category,
        effectChain,
      });
      console.log(`🎬 Captured metadata for user: ${username}`, { instrument, category });
    }
  }, []);

  /**
   * Find effect chain for a user from room state
   */
  const findUserEffectChain = useCallback((userId: string): EffectChainState | undefined => {
    const user = currentRoom?.users.find(u => u.id === userId);
    return user?.effectChains?.['virtual_instrument'];
  }, [currentRoom?.users]);

  // ============================================================================
  // Audio Recording
  // ============================================================================

  /**
   * Start recording audio for a specific user's stream
   */
  const startAudioRecording = useCallback((userId: string, username: string, stream: MediaStream) => {
    if (audioRecordersRef.current.has(userId)) {
      console.log(`🎤 Audio recording already exists for ${username}`);
      return;
    }

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 256000, // 256kbps as requested
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error(`🎤 Audio recording error for ${username}:`, event);
      };

      audioRecordersRef.current.set(userId, { recorder, chunks });
      recorder.start(100); // Collect data every 100ms

      console.log(`🎤 Started audio recording for ${username}`);
    } catch (error) {
      console.error(`🎤 Failed to start audio recording for ${username}:`, error);
    }
  }, []);

  /**
   * Stop all audio recorders and collect blobs
   */
  const stopAllAudioRecordings = useCallback((): Promise<Map<string, Blob>> => {
    return new Promise((resolve) => {
      const audioBlobs = new Map<string, Blob>();
      const recorders = Array.from(audioRecordersRef.current.entries());
      let completedCount = 0;

      if (recorders.length === 0) {
        resolve(audioBlobs);
        return;
      }

      recorders.forEach(([userId, { recorder, chunks }]) => {
        if (recorder.state === 'inactive') {
          // Already stopped
          if (chunks.length > 0) {
            audioBlobs.set(userId, new Blob(chunks, { type: 'audio/webm' }));
          }
          completedCount++;
          if (completedCount === recorders.length) {
            resolve(audioBlobs);
          }
          return;
        }

        recorder.onstop = () => {
          if (chunks.length > 0) {
            audioBlobs.set(userId, new Blob(chunks, { type: 'audio/webm' }));
          }
          completedCount++;
          if (completedCount === recorders.length) {
            resolve(audioBlobs);
          }
        };

        recorder.stop();
      });

      // Timeout fallback
      setTimeout(() => {
        if (completedCount < recorders.length) {
          console.warn('🎤 Some audio recorders did not stop in time');
          resolve(audioBlobs);
        }
      }, 2000);
    });
  }, []);

  // ============================================================================
  // MIDI Event Recording
  // ============================================================================

  /**
   * Record a MIDI event (called from PerformRoom when notes are played/received)
   */
  const recordMidiEvent = useCallback((
    userId: string,
    username: string,
    instrument: string,
    category: InstrumentCategory,
    notes: string[],
    velocity: number,
    eventType: 'note_on' | 'note_off' | 'sustain_on' | 'sustain_off'
  ) => {
    if (!isRecording) return;

    const beatPosition = timestampToBeats(performance.now());

    // Capture user metadata on first interaction
    captureUserMetadata(userId, username, instrument, category, findUserEffectChain(userId));

    // For sustain events, record a single event (no notes array)
    if (eventType === 'sustain_on' || eventType === 'sustain_off') {
      console.log(`🎹 Recording sustain event: ${eventType} at beat ${beatPosition.toFixed(2)}`);
      midiEventsRef.current.push({
        userId,
        username,
        instrument,
        category,
        note: '', // No specific note for sustain
        velocity: eventType === 'sustain_on' ? 127 : 0,
        eventType,
        beatPosition,
      });
      return;
    }

    // Record each note as a separate event
    for (const note of notes) {
      console.log(`🎹 Recording ${eventType}: ${note} vel=${velocity} at beat ${beatPosition.toFixed(2)}`);
      midiEventsRef.current.push({
        userId,
        username,
        instrument,
        category,
        note,
        velocity,
        eventType,
        beatPosition,
      });
    }
  }, [isRecording, timestampToBeats, captureUserMetadata, findUserEffectChain]);

  // ============================================================================
  // Recording Control
  // ============================================================================

  /**
   * Start recording session
   */
  const startRecording = useCallback(() => {
    if (isRecording) return;

    console.log('🎬 Starting session recording...');

    // Capture settings at start
    startTimeRef.current = performance.now();
    bpmAtStartRef.current = bpm;
    scaleAtStartRef.current = ownerScale || { rootNote: 'C', scale: 'major' };
    roomNameAtStartRef.current = currentRoom?.name || 'Session';

    // Clear previous recording data
    midiEventsRef.current = [];
    userMetadataRef.current.clear();
    audioRecordersRef.current.clear();

    // Start audio recording for local voice if available
    if (localVoiceStream && currentUser) {
      startAudioRecording(currentUser.id, currentUser.username, localVoiceStream);
    }

    // Start audio recording for remote voices via DOM audio elements
    // (Similar to usePerformRoomRecording approach)
    setTimeout(() => {
      const remoteVoiceElements = document.querySelectorAll<HTMLAudioElement>(
        'audio[data-webrtc-role="remote-voice"]'
      );
      
      remoteVoiceElements.forEach((audioElement) => {
        const odId = audioElement.getAttribute('data-webrtc-user');
        if (odId && audioElement.srcObject) {
          const voiceUser = voiceUsers.find(u => u.userId === odId);
          const username = voiceUser?.username || `User-${odId.slice(0, 6)}`;
          const stream = audioElement.srcObject as MediaStream;
          
          if (!audioRecordersRef.current.has(odId)) {
            startAudioRecording(odId, username, stream);
          }
        }
      });
    }, 500); // Small delay to ensure audio elements are ready

    setIsRecording(true);
    setRecordingDuration(0);

    // Update duration every second
    durationIntervalRef.current = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - startTimeRef.current) / 1000);
      setRecordingDuration(elapsed);
    }, 1000);

    console.log('🎬 Session recording started', {
      bpm: bpmAtStartRef.current,
      scale: scaleAtStartRef.current,
      roomName: roomNameAtStartRef.current,
    });
  }, [isRecording, bpm, ownerScale, currentRoom?.name, currentUser, localVoiceStream, voiceUsers, startAudioRecording]);

  /**
   * Stop recording and return the session snapshot
   */
  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    console.log('🎬 Stopping session recording...');

    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setIsRecording(false);

    try {
      // Stop all audio recorders and collect blobs
      const audioBlobs = await stopAllAudioRecordings();

      // Calculate duration in beats
      const durationBeats = timestampToBeats(performance.now());

      // Create snapshot
      const snapshot: SessionRecordingSnapshot = {
        bpm: bpmAtStartRef.current,
        scale: scaleAtStartRef.current,
        roomName: roomNameAtStartRef.current,
        midiEvents: [...midiEventsRef.current],
        userMetadata: new Map(userMetadataRef.current),
        audioBlobs,
        durationBeats,
      };

      console.log('🎬 Session recording complete', {
        midiEvents: snapshot.midiEvents.length,
        users: snapshot.userMetadata.size,
        audioTracks: snapshot.audioBlobs.size,
        durationBeats: snapshot.durationBeats,
      });

      onRecordingComplete?.(snapshot);

      return snapshot;
    } catch (error) {
      console.error('🎬 Error stopping session recording:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [isRecording, stopAllAudioRecordings, timestampToBeats, onRecordingComplete, onError]);

  /**
   * Toggle recording state
   */
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      return await stopRecording();
    } else {
      startRecording();
      return null;
    }
  }, [isRecording, startRecording, stopRecording]);

  // ============================================================================
  // Listen for remote notes via socket
  // ============================================================================

  useEffect(() => {
    if (!options.socket || !isRecording) return;

    const handleRemoteNote = (data: {
      userId: string;
      username: string;
      notes: string[];
      velocity: number;
      instrument: string;
      category: string;
      eventType: 'note_on' | 'note_off' | 'sustain_on' | 'sustain_off';
    }) => {
      // Don't record our own notes (already captured locally)
      if (data.userId === currentUser?.id) return;

      // Record the MIDI event
      recordMidiEvent(
        data.userId,
        data.username || 'Unknown',
        data.instrument,
        data.category as InstrumentCategory,
        data.notes || [],
        data.velocity,
        data.eventType
      );
    };

    options.socket.on('note_played', handleRemoteNote);

    return () => {
      options.socket?.off('note_played', handleRemoteNote);
    };
  }, [options.socket, isRecording, currentUser?.id, recordMidiEvent]);

  // ============================================================================
  // Handle new voice users joining during recording
  // ============================================================================

  useEffect(() => {
    if (!isRecording) return;

    // Check for new voice users via DOM audio elements
    const checkNewVoiceUsers = () => {
      const remoteVoiceElements = document.querySelectorAll<HTMLAudioElement>(
        'audio[data-webrtc-role="remote-voice"]'
      );
      
      remoteVoiceElements.forEach((audioElement) => {
        const odId = audioElement.getAttribute('data-webrtc-user');
        if (odId && audioElement.srcObject && !audioRecordersRef.current.has(odId)) {
          const voiceUser = voiceUsers.find(u => u.userId === odId);
          const username = voiceUser?.username || `User-${odId.slice(0, 6)}`;
          const stream = audioElement.srcObject as MediaStream;
          
          console.log(`🎤 New voice user detected during recording: ${username}`);
          startAudioRecording(odId, username, stream);
        }
      });
    };

    // Check immediately and then periodically
    checkNewVoiceUsers();
    const interval = setInterval(checkNewVoiceUsers, 2000);
    
    return () => clearInterval(interval);
  }, [isRecording, voiceUsers, startAudioRecording]);

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  useEffect(() => {
    const audioRecorders = audioRecordersRef.current;
    const durationInterval = durationIntervalRef.current;
    
    return () => {
      if (durationInterval) {
        clearInterval(durationInterval);
      }
      // Stop any active recorders
      audioRecorders.forEach(({ recorder }) => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      });
    };
  }, []);

  return {
    // State
    isRecording,
    recordingDuration,

    // Actions
    startRecording,
    stopRecording,
    toggleRecording,
    recordMidiEvent,
  };
}
