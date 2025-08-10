import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UserState {
  username: string | null;
  userId: string | null;
  setUsername: (username: string) => void;
  setUserId: (userId: string) => void;
  generateUserId: () => string;
  clearUser: () => void;
  ensureUserId: () => string;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      username: null,
      userId: null,
      setUsername: (username: string) => set({ username }),
      setUserId: (userId: string) => set({ userId }),
      generateUserId: () => {
        const userId = uuidv4();
        set({ userId });
        return userId;
      },
      clearUser: () => set({ username: null, userId: null }),
      ensureUserId: () => {
        const { userId } = get();
        if (!userId) {
          const newUserId = uuidv4();
          set({ userId: newUserId });
          return newUserId;
        }
        return userId;
      },
    }),
    {
      name: "user-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
