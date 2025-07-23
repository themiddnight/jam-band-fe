import { create } from 'zustand';

export interface RoomUser {
  id: string;
  username: string;
  role: 'room_owner' | 'band_member' | 'audience';
  currentInstrument?: string;
  currentCategory?: string;
  isReady: boolean;
}

export interface Room {
  id: string;
  name: string;
  owner: string;
  users: RoomUser[];
  pendingMembers: RoomUser[];
  mixerMode: 'original' | 'custom';
  mixerSettings: Record<string, number>;
  createdAt: Date;
}

interface RoomState {
  currentRoom: Room | null;
  currentUser: RoomUser | null;
  isConnected: boolean;
  pendingApproval: boolean;
  error: string | null;
  setCurrentRoom: (room: Room | null) => void;
  setCurrentUser: (user: RoomUser | null) => void;
  setIsConnected: (connected: boolean) => void;
  setPendingApproval: (pending: boolean) => void;
  setError: (error: string | null) => void;
  updateUserInstrument: (userId: string, instrument: string, category: string) => void;
  addUser: (user: RoomUser) => void;
  removeUser: (userId: string) => void;
  addPendingMember: (user: RoomUser) => void;
  removePendingMember: (userId: string) => void;
  updateMixerSettings: (mode: 'original' | 'custom', settings?: Record<string, number>) => void;
  transferOwnership: (newOwnerId: string) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  currentRoom: null,
  currentUser: null,
  isConnected: false,
  pendingApproval: false,
  error: null,

  setCurrentRoom: (room) => set({ currentRoom: room }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setPendingApproval: (pending) => set({ pendingApproval: pending }),
  setError: (error) => set({ error }),

  updateUserInstrument: (userId, instrument, category) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    const updatedUsers = currentRoom.users.map(user =>
      user.id === userId 
        ? { ...user, currentInstrument: instrument, currentCategory: category }
        : user
    );

    set({
      currentRoom: { ...currentRoom, users: updatedUsers }
    });
  },

  addUser: (user) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    // Check if user already exists to prevent duplicates
    const userExists = currentRoom.users.some(existingUser => existingUser.id === user.id);
    if (userExists) {
      console.log('User already exists in room, skipping add:', user.id);
      return;
    }

    set({
      currentRoom: {
        ...currentRoom,
        users: [...currentRoom.users, user]
      }
    });
  },

  removeUser: (userId) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    set({
      currentRoom: {
        ...currentRoom,
        users: currentRoom.users.filter(user => user.id !== userId)
      }
    });
  },

  addPendingMember: (user) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    set({
      currentRoom: {
        ...currentRoom,
        pendingMembers: [...currentRoom.pendingMembers, user]
      }
    });
  },

  removePendingMember: (userId) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    set({
      currentRoom: {
        ...currentRoom,
        pendingMembers: currentRoom.pendingMembers.filter(user => user.id !== userId)
      }
    });
  },

  updateMixerSettings: (mode, settings) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    // Prevent infinite loops by checking if the values are actually different
    const newSettings = settings || currentRoom.mixerSettings;
    const hasChanged = 
      currentRoom.mixerMode !== mode || 
      JSON.stringify(currentRoom.mixerSettings) !== JSON.stringify(newSettings);

    if (!hasChanged) {
      return; // No change, don't update
    }

    set({
      currentRoom: {
        ...currentRoom,
        mixerMode: mode,
        mixerSettings: newSettings
      }
    });
  },

  transferOwnership: (newOwnerId) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    const updatedUsers = currentRoom.users.map(user => {
      if (user.id === newOwnerId) {
        return { ...user, role: 'room_owner' as const };
      } else if (user.id === currentRoom.owner) {
        return { ...user, role: 'band_member' as const };
      }
      return user;
    });

    set({
      currentRoom: {
        ...currentRoom,
        owner: newOwnerId,
        users: updatedUsers
      }
    });
  },

  clearRoom: () => set({
    currentRoom: null,
    currentUser: null,
    isConnected: false,
    pendingApproval: false,
    error: null
  })
})); 