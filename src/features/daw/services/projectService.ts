import { useProjectStore } from '../stores/projectStore';
import type { TimeSignature } from '../types/daw';

export const ProjectService = {
  getBpm: () => useProjectStore.getState().bpm,
  getTimeSignature: () => useProjectStore.getState().timeSignature,
  getProjectScale: () => useProjectStore.getState().projectScale,
  
  setBpm: (bpm: number) => useProjectStore.getState().setBpm(bpm),
  setTimeSignature: (timeSignature: TimeSignature) => 
    useProjectStore.getState().setTimeSignature(timeSignature),
  setProjectScale: (rootNote: string, scale: 'major' | 'minor') => 
    useProjectStore.getState().setProjectScale(rootNote, scale),
  setIsLoadingProject: (isLoading: boolean) => useProjectStore.getState().setIsLoadingProject(isLoading),
};
