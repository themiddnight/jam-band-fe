import { useProjectStore } from '../projectStore';

// Selectors
export const selectBpm = (state: { bpm: number }) => state.bpm;
export const selectTimeSignature = (state: { timeSignature: any }) => state.timeSignature;
export const selectTransportState = (state: { transportState: string }) => state.transportState;
export const selectPlayhead = (state: { playhead: number }) => state.playhead;
export const selectIsRecording = (state: { isRecording: boolean }) => state.isRecording;
export const selectGridDivision = (state: { gridDivision: number }) => state.gridDivision;
export const selectLoop = (state: { loop: any }) => state.loop;
export const selectIsMetronomeEnabled = (state: { isMetronomeEnabled: boolean }) => state.isMetronomeEnabled;
export const selectSnapToGrid = (state: { snapToGrid: boolean }) => state.snapToGrid;
export const selectProjectScale = (state: { projectScale: any }) => state.projectScale;

// Hook wrappers
export const useBpm = () => useProjectStore(selectBpm);
export const useTimeSignature = () => useProjectStore(selectTimeSignature);
export const useTransportState = () => useProjectStore(selectTransportState);
export const usePlayhead = () => useProjectStore(selectPlayhead);
export const useIsRecording = () => useProjectStore(selectIsRecording);
export const useGridDivision = () => useProjectStore(selectGridDivision);
export const useLoop = () => useProjectStore(selectLoop);
export const useIsMetronomeEnabled = () => useProjectStore(selectIsMetronomeEnabled);
export const useSnapToGrid = () => useProjectStore(selectSnapToGrid);
export const useProjectScale = () => useProjectStore(selectProjectScale);

// Action selectors
export const useProjectActions = () => useProjectStore((state) => ({
  setBpm: state.setBpm,
  setTimeSignature: state.setTimeSignature,
  setTransportState: state.setTransportState,
  setPlayhead: state.setPlayhead,
  setGridDivision: state.setGridDivision,
  setLoop: state.setLoop,
  toggleLoop: state.toggleLoop,
  toggleMetronome: state.toggleMetronome,
  toggleRecording: state.toggleRecording,
  toggleSnap: state.toggleSnap,
  setProjectScale: state.setProjectScale,
  setIsLoadingProject: state.setIsLoadingProject,
  setIsSavingProject: state.setIsSavingProject,
  reset: state.reset,
}));
