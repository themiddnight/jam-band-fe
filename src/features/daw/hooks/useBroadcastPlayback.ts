import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { useTrackStore } from '../stores/trackStore';
import { trackInstrumentRegistry } from '../utils/trackInstrumentRegistry';
import { midiNumberToNoteName } from '../utils/midiUtils';
import { useRoomSocketContext } from '@/features/rooms/hooks/useRoomSocketContext';

interface BroadcastNoteData {
  userId: string;
  trackId: string;
  noteData: {
    note: number;
    velocity: number;
    type: 'noteon' | 'noteoff';
  };
  timestamp: number;
}

interface UseBroadcastPlaybackProps {
  socket?: Socket | null;
  enabled: boolean;
}

// Track active notes per user per track
const activeNotesByUser = new Map<string, Map<string, Set<number>>>();

export const useBroadcastPlayback = ({
  socket: propSocket,
  enabled,
}: UseBroadcastPlaybackProps) => {
  const { socket: contextSocket } = useRoomSocketContext();
  const socket = propSocket ?? contextSocket;

  const tracks = useTrackStore((state) => state.tracks);
  const lastProcessedTimestampRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!socket || !enabled) return;

    const handleBroadcastNote = (data: BroadcastNoteData) => {
      try {
        console.log('[Broadcast Playback] Received note:', {
          userId: data.userId,
          trackId: data.trackId,
          note: data.noteData.note,
          velocity: data.noteData.velocity,
          type: data.noteData.type,
        });

        // Avoid processing duplicate messages
        // Include note and type in the key to allow chords (same timestamp, different notes)
        const messageKey = `${data.userId}-${data.timestamp}-${data.noteData.note}-${data.noteData.type}`;
        const lastTimestamp = lastProcessedTimestampRef.current.get(messageKey);
        if (lastTimestamp === data.timestamp) {
          console.log('[Broadcast Playback] Duplicate message, skipping');
          return;
        }
        lastProcessedTimestampRef.current.set(messageKey, data.timestamp);

        // Find the track
        const track = tracks.find((t) => t.id === data.trackId);
        if (!track || track.type !== 'midi') {
          console.log('[Broadcast Playback] Track not found or not MIDI:', data.trackId);
          return;
        }

        const { note, velocity, type } = data.noteData;
        const noteName = midiNumberToNoteName(note);
        console.log('[Broadcast Playback] Playing note:', noteName, 'on track:', track.name);

        // Initialize tracking structures
        if (!activeNotesByUser.has(data.userId)) {
          activeNotesByUser.set(data.userId, new Map());
        }
        const userNotes = activeNotesByUser.get(data.userId)!;
        if (!userNotes.has(data.trackId)) {
          userNotes.set(data.trackId, new Set());
        }
        const trackNotes = userNotes.get(data.trackId)!;

        // Handle note on/off
        if (type === 'noteon' && velocity > 0) {
          trackNotes.add(note);
          trackInstrumentRegistry
            .playNotes(track, noteName, {
              velocity,
              isKeyHeld: true,
            })
            .catch((error) => {
              console.error('Failed to play broadcast note:', error);
              trackNotes.delete(note);
            });
        } else if (type === 'noteoff' || velocity === 0) {
          trackNotes.delete(note);
          trackInstrumentRegistry
            .stopNotes(track, noteName)
            .catch((error) => {
              console.error('Failed to stop broadcast note:', error);
            });
        }

        // Cleanup old timestamps (keep last 100)
        if (lastProcessedTimestampRef.current.size > 100) {
          const entries = Array.from(lastProcessedTimestampRef.current.entries());
          entries.sort((a, b) => a[1] - b[1]);
          const toKeep = entries.slice(-100);
          lastProcessedTimestampRef.current = new Map(toKeep);
        }
      } catch (error) {
        console.error('Error handling broadcast note:', error);
      }
    };

    socket.on('arrange:broadcast_note', handleBroadcastNote);

    return () => {
      socket.off('arrange:broadcast_note', handleBroadcastNote);
    };
  }, [socket, enabled, tracks]);

  // Cleanup: stop all active broadcast notes when component unmounts
  useEffect(() => {
    return () => {
      activeNotesByUser.forEach((userNotes) => {
        userNotes.forEach((trackNotes, trackId) => {
          const track = tracks.find((t) => t.id === trackId);
          if (track && trackNotes.size > 0) {
            const noteNames = Array.from(trackNotes).map((note) =>
              midiNumberToNoteName(note)
            );
            trackInstrumentRegistry.stopNotes(track, noteNames).catch(() => {
              // Ignore cleanup errors
            });
          }
        });
      });
      activeNotesByUser.clear();
    };
  }, [tracks]);
};
