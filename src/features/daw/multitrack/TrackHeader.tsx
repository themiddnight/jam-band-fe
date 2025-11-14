import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useResizeDetector } from 'react-resize-detector';

import { useTrackStore } from '../stores/trackStore';
import type { Track } from '../types/daw';
import { useInputMonitoring } from '../hooks/useInputMonitoring';
import { trackInstrumentRegistry } from '../utils/trackInstrumentRegistry';
import AnchoredPopup from '@/features/ui/components/shared/AnchoredPopup';
import InstrumentCategoryTabs from '@/features/instruments/components/InstrumentCategoryTabs';
import {
  getDefaultInstrumentForCategory,
  getInstrumentCategoryById,
  getInstrumentLabelById,
} from '@/features/instruments/utils/instrumentLookup';
import { InstrumentCategory } from '@/shared/constants/instruments';

interface TrackHeaderProps {
  track: Track;
  isSelected: boolean;
  onSelect: (trackId: string) => void;
  onHeightChange?: (trackId: string, height: number) => void;
}

export const TrackHeader = ({ track, isSelected, onSelect, onHeightChange }: TrackHeaderProps) => {
  const [inputFeedback, setInputFeedback] = useState(false);
  const [isInstrumentPopupOpen, setIsInstrumentPopupOpen] = useState(false);
  
  const { ref: containerRef, height } = useResizeDetector({
    refreshMode: 'debounce',
    refreshRate: 16,
  });
  
  // Report height changes to parent
  useEffect(() => {
    if (height && onHeightChange) {
      onHeightChange(track.id, height + 17);
    }
  }, [height, onHeightChange, track.id]);
  
  const setTrackName = useTrackStore((state) => state.setTrackName);
  const setTrackVolume = useTrackStore((state) => state.setTrackVolume);
  const setTrackPan = useTrackStore((state) => state.setTrackPan);
  const toggleMute = useTrackStore((state) => state.toggleMute);
  const toggleSolo = useTrackStore((state) => state.toggleSolo);
  const setTrackInstrument = useTrackStore((state) => state.setTrackInstrument);
  const removeTrack = useTrackStore((state) => state.removeTrack);

  const instrumentButtonRef = useRef<HTMLButtonElement | null>(null);

  const resolvedCategory = useMemo(() => {
    if (track.instrumentCategory) {
      return track.instrumentCategory;
    }
    if (track.instrumentId) {
      return getInstrumentCategoryById(track.instrumentId);
    }
    return InstrumentCategory.Melodic;
  }, [track.instrumentCategory, track.instrumentId]);

  const selectorInstrumentValue = useMemo(
    () => track.instrumentId ?? getDefaultInstrumentForCategory(resolvedCategory),
    [track.instrumentId, resolvedCategory]
  );

  const currentInstrumentLabel = useMemo(() => {
    if (track.instrumentId) {
      return getInstrumentLabelById(track.instrumentId);
    }
    return getInstrumentLabelById(selectorInstrumentValue);
  }, [track.instrumentId, selectorInstrumentValue]);

  useEffect(() => {
    if (track.type !== 'midi') {
      return;
    }

    if (!track.instrumentId) {
      const defaultInstrument = getDefaultInstrumentForCategory(resolvedCategory);
      setTrackInstrument(track.id, defaultInstrument, resolvedCategory);
      return;
    }

    if (!track.instrumentCategory || track.instrumentCategory !== resolvedCategory) {
      setTrackInstrument(track.id, track.instrumentId, resolvedCategory);
    }
  }, [track, resolvedCategory, setTrackInstrument]);

  useEffect(() => {
    if (track.type !== 'midi') {
      return;
    }

    const instrumentId = track.instrumentId ?? getDefaultInstrumentForCategory(resolvedCategory);
    const instrumentCategory = track.instrumentCategory ?? resolvedCategory;
    const hydratedTrack: Track = {
      ...track,
      instrumentId,
      instrumentCategory,
    };

    void trackInstrumentRegistry
      .ensureEngine(hydratedTrack, {
        instrumentId,
        instrumentCategory,
      })
      .catch((error) => {
        console.error('Failed to prepare instrument engine for track:', error);
      });
  }, [track, resolvedCategory]);

  useEffect(() => {
    if (track.type !== 'midi' && isInstrumentPopupOpen) {
      setIsInstrumentPopupOpen(false);
    }
  }, [track.type, isInstrumentPopupOpen]);

  const handleInstrumentButtonClick = () => {
    if (track.type !== 'midi') {
      return;
    }
    setIsInstrumentPopupOpen((prev) => !prev);
  };

  const closeInstrumentPopup = () => {
    setIsInstrumentPopupOpen(false);
  };

  const handleCategorySelect = (category: InstrumentCategory) => {
    if (track.type !== 'midi') {
      return;
    }
    const nextInstrument = getDefaultInstrumentForCategory(category);
    setTrackInstrument(track.id, nextInstrument, category);
    const updatedTrack: Track = {
      ...track,
      instrumentId: nextInstrument,
      instrumentCategory: category,
    };
    void trackInstrumentRegistry
      .updateTrackConfig(updatedTrack, {
        instrumentId: nextInstrument,
        instrumentCategory: category,
      })
      .catch((error) => {
        console.error('Failed to update instrument engine for category change:', error);
      });
  };

  const handleInstrumentSelect = (instrumentId: string) => {
    if (track.type !== 'midi') {
      return;
    }
    const category = getInstrumentCategoryById(instrumentId);
    setTrackInstrument(track.id, instrumentId, category);
    const updatedTrack: Track = {
      ...track,
      instrumentId,
      instrumentCategory: category,
    };
    void trackInstrumentRegistry
      .updateTrackConfig(updatedTrack, {
        instrumentId,
        instrumentCategory: category,
      })
      .catch((error) => {
        console.error('Failed to update instrument engine for selection:', error);
      });
    closeInstrumentPopup();
  };
  
  // Input monitoring for audio tracks
  // Show meter when track is selected, enable feedback when 'I' is pressed
  const inputLevel = useInputMonitoring(
    track.type === 'audio' && isSelected ? track.id : null,
    track.type === 'audio' && isSelected, // Always show meter when selected
    inputFeedback // Only enable audio feedback when 'I' is active
  );

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTrackName(track.id, event.target.value);
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTrackVolume(track.id, Number(event.target.value) / 100);
  };

  const handlePanChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTrackPan(track.id, Number(event.target.value) / 100);
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-2 border-b border-base-200 bg-base-100/80 px-3 py-2 transition-colors ${
        isSelected ? 'bg-primary/10' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect(track.id)}
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: track.color }}
          aria-label={`Select ${track.name}`}
        />
        <input
          value={track.name}
          onChange={handleNameChange}
          className="input input-xs flex-1 bg-base-200/60"
        />
        <button
          type="button"
          onClick={() => removeTrack(track.id)}
          className="btn btn-xs btn-ghost btn-circle text-error hover:bg-error/20"
          title="Delete Track"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          <span className="uppercase text-[10px] text-base-content/60">Vol</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(track.volume * 100)}
            onChange={handleVolumeChange}
            className="range range-xs max-w-[90px]"
          />
        </label>
        <label className="flex items-center gap-1">
          <span className="uppercase text-[10px] text-base-content/60">Pan</span>
          <input
            type="range"
            min={-100}
            max={100}
            value={Math.round(track.pan * 100)}
            onChange={handlePanChange}
            className='range range-xs max-w-[90px] [--range-bg:black] [--range-thumb:white] [--range-fill:0]'
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => toggleMute(track.id)}
          className={`btn btn-xs ${track.mute ? 'btn-warning' : 'btn-ghost'}`}
        >
          M
        </button>
        <button
          type="button"
          onClick={() => toggleSolo(track.id)}
          className={`btn btn-xs ${track.solo ? 'btn-accent text-white' : 'btn-ghost'}`}
        >
          S
        </button>
        {track.type === 'audio' && (
          <>
            <button
              type="button"
              onClick={() => setInputFeedback(!inputFeedback)}
              className={`btn btn-xs ${inputFeedback ? 'btn-info text-white' : 'btn-ghost'}`}
              title="Input Monitoring Feedback (Hear yourself)"
            >
              I
            </button>
            {isSelected && (
              <div className="flex-1 h-4 bg-base-300 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-linear-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
                  style={{ width: `${inputLevel * 100}%` }}
                />
                {inputLevel === 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] text-base-content/40">
                    INPUT
                  </span>
                )}
              </div>
            )}
            {!isSelected && (
              <span className="text-xs text-base-content/60 flex-1">Audio Track</span>
            )}
          </>
        )}
        {track.type === 'midi' && (
          <div className="relative">
            <button
              ref={instrumentButtonRef}
              type="button"
              onClick={handleInstrumentButtonClick}
              className="btn btn-xs btn-outline"
            >
              {currentInstrumentLabel}
            </button>
            <AnchoredPopup
              open={isInstrumentPopupOpen}
              onClose={closeInstrumentPopup}
              anchorRef={instrumentButtonRef}
            >
              <InstrumentCategoryTabs
                currentCategory={resolvedCategory}
                currentInstrument={selectorInstrumentValue}
                onCategoryChange={handleCategorySelect}
                onInstrumentChange={handleInstrumentSelect}
              />
            </AnchoredPopup>
          </div>
        )}
      </div>
    </div>
  );
};

