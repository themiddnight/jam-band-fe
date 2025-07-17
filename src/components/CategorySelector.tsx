import { InstrumentCategory } from "../constants/instruments";

export interface CategorySelectorProps {
  currentCategory: InstrumentCategory;
  onCategoryChange: (category: InstrumentCategory) => void;
  isLoading?: boolean;
}

export default function CategorySelector({
  currentCategory,
  onCategoryChange,
  isLoading = false,
}: CategorySelectorProps) {
  const categories = [
    { value: InstrumentCategory.Melodic, label: "Melodic" },
    { value: InstrumentCategory.DrumBeat, label: "Drum/Beat" },
    { value: InstrumentCategory.Synthesizer, label: "Synthesizer" },
  ];

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg">
      <h3 className="font-semibold text-gray-700 mb-2">Instrument Category</h3>
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
  );
} 