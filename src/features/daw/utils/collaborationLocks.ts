export const getRegionLockId = (regionId: string) => regionId;

export const getNoteLockId = (regionId: string, noteId: string) =>
  `note:${regionId}:${noteId}`;

export const getSustainLockId = (regionId: string, eventId: string) =>
  `sustain:${regionId}:${eventId}`;

export const getControlLockId = (controlId: string) => `control:${controlId}`;

export const getTrackVolumeLockId = (trackId: string) => `track:${trackId}:volume`;

export const getTrackPanLockId = (trackId: string) => `track:${trackId}:pan`;

export const getSynthParamLockId = (trackId: string, param: string) =>
  `synth:${trackId}:${param}`;

export const getEffectParamLockId = (trackId: string, effectId: string, param: string) =>
  `effect:${trackId}:${effectId}:${param}`;
