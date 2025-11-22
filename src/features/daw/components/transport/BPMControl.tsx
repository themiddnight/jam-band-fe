import { useProjectStore } from '../../stores/projectStore';
import { useDAWCollaborationContext } from '../../contexts/useDAWCollaborationContext';
import { BPMControl as SharedBPMControl } from '@/features/metronome';

export const BPMControl = () => {
  const bpm = useProjectStore((state) => state.bpm);
  const { handleBpmChange } = useDAWCollaborationContext();

  return <SharedBPMControl bpm={bpm} onBpmChange={handleBpmChange} size="xs" />;
};

