import { useState } from "react";
import { SOUNDFONT_INSTRUMENTS } from "../constants/instruments";

export interface InstrumentSelectorProps {
  currentInstrument: string;
  onInstrumentChange: (instrument: string) => void;
  isLoading?: boolean;
}

export default function InstrumentSelector({
  currentInstrument,
  onInstrumentChange,
  isLoading = false,
}: InstrumentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredInstruments = SOUNDFONT_INSTRUMENTS.filter(instrument =>
    instrument.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentInstrumentLabel = SOUNDFONT_INSTRUMENTS.find(
    instrument => instrument.value === currentInstrument
  )?.label || currentInstrument;

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSearchTerm(e.target.value);
  };

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  const handleSearchInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  return (
    <div className="relative flex justify-center items-center gap-3 bg-white p-3 rounded-lg shadow-lg grow">
      <div className="flex items-center gap-4">
        <h3 className="font-semibold text-gray-700">Instrument</h3>
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-between w-auto px-3 py-2 border rounded bg-white hover:bg-gray-50"
          >
            <span className="truncate">{currentInstrumentLabel}</span>
            <svg
              className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute z-50 w-64 mt-1 bg-white border rounded-lg shadow-lg max-h-96 overflow-hidden">
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="Search instruments..."
                  value={searchTerm}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleSearchInputKeyDown}
                  onClick={handleSearchInputClick}
                  className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="max-h-80 overflow-y-auto">
                {filteredInstruments.map((instrument) => (
                  <button
                    key={instrument.value}
                    onClick={() => {
                      onInstrumentChange(instrument.value);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
                      instrument.value === currentInstrument ? 'bg-blue-100 text-blue-700' : ''
                    }`}
                  >
                    {instrument.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-blue-600">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
          </div>
        )}
      </div>
    </div>
  );
} 