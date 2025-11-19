import { memo } from 'react';
import { BPMControl } from './BPMControl';
import { Metronome } from './Metronome';
import { TimeSignatureControl } from './TimeSignatureControl';
import { TransportControls } from './TransportControls';
import { useToneTransportSync } from '../../hooks/useToneTransportSync';
import { useMidiStore } from '../../stores/midiStore';
import ScaleSelector from '@/features/ui/components/ScaleSelector';
import { useArrangeRoomScaleStore } from '../../stores/arrangeRoomStore';
import { SnapToggle } from './SnapToggle';

export const TransportToolbar = memo(() => {
  useToneTransportSync();
  const isEnabled = useMidiStore((state) => state.isEnabled);
  const inputs = useMidiStore((state) => state.inputs);
  const { rootNote, scale, setRootNote, setScale } = useArrangeRoomScaleStore();

  return (
    <section className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 bg-base-200/60 px-2 sm:px-4 py-2 sm:py-3 backdrop-blur">
      <div className="flex items-center gap-2 sm:gap-3">
        <TransportControls />
        <Metronome />
        <div className="flex items-center gap-2 rounded-lg border border-base-300 bg-base-100/80 px-2 py-1">
          <div className="flex items-center gap-2 leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/60">
              Scale
            </span>
          </div>
          <ScaleSelector
            rootNote={rootNote}
            scale={scale}
            onRootNoteChange={setRootNote}
            onScaleChange={setScale}
            size="xs"
          />
        </div>
        <SnapToggle />
      </div>
      <div className="flex flex-wrap justify-end items-center gap-2 text-sm">
        <BPMControl />
        <TimeSignatureControl />
        <span className="text-xs sm:text-xs text-base-content/70 hidden sm:inline">
          MIDI: {isEnabled ? `${inputs.length} device(s)` : 'disconnected'}
        </span>
      </div>
    </section>
  );
});
TransportToolbar.displayName = 'TransportToolbar';

export default TransportToolbar;

