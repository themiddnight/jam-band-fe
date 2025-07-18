import { InstrumentCategory, SOUNDFONT_INSTRUMENTS, DRUM_MACHINES, SYNTHESIZER_INSTRUMENTS } from "../constants/instruments";

export interface InstrumentCategorySelectorProps {
  currentCategory: InstrumentCategory;
  currentInstrument: string;
  onCategoryChange: (category: InstrumentCategory) => void;
  onInstrumentChange: (instrument: string) => void;
  isLoading?: boolean;
  dynamicDrumMachines?: Array<{ value: string; label: string; controlType: any }>;
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

  const getInstrumentsForCategory = () => {
    switch (currentCategory) {
      case InstrumentCategory.Melodic:
        return SOUNDFONT_INSTRUMENTS;
      case InstrumentCategory.DrumBeat:
        return dynamicDrumMachines;
      case InstrumentCategory.Synthesizer:
        return SYNTHESIZER_INSTRUMENTS;
      default:
        return SOUNDFONT_INSTRUMENTS;
    }
  };

  const instruments = getInstrumentsForCategory();

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg">
      <div className="flex gap-4">
        {/* Category Selection */}
        <div className="flex items-center gap-2">
          <label>
            Category
          </label>
          <select
            value={currentCategory}
            onChange={(e) => onCategoryChange(e.target.value as InstrumentCategory)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
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
          <label>
            Instrument
          </label>
          <select
            value={currentInstrument}
            onChange={(e) => onInstrumentChange(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          >
            {instruments.map((instrument) => (
              <option key={instrument.value} value={instrument.value}>
                {instrument.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
} 