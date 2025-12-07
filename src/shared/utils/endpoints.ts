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
  // Auth endpoints
  register: `${apiURL}/auth/register`,
  login: `${apiURL}/auth/login`,
  refreshToken: `${apiURL}/auth/refresh-token`,
  verifyEmail: (token: string) => `${apiURL}/auth/verify-email/${token}`,
  resendVerification: `${apiURL}/auth/resend-verification`,
  forgotPassword: `${apiURL}/auth/forgot-password`,
  resetPassword: `${apiURL}/auth/reset-password`,
  googleAuth: `${apiURL}/auth/google`,
  googleCallback: `${apiURL}/auth/google/callback`,
  getCurrentUser: `${apiURL}/auth/me`,
  updateUsername: `${apiURL}/auth/username`,
  logout: `${apiURL}/auth/logout`,
  // User presets and settings
  getUserPresets: (type?: string) => 
    type ? `${apiURL}/user/presets?type=${type}` : `${apiURL}/user/presets`,
  savePreset: `${apiURL}/user/presets`,
  updatePreset: (id: string) => `${apiURL}/user/presets/${id}`,
  deletePreset: (id: string) => `${apiURL}/user/presets/${id}`,
  getUserSettings: (type?: string) =>
    type ? `${apiURL}/user/settings?type=${type}` : `${apiURL}/user/settings`,
  updateUserSettings: `${apiURL}/user/settings`,
  // Feedback state
  getFeedbackState: `${apiURL}/user/feedback-state`,
  updateFeedbackState: `${apiURL}/user/feedback-state`,
  // AI Settings
  aiSettings: `${apiURL}/user/ai-settings`,
  // AI Generation
  aiGeneration: {
    generate: `${apiURL}/ai/generate`,
    cancel: `${apiURL}/ai/queue/cancel`,
    status: `${apiURL}/ai/queue/status`,
  },
  // Saved projects
  getUserProjects: `${apiURL}/projects`,
  saveProject: `${apiURL}/projects`,
  updateProject: (id: string) => `${apiURL}/projects/${id}`,
  deleteProject: (id: string) => `${apiURL}/projects/${id}`,
  loadProject: (id: string) => `${apiURL}/projects/${id}`,
};
