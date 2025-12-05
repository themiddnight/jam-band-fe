import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "../api/auth";
import { setToken, removeToken } from "../api/auth";

export type UserType = "GUEST" | "REGISTERED" | "PREMIUM";

export interface UserState {
  // Legacy fields (for backward compatibility)
  username: string | null;
  userId: string | null;

  // Auth fields
  userType: UserType;
  isAuthenticated: boolean;
  email: string | null;
  authUser: User | null;

  // Actions
  setUsername: (username: string) => void;
  setUserId: (userId: string) => void;
  generateUserId: () => string;
  clearUser: () => void;
  ensureUserId: () => string;

  // Auth actions
  setAsGuest: () => void;
  setAsRegistered: (user: User, token: string) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateAuthUser: (user: User) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Legacy fields
      username: null,
      userId: null,

      // Auth fields
      userType: "GUEST" as UserType,
      isAuthenticated: false,
      email: null,
      authUser: null,

      // Legacy actions
      setUsername: (username: string) => set({ username }),
      setUserId: (userId: string) => set({ userId }),
      generateUserId: () => {
        const userId = uuidv4();
        set({ userId });
        return userId;
      },
      clearUser: () => {
        removeToken();
        set({
          username: null,
          userId: null,
          userType: "GUEST",
          isAuthenticated: false,
          email: null,
          authUser: null,
        });
      },
      ensureUserId: () => {
        const { userId } = get();
        if (!userId) {
          const newUserId = uuidv4();
          set({ userId: newUserId });
          return newUserId;
        }
        return userId;
      },

      // Auth actions
      setAsGuest: () => {
        removeToken();
        const guestId = uuidv4();
        // Generate random guest username
        const adjectives = ['Cool', 'Epic', 'Rad', 'Smooth', 'Sharp', 'Bold', 'Swift', 'Bright', 'Wild', 'Calm', 'Neat', 'Fast', 'Loud', 'Soft', 'Deep', 'High', 'Low', 'Warm', 'Cold', 'Fresh'];
        const nouns = ['Player', 'Musician', 'Artist', 'Creator', 'Maker', 'Star', 'Beat', 'Note', 'Sound', 'Tune', 'Melody', 'Rhythm', 'Groove', 'Vibe', 'Flow', 'Wave', 'Tone', 'Pitch', 'Key', 'Chord'];
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNumber = Math.floor(Math.random() * 1000);
        const guestUsername = `${randomAdjective}${randomNoun}${randomNumber}`;

        set({
          userType: "GUEST",
          isAuthenticated: false,
          email: null,
          authUser: null,
          userId: guestId,
          username: guestUsername,
        });
      },
      setAsRegistered: (user: User, token: string) => {
        setToken(token);
        set({
          userType: user.userType as UserType,
          isAuthenticated: true,
          email: user.email,
          authUser: user,
          userId: user.id,
          username: user.username || `User_${user.id.slice(0, 6)}`,
        });
      },
      login: (user: User, token: string) => {
        setToken(token);
        set({
          userType: user.userType as UserType,
          isAuthenticated: true,
          email: user.email,
          authUser: user,
          userId: user.id,
          username: user.username || `User_${user.id.slice(0, 6)}`,
        });
      },
      logout: () => {
        removeToken();
        set({
          userType: "GUEST",
          isAuthenticated: false,
          email: null,
          authUser: null,
          // Keep userId and username for guest mode
        });
      },
      updateAuthUser: (user: User) => {
        set({
          authUser: user,
          email: user.email,
          username: user.username || get().username,
          userType: user.userType as UserType,
        });
      },
    }),
    {
      name: "user-store",
      storage: createJSONStorage(() => localStorage),
      // Persist both authenticated users and guests to allow page refreshes
      partialize: (state) => ({
        userType: state.userType,
        isAuthenticated: state.isAuthenticated,
        email: state.email,
        authUser: state.authUser,
        userId: state.userId,
        username: state.username,
      }),
    },
  ),
);
