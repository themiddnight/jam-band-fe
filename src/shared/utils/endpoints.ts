const apiURL = `${import.meta.env.VITE_API_URL}/api`;

export const endpoints = {
  health: `${apiURL}/health`,
  listRooms: `${apiURL}/rooms`,
  createRoom: `${apiURL}/rooms`,
  leaveRoom: (roomId: string) => `${apiURL}/rooms/${roomId}/leave`,
  updateRoomSettings: (roomId: string) => `${apiURL}/rooms/${roomId}/settings`,
};
