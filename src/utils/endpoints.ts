const apiURL = `${import.meta.env.VITE_API_URL}/api`;

export const endpoints = {
  health: `${apiURL}/health`,
  listRooms: `${apiURL}/rooms`,
};