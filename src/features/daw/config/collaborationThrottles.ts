export const COLLAB_THROTTLE_INTERVALS = {
  regionDragMs: 200,
  regionRealtimeMs: 200,
  noteRealtimeMs: 200,
  trackPropertyMs: 200,
  effectChainMs: 200,
  synthParamsMs: 200,
  recordingPreviewMs: 200,
  markerMs: 200,
} as const;

export type CollaborationThrottleKey = keyof typeof COLLAB_THROTTLE_INTERVALS;
