import { useCallback, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { useBroadcastStore } from '../stores/broadcastStore';
import { useTrackStore } from '../stores/trackStore';
import type { MidiMessage } from './useMidiInput';

interface UseBroadcastProps {
  socket: Socket | null;
  roomId: string | null;
  userId: string;
  username: string;
  enabled: boolean;
}

interface UseBroadcastReturn {
  handleBroadcastToggle: (broadcasting: boolean, trackId: string | null) => void;
  broadcastMidiMessage: (message: MidiMessage) => void;
  getBroadcastUsers: () => Array<{ userId: string; username: string; trackId: string }>;
}

export const useBroadcast = ({
  socket,
  roomId,
  userId,
  username,
  enabled,
}: UseBroadcastProps): UseBroadcastReturn => {
  const isBroadcasting = useBroadcastStore((state) => state.isBroadcasting);
  const setBroadcasting = useBroadcastStore((state) => state.setBroadcasting);
  const addBroadcastingUser = useBroadcastStore((state) => state.addBroadcastingUser);
  const removeBroadcastingUser = useBroadcastStore((state) => state.removeBroadcastingUser);
  const updateBroadcastingUserTrack = useBroadcastStore((state) => state.updateBroadcastingUserTrack);
  const broadcastingUsers = useBroadcastStore((state) => state.broadcastingUsers);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  
  const currentTrackIdRef = useRef<string | null>(null);

  // Handle broadcast toggle
  const handleBroadcastToggle = useCallback(
    (broadcasting: boolean, trackId: string | null) => {
      if (!socket || !roomId || !enabled) return;

      setBroadcasting(broadcasting);
      currentTrackIdRef.current = trackId;

      if (broadcasting && trackId) {
        addBroadcastingUser(userId, username, trackId);
      } else {
        removeBroadcastingUser(userId);
      }

      // Emit broadcast state change to server
      socket.emit('arrange:broadcast_state', {
        roomId,
        userId,
        username,
        broadcasting,
        trackId,
      });
    },
    [
      socket,
      roomId,
      userId,
      username,
      enabled,
      setBroadcasting,
      addBroadcastingUser,
      removeBroadcastingUser,
    ]
  );

  // Broadcast MIDI message
  const broadcastMidiMessage = useCallback(
    (message: MidiMessage) => {
      if (!socket || !roomId || !enabled || !isBroadcasting || !selectedTrackId) {
        // Debug: Log why broadcast is not happening
        if (!socket) console.log('[Broadcast] No socket');
        if (!roomId) console.log('[Broadcast] No roomId');
        if (!enabled) console.log('[Broadcast] Not enabled');
        if (!isBroadcasting) console.log('[Broadcast] Not broadcasting');
        if (!selectedTrackId) console.log('[Broadcast] No selected track');
        return;
      }

      // Only broadcast note on/off events
      if (message.type !== 'noteon' && message.type !== 'noteoff') return;

      console.log('[Broadcast] Sending note:', {
        type: message.type,
        note: message.note,
        velocity: message.velocity,
        trackId: selectedTrackId,
      });

      socket.emit('arrange:broadcast_note', {
        roomId,
        userId,
        trackId: selectedTrackId,
        noteData: {
          note: message.note,
          velocity: message.velocity,
          type: message.type,
        },
        timestamp: Date.now(),
      });
    },
    [socket, roomId, userId, enabled, isBroadcasting, selectedTrackId]
  );

  // Update broadcast track when selected track changes
  useEffect(() => {
    if (!socket || !roomId || !enabled || !isBroadcasting) return;
    
    // If track changed while broadcasting, notify others
    if (selectedTrackId && selectedTrackId !== currentTrackIdRef.current) {
      currentTrackIdRef.current = selectedTrackId;
      updateBroadcastingUserTrack(userId, selectedTrackId);
      socket.emit('arrange:broadcast_state', {
        roomId,
        userId,
        username,
        broadcasting: true,
        trackId: selectedTrackId,
      });
    }
  }, [
    socket,
    roomId,
    userId,
    username,
    enabled,
    isBroadcasting,
    selectedTrackId,
    updateBroadcastingUserTrack,
  ]);

  // Listen for broadcast state changes from other users
  useEffect(() => {
    if (!socket || !enabled) return;

    const handleBroadcastState = (data: {
      userId: string;
      username: string;
      broadcasting: boolean;
      trackId: string | null;
    }) => {
      // Ignore own broadcasts
      if (data.userId === userId) return;

      if (data.broadcasting && data.trackId) {
        addBroadcastingUser(data.userId, data.username, data.trackId);
      } else {
        removeBroadcastingUser(data.userId);
      }
    };

    socket.on('arrange:broadcast_state', handleBroadcastState);

    return () => {
      socket.off('arrange:broadcast_state', handleBroadcastState);
    };
  }, [socket, userId, enabled, addBroadcastingUser, removeBroadcastingUser]);

  // Get broadcast users as array
  const getBroadcastUsers = useCallback(() => {
    return Array.from(broadcastingUsers.values());
  }, [broadcastingUsers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket && roomId && isBroadcasting) {
        socket.emit('arrange:broadcast_state', {
          roomId,
          userId,
          username,
          broadcasting: false,
          trackId: null,
        });
        setBroadcasting(false);
        removeBroadcastingUser(userId);
      }
    };
  }, [socket, roomId, userId, username, isBroadcasting, setBroadcasting, removeBroadcastingUser]);

  return {
    handleBroadcastToggle,
    broadcastMidiMessage,
    getBroadcastUsers,
  };
};
