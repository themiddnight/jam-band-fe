import { useState, useRef, useEffect } from 'react';
import { useTrackStore } from '../stores/trackStore';
import type { TrackType } from '../types/daw';
import { loadInstrumentForTrack } from '../utils/audioEngine';

export const AddTrackMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const addTrack = useTrackStore((state) => state.addTrack);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAddTrack = (type: TrackType) => {
    const track = addTrack({ type });
    setIsOpen(false);
    
    // For MIDI tracks, load the default instrument immediately
    if (type === 'midi' && track.instrumentId) {
      loadInstrumentForTrack(track).catch((error) => {
        console.error('Failed to load default instrument:', error);
      });
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-sm btn-primary w-full"
      >
        + Add Track
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg border border-base-300 bg-base-100 shadow-lg">
          <button
            type="button"
            onClick={() => handleAddTrack('midi')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-base-200 rounded-t-lg transition-colors flex items-center gap-2"
          >
            <span className="text-primary">🎹</span>
            <div>
              <div className="font-medium">MIDI Track</div>
              <div className="text-xs text-base-content/60">For virtual instruments</div>
            </div>
          </button>
          <div className="border-t border-base-300" />
          <button
            type="button"
            onClick={() => handleAddTrack('audio')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-base-200 rounded-b-lg transition-colors flex items-center gap-2"
          >
            <span className="text-secondary">🎤</span>
            <div>
              <div className="font-medium">Audio Track</div>
              <div className="text-xs text-base-content/60">For recording audio</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

