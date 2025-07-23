import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UserState {
  username: string | null;
  setUsername: (username: string) => void;
  clearUsername: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      username: null,
      setUsername: (username: string) => set({ username }),
      clearUsername: () => set({ username: null }),
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
); 