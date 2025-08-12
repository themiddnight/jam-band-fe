import { InstrumentCategory, DRUM_MACHINES } from "../shared/constants/instruments";
import { getGroupedInstrumentsForCategory } from "../utils/instrumentGrouping";
import GroupedDropdown from "./shared/GroupedDropdown";

export interface InstrumentCategorySelectorProps {
  currentCategory: InstrumentCategory;
  currentInstrument: string;
  onCategoryChange: (category: InstrumentCategory) => void;
  onInstrumentChange: (instrument: string) => void;
  isLoading?: boolean;
  dynamicDrumMachines?: Array<{
    value: string;
    label: string;
    controlType: any;
  }>;
}

export default function InstrumentCategorySelector({
  currentCategory,
  currentInstrument,
  onCategoryChange,
  onInstrumentChange,
  isLoading = false,
  dynamicDrumMachines = DRUM_MACHINES,
}: InstrumentCategorySelectorProps) {
  const categories = [
    { value: InstrumentCategory.Melodic, label: "Melodic" },
    { value: InstrumentCategory.DrumBeat, label: "Drum/Beat" },
    { value: InstrumentCategory.Synthesizer, label: "Synthesizer" },
  ];

  const groupedInstruments = getGroupedInstrumentsForCategory(
    currentCategory,
    dynamicDrumMachines,
  );

  return (
    <div className="card bg-base-100 shadow-lg grow">
      <div className="card-body p-3">
        <div className="flex justify-center gap-2 flex-wrap">
          {/* Category Selection */}
          <div className="flex items-center gap-2">
            <label className="label py-1 hidden lg:block">
              <span className="label-text text-xs">Category</span>
            </label>
            <select
              value={currentCategory}
              onChange={(e) =>
                onCategoryChange(e.target.value as InstrumentCategory)
              }
              disabled={isLoading}
              className="select select-bordered select-sm w-full max-w-xs"
            >
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* Instrument Selection */}
          <div className="flex items-center gap-2">
            <label className="label py-1 hidden lg:block">
              <span className="label-text text-xs">Inst</span>
            </label>
            <GroupedDropdown
              options={groupedInstruments}
              value={currentInstrument}
              onChange={onInstrumentChange}
              placeholder="Select instrument"
              disabled={isLoading}
              className="w-full min-w-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
