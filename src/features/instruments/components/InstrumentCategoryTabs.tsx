import { useEffect, useMemo, useState } from 'react';

import type { GroupedOption } from '@/features/ui';
import {
  DRUM_MACHINES,
  InstrumentCategory,
} from '@/shared/constants/instruments';

import {
  groupDrumMachines,
  groupSoundfontInstruments,
  groupSynthesizerInstruments,
} from '../utils/instrumentGrouping';

export interface InstrumentCategoryTabsProps {
  currentCategory: InstrumentCategory;
  currentInstrument: string;
  onCategoryChange: (category: InstrumentCategory) => void;
  onInstrumentChange: (instrument: string) => void;
  isLoading?: boolean;
  dynamicDrumMachines?: typeof DRUM_MACHINES;
}

const CATEGORY_TABS: Array<{ value: InstrumentCategory; label: string }> = [
  { value: InstrumentCategory.Melodic, label: 'Melodic' },
  { value: InstrumentCategory.DrumBeat, label: 'Drum/Beat' },
  { value: InstrumentCategory.Synthesizer, label: 'Synth' },
];

const groupByHeading = (options: GroupedOption[]) => {
  return options.reduce<Record<string, GroupedOption[]>>((acc, option) => {
    const key = option.group ?? 'Other';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(option);
    return acc;
  }, {});
};

export default function InstrumentCategoryTabs({
  currentCategory,
  currentInstrument,
  onCategoryChange,
  onInstrumentChange,
  isLoading = false,
  dynamicDrumMachines = DRUM_MACHINES,
}: InstrumentCategoryTabsProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const groupedOptionsByCategory = useMemo(() => {
    return {
      [InstrumentCategory.Melodic]: groupSoundfontInstruments(),
      [InstrumentCategory.DrumBeat]: groupDrumMachines(dynamicDrumMachines),
      [InstrumentCategory.Synthesizer]: groupSynthesizerInstruments(),
    } satisfies Record<InstrumentCategory, GroupedOption[]>;
  }, [dynamicDrumMachines]);

  const optionsForCategory = useMemo(
    () => groupedOptionsByCategory[currentCategory] ?? [],
    [groupedOptionsByCategory, currentCategory],
  );

  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return optionsForCategory;
    }

    return optionsForCategory.filter((option) =>
      option.label.toLowerCase().includes(term),
    );
  }, [optionsForCategory, searchTerm]);

  const groupedDisplay = useMemo(() => groupByHeading(filteredOptions), [filteredOptions]);

  useEffect(() => {
    setSearchTerm('');
  }, [currentCategory]);

  const handleCategoryClick = (category: InstrumentCategory) => {
    if (category === currentCategory || isLoading) {
      return;
    }
    onCategoryChange(category);
  };

  const handleInstrumentSelect = (instrumentId: string) => {
    if (isLoading) {
      return;
    }
    onInstrumentChange(instrumentId);
  };

  return (
    <div className="w-72 max-w-full p-2">
      <div role="tablist" className="tabs tabs-boxed w-full">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            className={`tab flex-1 text-xs sm:text-sm ${
              currentCategory === tab.value ? 'tab-active' : ''
            }`}
            onClick={() => handleCategoryClick(tab.value)}
            disabled={isLoading}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        <input
          type="text"
          placeholder="Search instruments..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          disabled={isLoading}
          className="input input-sm w-full"
        />

        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {Object.keys(groupedDisplay).length === 0 ? (
            <div className="rounded bg-base-200 p-3 text-center text-sm text-base-content/60">
              No instruments found
            </div>
          ) : (
            Object.entries(groupedDisplay).map(([heading, options]) => (
              <div key={heading}>
                <div className="sticky top-0 bg-base-200 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  {heading}
                </div>
                <div className="flex flex-col">
                  {options.map((option) => {
                    const isSelected = option.value === currentInstrument;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleInstrumentSelect(option.value)}
                        disabled={isLoading}
                        className={`btn btn-ghost btn-sm justify-start gap-2 px-3 normal-case ${
                          isSelected ? 'bg-primary/20 text-primary-content' : ''
                        }`}
                      >
                        {option.icon && <span className="text-base">{option.icon}</span>}
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
