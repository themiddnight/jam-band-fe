import { type ChangeEvent } from 'react';

import { useProjectStore } from '../../stores/projectStore';

const MIN_BPM = 40;
const MAX_BPM = 300;

export const BPMControl = () => {
  const bpm = useProjectStore((state) => state.bpm);
  const setBpm = useProjectStore((state) => state.setBpm);

  const handleBpmChange = (value: number) => {
    const clamped = Math.min(Math.max(value, MIN_BPM), MAX_BPM);
    setBpm(clamped);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleBpmChange(Number(event.target.value));
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs uppercase tracking-wide text-base-content/70">
        BPM
      </label>
      <input
        aria-label="Beats per minute"
        type="number"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={handleInputChange}
        className="input input-bordered input-xs w-16"
      />
      <input
        aria-hidden
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        step={1}
        value={bpm}
        onChange={handleInputChange}
        className="range range-xs max-w-32"
      />
    </div>
  );
};

