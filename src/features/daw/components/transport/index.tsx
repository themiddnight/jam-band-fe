import { BPMControl } from './BPMControl';
import { Metronome } from './Metronome';
import { TimeSignatureControl } from './TimeSignatureControl';
import { TransportControls } from './TransportControls';
import { useToneTransportSync } from './useToneTransportSync';
import { useMidiStore } from '../../stores/midiStore';

export const TransportToolbar = () => {
  useToneTransportSync();
  const isEnabled = useMidiStore((state) => state.isEnabled);
  const inputs = useMidiStore((state) => state.inputs);

  return (
    <section className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 bg-base-200/60 px-2 sm:px-4 py-2 sm:py-3 backdrop-blur">
      <div className="flex items-center gap-2 sm:gap-3">
        <TransportControls />
        <Metronome />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base">
        <BPMControl />
        <TimeSignatureControl />
        <span className="text-xs sm:text-xs text-base-content/70 hidden sm:inline">
          MIDI: {isEnabled ? `${inputs.length} device(s)` : 'disconnected'}
        </span>
      </div>
    </section>
  );
};

export default TransportToolbar;

