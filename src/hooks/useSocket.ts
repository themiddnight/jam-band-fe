import { useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '../stores/roomStore';
import { useUserStore } from '../stores/userStore';

interface NoteData {
  notes: string[];
  velocity: number;
  instrument: string;
  category: string;
  eventType: 'note_on' | 'note_off' | 'sustain_on' | 'sustain_off';
  isKeyHeld?: boolean;
}

interface NoteReceivedData {
  userId: string;
  username: string;
  notes: string[];
  velocity: number;
  instrument: string;
  category: string;
  eventType: 'note_on' | 'note_off' | 'sustain_on' | 'sustain_off';
  isKeyHeld?: boolean;
}

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const roomCreatedCallbackRef = useRef<((room: any) => void) | null>(null);
  const roomClosedCallbackRef = useRef<((roomId: string) => void) | null>(null);
  const userLeftCallbackRef = useRef<((user: any) => void) | null>(null);
  const instrumentChangedCallbackRef = useRef<((data: { userId: string; username: string; instrument: string; category: string }) => void) | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnectedState] = useState(false);
  const pendingOperationsRef = useRef<Array<() => void>>([]);
  const lastRoomCreatedRef = useRef<string>('');
  const connectingRef = useRef<boolean>(false);
  
  const {
    setCurrentRoom,
    setCurrentUser,
    setIsConnected,
    setPendingApproval,
    setError,
    addUser,
    removeUser,
    addPendingMember,
    removePendingMember,
    updateMixerSettings,
    updateUserInstrument,
    transferOwnership,
    clearRoom
  } = useRoomStore();

  // Execute pending operations when socket connects
  const executePendingOperations = useCallback(() => {
    while (pendingOperationsRef.current.length > 0) {
      const operation = pendingOperationsRef.current.shift();
      if (operation) {
        operation();
      }
    }
  }, []);

  // Safe emit function that waits for connection
  const safeEmit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      // Queue the operation to execute when connected
      pendingOperationsRef.current.push(() => {
        if (socketRef.current?.connected) {
          socketRef.current.emit(event, data);
        }
      });
    }
  }, []);

  // Connect to socket server
  const connect = useCallback(() => {
    if (socketRef.current?.connected || isConnecting || connectingRef.current) {
      console.log('Socket already connected, connecting, or connection in progress, skipping');
      return;
    }

    // Clean up existing socket if any
    if (socketRef.current) {
      console.log('Cleaning up existing socket connection');
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    console.log('Creating new socket connection');
    connectingRef.current = true;
    setIsConnecting(true);
    
    // Use environment variable for backend URL
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const socket = io(backendUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      connectingRef.current = false;
      setIsConnected(true);
      setIsConnectedState(true);
      setError(null);
      setIsConnecting(false);
      
      // Execute any pending operations
      executePendingOperations();
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      connectingRef.current = false;
      setIsConnected(false);
      setIsConnectedState(false);
      setIsConnecting(false);
      setError('Connection lost');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      connectingRef.current = false;
      setIsConnecting(false);
      setError('Failed to connect to server');
    });

    socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      setError(data.message);
    });

    // Room events
    socket.on('room_created', (data: { room: any; user: any }) => {
      console.log('Room created:', data);
      setCurrentRoom(data.room);
      setCurrentUser(data.user);
      setError(null);
    });

    socket.on('room_created_broadcast', (data: { id: string; name: string; userCount: number; owner: string; createdAt: string }) => {
      console.log('Room created broadcast received:', data);
      
      // Prevent duplicate calls for the same room
      if (lastRoomCreatedRef.current === data.id) {
        console.log('Skipping duplicate room created broadcast for:', data.id);
        return;
      }
      
      lastRoomCreatedRef.current = data.id;
      if (roomCreatedCallbackRef.current) {
        roomCreatedCallbackRef.current(data);
      }
      
      // Reset the last room created reference after a delay to allow for legitimate duplicates
      setTimeout(() => {
        if (lastRoomCreatedRef.current === data.id) {
          lastRoomCreatedRef.current = '';
        }
      }, 1000);
    });

    socket.on('room_joined', (data: { room: any; users: any[]; pendingMembers: any[]; mixerMode: string; mixerSettings: Record<string, number> }) => {
      console.log('Room joined:', data);
      setCurrentRoom({
        ...data.room,
        users: data.users,
        pendingMembers: data.pendingMembers,
        mixerMode: data.mixerMode,
        mixerSettings: data.mixerSettings
      });
      
      // Set currentUser based on the current username
      const currentUsername = useUserStore.getState().username;
      if (currentUsername) {
        const currentUserData = data.users.find((user: any) => user.username === currentUsername);
        if (currentUserData) {
          console.log('Setting current user from room_joined:', currentUserData);
          setCurrentUser(currentUserData);
        }
      }
      
      setError(null);
    });

    socket.on('user_joined', (data: { user: any }) => {
      console.log('User joined:', data.user);
      addUser(data.user);
    });

    socket.on('user_left', (data: { user: any }) => {
      console.log('User left:', data.user);
      removeUser(data.user.id);
      
      // Call the callback if set
      if (userLeftCallbackRef.current) {
        userLeftCallbackRef.current(data.user);
      }
    });

    socket.on('member_request', (data: { user: any }) => {
      console.log('Member request:', data.user);
      addPendingMember(data.user);
    });

    socket.on('member_approved', (data: { user?: any; room?: any }) => {
      if (data.user) {
        console.log('Member approved:', data.user);
        removePendingMember(data.user.id);
        addUser(data.user);
      }
      if (data.room) {
        console.log('Room updated after approval:', data.room);
        setCurrentRoom(data.room);
        // Clear pending approval since the user has been approved
        setPendingApproval(false);
        
        // Update currentUser if this approval is for the current user
        const currentUsername = useUserStore.getState().username;
        if (currentUsername) {
          const approvedUser = data.room.users.find((user: any) => user.username === currentUsername);
          if (approvedUser) {
            console.log('Updating current user after approval:', approvedUser);
            setCurrentUser(approvedUser);
          }
        }
      }
    });

    socket.on('member_rejected', (data: { message: string }) => {
      console.log('Member rejected:', data.message);
      setError(data.message);
    });

    socket.on('pending_approval', (data: { message: string }) => {
      console.log('Pending approval:', data.message);
      setPendingApproval(true);
    });

    socket.on('ownership_transferred', (data: { newOwner: any; oldOwner: any }) => {
      console.log('Ownership transferred:', data);
      transferOwnership(data.newOwner.id);
    });

    socket.on('room_closed', (data: { message: string }) => {
      console.log('Room closed:', data.message);
      setError(data.message);
      clearRoom();
    });

    socket.on('room_closed_broadcast', (data: { roomId: string }) => {
      console.log('Room closed broadcast:', data.roomId);
      if (roomClosedCallbackRef.current) {
        roomClosedCallbackRef.current(data.roomId);
      }
      clearRoom();
    });

    socket.on('note_played', (data: NoteReceivedData) => {
      console.log('Note received:', data);
      // This will be handled by the component using the hook
    });

    socket.on('instrument_changed', (data: { userId: string; username: string; instrument: string; category: string }) => {
      console.log('🎵 Socket: Instrument changed:', data);
      
      // Update the room store first
      updateUserInstrument(data.userId, data.instrument, data.category);
      
      // Call the callback if set
      if (instrumentChangedCallbackRef.current) {
        console.log('🔄 Calling instrument changed callback');
        instrumentChangedCallbackRef.current(data);
      }
    });

    socket.on('mixer_updated', (data: { mode: string; settings: Record<string, number> }) => {
      console.log('Mixer updated:', data);
      updateMixerSettings(data.mode as 'original' | 'custom', data.settings);
    });
  }, [setCurrentRoom, setCurrentUser, setIsConnected, setPendingApproval, setError, addUser, removeUser, addPendingMember, removePendingMember, updateMixerSettings, transferOwnership, clearRoom, executePendingOperations]);

  // Create room
  const createRoom = useCallback((name: string, username: string) => {
    safeEmit('create_room', { name, username });
  }, [safeEmit]);

  // Join room
  const joinRoom = useCallback((roomId: string, username: string, role: 'band_member' | 'audience') => {
    safeEmit('join_room', { roomId, username, role });
  }, [safeEmit]);

  // Leave room
  const leaveRoom = useCallback(() => {
    safeEmit('leave_room', {});
    
    // Clear room state immediately to prevent reconnection
    clearRoom();
  }, [safeEmit, clearRoom]);

  // Approve member
  const approveMember = useCallback((userId: string) => {
    safeEmit('approve_member', { userId });
  }, [safeEmit]);

  // Reject member
  const rejectMember = useCallback((userId: string) => {
    safeEmit('reject_member', { userId });
  }, [safeEmit]);

  // Transfer ownership
  const transferOwnershipTo = useCallback((newOwnerId: string) => {
    safeEmit('transfer_ownership', { newOwnerId });
  }, [safeEmit]);

  // Play note
  const playNote = useCallback((data: NoteData) => {
    safeEmit('play_note', data);
  }, [safeEmit]);

  // Change instrument
  const changeInstrument = useCallback((instrument: string, category: string) => {
    safeEmit('change_instrument', { instrument, category });
  }, [safeEmit]);

  // Update mixer
  const updateMixer = useCallback((mode: 'original' | 'custom', settings?: Record<string, number>) => {
    safeEmit('update_mixer', { mode, settings });
  }, [safeEmit]);

  // Handle note received
  const onNoteReceived = useCallback((callback: (data: NoteReceivedData) => void) => {
    if (!socketRef.current) return () => {};

    const handleNoteReceived = (data: NoteReceivedData) => {
      callback(data);
    };

    socketRef.current.on('note_played', handleNoteReceived);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('note_played', handleNoteReceived);
      }
    };
  }, []);

  // Set room created callback
  const onRoomCreated = useCallback((callback: (room: any) => void) => {
    console.log('Setting room created callback');
    roomCreatedCallbackRef.current = callback;
  }, []);

  // Set room closed callback
  const onRoomClosed = useCallback((callback: (roomId: string) => void) => {
    roomClosedCallbackRef.current = callback;
  }, []);

  // Set user left callback
  const onUserLeft = useCallback((callback: (user: any) => void) => {
    userLeftCallbackRef.current = callback;
  }, []);

  // Set instrument changed callback
  const onInstrumentChanged = useCallback((callback: (data: { userId: string; username: string; instrument: string; category: string }) => void) => {
    instrumentChangedCallbackRef.current = callback;
  }, []);





  return {
    connect,
    createRoom,
    joinRoom,
    leaveRoom,
    approveMember,
    rejectMember,
    transferOwnershipTo,
    playNote,
    changeInstrument,
    updateMixer,
    onNoteReceived,
    onRoomCreated,
    onRoomClosed,
    onUserLeft,
    onInstrumentChanged,
    isConnected: isConnected,
    isConnecting,
    socketRef // Expose the socket instance
  };
}; 