import React, { useState, useRef, useEffect, useMemo } from "react";

export interface GroupedOption {
  value: string;
  label: string;
  group: string;
  icon?: string;
  [key: string]: any;
}

export interface GroupedDropdownProps {
  options: GroupedOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function GroupedDropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
}: GroupedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedOptionRef = useRef<HTMLLIElement>(null);

  // Group options by their group property
  const groupedOptions = useMemo(() => {
    const groups: Record<string, GroupedOption[]> = {};
    options.forEach((option) => {
      if (!groups[option.group]) {
        groups[option.group] = [];
      }
      groups[option.group].push(option);
    });
    return groups;
  }, [options]);

  // Filter options based on search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedOptions;

    const filtered: Record<string, GroupedOption[]> = {};
    Object.entries(groupedOptions).forEach(([groupName, groupOptions]) => {
      const filteredOptions = groupOptions.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      if (filteredOptions.length > 0) {
        filtered[groupName] = filteredOptions;
      }
    });
    return filtered;
  }, [groupedOptions, searchTerm]);

  // Get the currently selected option
  const selectedOption = useMemo(() => {
    return options.find((option) => option.value === value);
  }, [options, value]);

  // Auto-scroll to selected item when dropdown opens
  useEffect(() => {
    if (isOpen && selectedOptionRef.current) {
      selectedOptionRef.current.scrollIntoView({
        behavior: "instant",
        block: "center",
      });
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOptionSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Only prevent event propagation when dropdown is open
    if (isOpen) {
      event.stopPropagation();
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setSearchTerm("");
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="select select-bordered select-sm w-full text-left flex items-center gap-2"
        onKeyDown={handleKeyDown}
      >
        {selectedOption ? (
          <>
            {selectedOption.icon && <span>{selectedOption.icon}</span>}
            <span>{selectedOption.label}</span>
          </>
        ) : (
          placeholder
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded shadow-lg max-h-96 overflow-hidden"
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="p-3 border-b border-base-300">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search instruments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered input-xs w-full"
              onKeyDown={handleKeyDown}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              data-dropdown-search="true"
            />
          </div>

          {/* Options List */}
          <div className="max-h-80 overflow-y-auto">
            {Object.entries(filteredGroups).map(([groupName, groupOptions]) => (
              <div key={groupName}>
                {/* Group Header */}
                <div className="px-3 py-2 bg-base-200 text-xs font-bold text-base-content/70 sticky top-0">
                  {groupName}
                </div>

                {/* Group Options */}
                {groupOptions.map((option) => (
                  <li
                    key={option.value}
                    ref={option.value === value ? selectedOptionRef : null}
                    onClick={() => handleOptionSelect(option.value)}
                    className={`px-5 py-2 text-xs cursor-pointer list-none hover:bg-base-200 transition-colors flex items-center gap-2 ${
                      option.value === value
                        ? "bg-primary text-primary-content"
                        : ""
                    }`}
                  >
                    {option.icon && <span>{option.icon}</span>}
                    <span>{option.label}</span>
                  </li>
                ))}
              </div>
            ))}

            {/* No results message */}
            {Object.keys(filteredGroups).length === 0 && (
              <div className="px-3 py-4 text-center text-base-content/50">
                No instruments found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
