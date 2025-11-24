import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useResizeDetector } from 'react-resize-detector';

import { useTrackStore } from '../../stores/trackStore';
import type { Track } from '../../types/daw';
import { useInputMonitoring } from '../../hooks/useInputMonitoring';
import { useOutputMeter } from '../../hooks/useOutputMeter';
import { trackInstrumentRegistry } from '../../utils/trackInstrumentRegistry';
import AnchoredPopup from '@/features/ui/components/shared/AnchoredPopup';
import InstrumentCategoryTabs from '@/features/instruments/components/InstrumentCategoryTabs';
import {
  getDefaultInstrumentForCategory,
  getInstrumentCategoryById,
  getInstrumentLabelById,
} from '@/features/instruments/utils/instrumentLookup';
import { InstrumentCategory } from '@/shared/constants/instruments';
import { useDAWCollaborationContext } from '../../contexts/useDAWCollaborationContext';
import { useLockStore } from '../../stores/lockStore';
import { useUserStore } from '@/shared/stores/userStore';
import { getTrackPanLockId, getTrackVolumeLockId } from '../../utils/collaborationLocks';

interface TrackHeaderProps {
  track: Track;
  isSelected: boolean;
  onSelect: (trackId: string) => void;
  onHeightChange?: (trackId: string, height: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export const TrackHeader = ({
  track,
  isSelected,
  onSelect,
  onHeightChange,
  canMoveUp,
  canMoveDown,
}: TrackHeaderProps) => {
  const [inputFeedback, setInputFeedback] = useState(false);
  const [isInstrumentPopupOpen, setIsInstrumentPopupOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [pendingName, setPendingName] = useState(track.name);

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

  const toggleMute = useTrackStore((state) => state.toggleMute);
  const toggleSolo = useTrackStore((state) => state.toggleSolo);
  const tracks = useTrackStore((state) => state.tracks);
  const currentUserId = useUserStore((state) => state.userId);
  
  // Use collaboration handlers if available
  const { 
    handleTrackDelete,
    handleTrackInstrumentChange,
    handleTrackNameChange,
    handleTrackVolumeChange,
    handleTrackPanChange,
    handleTrackVolumeDragEnd,
    handleTrackPanDragEnd,
    handleTrackReorder,
  } = useDAWCollaborationContext();

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const instrumentButtonRef = useRef<HTMLButtonElement | null>(null);
  const volumeLockId = useMemo(() => getTrackVolumeLockId(track.id), [track.id]);
  const panLockId = useMemo(() => getTrackPanLockId(track.id), [track.id]);
  const volumeLock = useLockStore((state) => state.isLocked(volumeLockId));
  const panLock = useLockStore((state) => state.isLocked(panLockId));
  const isVolumeLockedByRemote = Boolean(
    volumeLock && volumeLock.userId !== currentUserId,
  );
  const isPanLockedByRemote = Boolean(panLock && panLock.userId !== currentUserId);

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
      handleTrackInstrumentChange(track.id, defaultInstrument, resolvedCategory);
      return;
    }

    if (!track.instrumentCategory || track.instrumentCategory !== resolvedCategory) {
      handleTrackInstrumentChange(track.id, track.instrumentId, resolvedCategory);
    }
  }, [track, resolvedCategory, handleTrackInstrumentChange]);

  useEffect(() => {
    if (!isEditingName) {
      setPendingName(track.name);
    }
  }, [track.name, isEditingName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

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
    handleTrackInstrumentChange(track.id, nextInstrument, category);
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
    handleTrackInstrumentChange(track.id, instrumentId, category);
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

  // Output metering for all tracks (both MIDI and audio)
  const outputLevel = useOutputMeter(track.id, true);

  const startEditingName = () => {
    setPendingName(track.name);
    setIsEditingName(true);
  };

  const commitNameChange = () => {
    const trimmedName = pendingName.trim();
    const nextName = trimmedName.length > 0 ? trimmedName : track.name;
    if (nextName !== track.name) {
      handleTrackNameChange(track.id, nextName);
    }
    setIsEditingName(false);
  };

  const cancelNameEdit = () => {
    setPendingName(track.name);
    setIsEditingName(false);
  };

  const handleNameInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPendingName(event.target.value);
  };

  const handleNameInputBlur = () => {
    commitNameChange();
  };

  const handleNameInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitNameChange();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelNameEdit();
    }
  };

  const handleNameLabelKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startEditingName();
    }
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isVolumeLockedByRemote) {
      return;
    }
    handleTrackVolumeChange(track.id, Number(event.target.value) / 100);
  };

  const handleVolumeMouseUp = () => {
    handleTrackVolumeDragEnd();
  };

  const handlePanChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isPanLockedByRemote) {
      return;
    }
    handleTrackPanChange(track.id, Number(event.target.value) / 100);
  };

  const handlePanMouseUp = () => {
    handleTrackPanDragEnd();
  };

  return (
    <div
      ref={containerRef}
      onClick={() => onSelect(track.id)}
      className={`flex flex-col gap-2 border-t border-t-zinc-600 bg-base-100/80 px-3 py-2 transition-colors cursor-pointer ${isSelected ? 'bg-primary/10' : ''
        }`}
    >
      <div className="flex items-center gap-2 -mt-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: track.color }}
          aria-label={`Track color indicator`}
        />
        <div className="flex-1">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              value={pendingName}
              onChange={handleNameInputChange}
              onBlur={handleNameInputBlur}
              onKeyDown={handleNameInputKeyDown}
              className="input input-xs w-full bg-base-200/60"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={(e) => {
                e.stopPropagation();
                startEditingName();
              }}
              onKeyDown={handleNameLabelKeyDown}
              className="flex w-full cursor-text items-center rounded px-2 py-1 text-left text-sm font-medium text-base-content/90 hover:bg-base-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              title={track.name}
            >
              <span className="truncate">{track.name}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const currentIndex = tracks.findIndex((t) => t.id === track.id);
              if (currentIndex > 0) {
                handleTrackReorder(track.id, currentIndex - 1);
              }
            }}
            className="btn btn-xs btn-ghost btn-circle"
            title="Move Track Up"
            aria-label="Move Track Up"
            disabled={!canMoveUp}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const currentIndex = tracks.findIndex((t) => t.id === track.id);
              if (currentIndex < tracks.length - 1) {
                handleTrackReorder(track.id, currentIndex + 1);
              }
            }}
            className="btn btn-xs btn-ghost btn-circle"
            title="Move Track Down"
            aria-label="Move Track Down"
            disabled={!canMoveDown}
          >
            ↓
          </button>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleTrackDelete(track.id);
          }}
          className="btn btn-xs btn-ghost btn-circle text-error hover:bg-error/20"
          title="Delete Track"
        >
          ×
        </button>
      </div>

      {/* Output Meter */}
      <div className="relative h-[3px] -mt-1 mb-1 w-full rounded-full bg-base-300 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
          style={{ width: `${outputLevel * 100}%` }}
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <span className="uppercase text-[10px] text-base-content/60">Vol</span>
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(track.volume * 100)}
              onChange={handleVolumeChange}
              onMouseUp={handleVolumeMouseUp}
              onTouchEnd={handleVolumeMouseUp}
              disabled={isVolumeLockedByRemote}
              title={
                isVolumeLockedByRemote && volumeLock
                  ? `Locked by ${volumeLock.username}`
                  : undefined
              }
              className={`range range-xs max-w-[90px] ${
                isVolumeLockedByRemote ? 'cursor-not-allowed opacity-60' : ''
              }`}
            />
            {isVolumeLockedByRemote && volumeLock && (
              <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-base-100/95 px-1.5 py-0.5 text-[10px] font-medium text-base-content shadow-lg ring-1 ring-base-300">
                🔒 {volumeLock.username}
              </span>
            )}
          </div>
        </label>
        <label className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <span className="uppercase text-[10px] text-base-content/60">Pan</span>
          <div className="relative flex items-center">
            <input
              type="range"
              min={-100}
              max={100}
              value={Math.round(track.pan * 100)}
              onChange={handlePanChange}
              onMouseUp={handlePanMouseUp}
              onTouchEnd={handlePanMouseUp}
              disabled={isPanLockedByRemote}
              title={
                isPanLockedByRemote && panLock
                  ? `Locked by ${panLock.username}`
                  : undefined
              }
              className={`range range-xs max-w-[90px] [--range-bg:black] [--range-thumb:white] [--range-fill:0] ${
                isPanLockedByRemote ? 'cursor-not-allowed opacity-60' : ''
              }`}
            />
            {isPanLockedByRemote && panLock && (
              <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-base-100/95 px-1.5 py-0.5 text-[10px] font-medium text-base-content shadow-lg ring-1 ring-base-300">
                🔒 {panLock.username}
              </span>
            )}
          </div>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute(track.id);
            }}
            className={`btn btn-xs ${track.mute ? 'btn-warning' : 'btn-ghost'}`}
          >
            M
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSolo(track.id);
            }}
            className={`btn btn-xs ${track.solo ? 'btn-accent text-white' : 'btn-ghost'}`}
          >
            S
          </button>
          {track.type === 'audio' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setInputFeedback(!inputFeedback);
              }}
              className={`btn btn-xs ${inputFeedback ? 'btn-info text-white' : 'btn-ghost'}`}
              title="Input Monitoring Feedback (Hear yourself)"
            >
              I
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 justify-end">
          {track.type === 'audio' && (
            <>
              {isSelected ? (
                <div className="relative h-4 w-24 rounded-full bg-base-300 overflow-hidden">
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
              ) : (
                <span className="w-24 text-right text-xs text-base-content/60">Audio Track</span>
              )}
            </>
          )}
          {track.type === 'midi' && (
            <div className="relative">
              <button
                ref={instrumentButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleInstrumentButtonClick();
                }}
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
    </div>
  );
};

