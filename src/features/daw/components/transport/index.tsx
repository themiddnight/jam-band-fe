import { memo, useEffect } from 'react';
import { BPMControl } from './BPMControl';
import { ProjectScaleControl } from './ProjectScaleControl';
import { Metronome } from './Metronome';
import { TimeSignatureControl } from './TimeSignatureControl';
import { TransportControls } from './TransportControls';
import { useToneTransportSync } from '../../hooks/useToneTransportSync';
import { useMidiStore } from '../../stores/midiStore';
import { useProjectStore } from '../../stores/projectStore';
import ScaleSelector from '@/features/ui/components/ScaleSelector';
import { useArrangeRoomScaleStore } from '../../stores/arrangeRoomStore';
import { SnapToggle } from './SnapToggle';

export const TransportToolbar = memo(() => {
  useToneTransportSync();
  const isEnabled = useMidiStore((state) => state.isEnabled);
  const inputs = useMidiStore((state) => state.inputs);
  const projectScale = useProjectStore((state) => state.projectScale);
  const { rootNote, scale, followProject, setRootNote, setScale, setFollowProject } = useArrangeRoomScaleStore();

  // Sync local scale with project scale when following
  useEffect(() => {
    if (followProject) {
      setRootNote(projectScale.rootNote);
      setScale(projectScale.scale);
    }
  }, [followProject, projectScale, setRootNote, setScale]);

  return (
    <section className="sticky top-0 z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-base-200/95 px-2 sm:px-4 py-2 backdrop-blur-md shadow-sm">
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        <TransportControls />
        <div className="divider divider-horizontal mx-0" />
        <SnapToggle />
        <Metronome />
        <div className="flex items-center gap-1 sm:gap-2 rounded-lg border border-base-300 bg-base-100/80 px-1 sm:px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/60 hidden sm:inline">
            Scale
          </span>
          <ScaleSelector
            rootNote={rootNote}
            scale={scale}
            onRootNoteChange={setRootNote}
            onScaleChange={setScale}
            size="xs"
            showFollowProject={true}
            followProject={followProject}
            onFollowProjectChange={setFollowProject}
          />
        </div>
      </div>
      <div className="flex flex-wrap justify-start sm:justify-end items-center gap-1 sm:gap-2 text-sm">
        <ProjectScaleControl />
        <BPMControl />
        <TimeSignatureControl />
        <span className="text-xs text-base-content/70 hidden md:inline">
          MIDI: {isEnabled ? `${inputs.length} device(s)` : 'disconnected'}
        </span>
      </div>
    </section>
  );
});
TransportToolbar.displayName = 'TransportToolbar';

export default TransportToolbar;

