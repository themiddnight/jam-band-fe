const apiURL = `${import.meta.env.VITE_API_URL}/api`;

export const endpoints = {
  health: `${apiURL}/health`,
  listRooms: `${apiURL}/rooms`,
  createRoom: `${apiURL}/rooms`,
  leaveRoom: (roomId: string) => `${apiURL}/rooms/${roomId}/leave`,
  updateRoomSettings: (roomId: string) => `${apiURL}/rooms/${roomId}/settings`,
  roomAudioRegions: (roomId: string) => `${apiURL}/rooms/${roomId}/audio/regions`,
  roomAudioRegionFile: (roomId: string, regionId: string) =>
    `${apiURL}/rooms/${roomId}/audio/regions/${regionId}`,
};
