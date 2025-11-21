import type { ChangeEvent } from 'react';

import { useProjectStore } from '../../stores/projectStore';
import { useDAWCollaborationContext } from '../../contexts/useDAWCollaborationContext';

const NUMERATOR_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const DENOMINATOR_OPTIONS = [2, 4, 8, 16];

export const TimeSignatureControl = () => {
  const timeSignature = useProjectStore((state) => state.timeSignature);
  const { handleTimeSignatureChange } = useDAWCollaborationContext();

  const handleNumeratorChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleTimeSignatureChange({
      numerator: Number(event.target.value),
      denominator: timeSignature.denominator,
    });
  };

  const handleDenominatorChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleTimeSignatureChange({
      numerator: timeSignature.numerator,
      denominator: Number(event.target.value),
    });
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <label className="text-xs uppercase tracking-wide text-base-content/70 hidden sm:inline">
        Time
      </label>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <select
          aria-label="Time signature numerator"
          value={timeSignature.numerator}
          onChange={handleNumeratorChange}
          className="select select-bordered select-xs w-12 sm:w-14"
        >
          {NUMERATOR_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="text-xs sm:text-sm font-semibold text-base-content/70">/</span>
        <select
          aria-label="Time signature denominator"
          value={timeSignature.denominator}
          onChange={handleDenominatorChange}
          className="select select-bordered select-xs w-12 sm:w-14"
        >
          {DENOMINATOR_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

