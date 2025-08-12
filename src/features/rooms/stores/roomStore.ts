import type { Room, RoomUser } from "../../../shared/types";
import { create } from "zustand";

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
  updateUserInstrument: (
    userId: string,
    instrument: string,
    category: string,
  ) => void;
  addUser: (user: RoomUser) => void;
  removeUser: (userId: string) => void;
  addPendingMember: (user: RoomUser) => void;
  removePendingMember: (userId: string) => void;

  transferOwnership: (newOwnerId: string) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  currentRoom: null,
  currentUser: null,
  isConnected: false,
  pendingApproval: false,
  error: null,

  setCurrentRoom: (room) => {
    if (room) {
      // Ensure the room has proper structure
      const normalizedRoom = {
        ...room,
        users: room.users || [],
        pendingMembers: room.pendingMembers || [],
      };
      set({ currentRoom: normalizedRoom });
    } else {
      set({ currentRoom: null });
    }
  },
  setCurrentUser: (user) => set({ currentUser: user }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setPendingApproval: (pending) => set({ pendingApproval: pending }),
  setError: (error) => set({ error }),

  updateUserInstrument: (userId, instrument, category) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    const updatedUsers = currentRoom.users.map((user) =>
      user.id === userId
        ? { ...user, currentInstrument: instrument, currentCategory: category }
        : user,
    );

    set({
      currentRoom: { ...currentRoom, users: updatedUsers },
    });
  },

  addUser: (user) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    // Check if user already exists to prevent duplicates
    const userExists = currentRoom.users.some(
      (existingUser) => existingUser.id === user.id,
    );
    if (userExists) {
      console.log("User already exists in room, skipping add:", user.id);
      return;
    }

    // Remove user from pending members if they exist there
    const updatedPendingMembers = currentRoom.pendingMembers.filter(
      (pendingUser) => pendingUser.id !== user.id,
    );

    set({
      currentRoom: {
        ...currentRoom,
        users: [...currentRoom.users, user],
        pendingMembers: updatedPendingMembers,
      },
    });
  },

  removeUser: (userId) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    set({
      currentRoom: {
        ...currentRoom,
        users: currentRoom.users.filter((user) => user.id !== userId),
      },
    });
  },

  addPendingMember: (user) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    set({
      currentRoom: {
        ...currentRoom,
        pendingMembers: [...currentRoom.pendingMembers, user],
      },
    });
  },

  removePendingMember: (userId) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    set({
      currentRoom: {
        ...currentRoom,
        pendingMembers: currentRoom.pendingMembers.filter(
          (user) => user.id !== userId,
        ),
      },
    });
  },

  transferOwnership: (newOwnerId) => {
    const { currentRoom, currentUser } = get();
    if (!currentRoom) return;

    const updatedUsers = currentRoom.users.map((user) => {
      if (user.id === newOwnerId) {
        return { ...user, role: "room_owner" as const };
      } else if (user.id === currentRoom.owner) {
        return { ...user, role: "band_member" as const };
      }
      return user;
    });

    // Update current user if they are the new owner
    let updatedCurrentUser = currentUser;
    if (currentUser && currentUser.id === newOwnerId) {
      updatedCurrentUser = { ...currentUser, role: "room_owner" as const };
    } else if (currentUser && currentUser.id === currentRoom.owner) {
      updatedCurrentUser = { ...currentUser, role: "band_member" as const };
    }

    set({
      currentRoom: {
        ...currentRoom,
        owner: newOwnerId,
        users: updatedUsers,
      },
      currentUser: updatedCurrentUser,
    });
  },

  clearRoom: () =>
    set({
      currentRoom: null,
      currentUser: null,
      isConnected: false,
      pendingApproval: false,
      error: null,
    }),
}));
