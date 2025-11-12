import { useEffect, useMemo, useRef, useState } from 'react';
import { INSTRUMENT_OPTIONS } from './instruments';

interface InstrumentSelectorProps {
  value: string;
  onChange: (instrumentId: string) => void;
}

export const InstrumentSelector = ({ value, onChange }: InstrumentSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find current instrument
  const currentInstrument = useMemo(
    () => INSTRUMENT_OPTIONS.find((inst) => inst.id === value),
    [value]
  );

  // Filter and group instruments based on search
  const filteredInstruments = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return INSTRUMENT_OPTIONS;
    }
    return INSTRUMENT_OPTIONS.filter(
      (inst) =>
        inst.label.toLowerCase().includes(query) ||
        inst.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group instruments by category
  const groupedInstruments = useMemo(() => {
    const groups: Record<string, typeof INSTRUMENT_OPTIONS> = {};
    filteredInstruments.forEach((inst) => {
      if (!groups[inst.category]) {
        groups[inst.category] = [];
      }
      groups[inst.category].push(inst);
    });
    return groups;
  }, [filteredInstruments]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when dropdown opens
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (instrumentId: string) => {
    onChange(instrumentId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className="relative flex-1">
      {/* Selected instrument display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-xs w-full justify-between normal-case text-left"
      >
        <span className="truncate">{currentInstrument?.label || 'Select Instrument'}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-w-xs rounded-lg border border-base-300 bg-base-100 shadow-xl">
          {/* Search input */}
          <div className="sticky top-0 border-b border-base-300 bg-base-100 p-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search instruments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-xs w-full"
            />
          </div>

          {/* Instrument list */}
          <div className="max-h-64 overflow-y-auto">
            {Object.keys(groupedInstruments).length === 0 ? (
              <div className="p-4 text-center text-sm text-base-content/60">
                No instruments found
              </div>
            ) : (
              Object.entries(groupedInstruments).map(([category, instruments]) => (
                <div key={category}>
                  {/* Category header */}
                  <div className="sticky top-0 bg-base-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/70">
                    {category}
                  </div>
                  {/* Instruments in category */}
                  {instruments.map((instrument) => (
                    <button
                      key={instrument.id}
                      type="button"
                      onClick={() => handleSelect(instrument.id)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-base-200 ${
                        instrument.id === value ? 'bg-primary/20 font-medium' : ''
                      }`}
                    >
                      {instrument.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

