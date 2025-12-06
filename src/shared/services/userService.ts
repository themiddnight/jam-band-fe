import { useUserStore } from '../stores/userStore';

export const UserService = {
  getUserId: () => useUserStore.getState().userId,
  getUsername: () => useUserStore.getState().username,
  getUser: () => useUserStore.getState(),
};
