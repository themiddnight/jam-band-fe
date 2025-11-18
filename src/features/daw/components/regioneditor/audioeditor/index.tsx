import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioRegion } from '@/features/daw/types/daw';
import { useRegionStore } from '@/features/daw/stores/regionStore';
import { useProjectStore } from '@/features/daw/stores/projectStore';
import { WaveformCanvas } from './WaveformCanvas';
import { TimeRuler } from './TimeRuler';
import { useDAWCollaborationContext } from '@/features/daw/contexts/DAWCollaborationContext';

interface AudioEditorProps {
  region: AudioRegion;
}

const PIXELS_PER_BEAT = 80;

export const AudioEditor = ({ region }: AudioEditorProps) => {
  const updateRegion = useRegionStore((state) => state.updateRegion);
  const playhead = useProjectStore((state) => state.playhead);
  const { handleRegionUpdate } = useDAWCollaborationContext();
  const [zoomX, setZoomX] = useState(1);
  const [zoomY, setZoomY] = useState(1);
  const rulerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const applyRegionUpdate = useCallback(
    (updates: Partial<AudioRegion>) => {
      updateRegion(region.id, updates);
      handleRegionUpdate(region.id, updates);
    },
    [handleRegionUpdate, region.id, updateRegion]
  );

  // Calculate default zoom to fit full waveform in container
  const defaultZoomX = Math.max(0.1, containerWidth / ((region.originalLength || region.length) * PIXELS_PER_BEAT));

  // Update container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (waveformRef.current) {
        setContainerWidth(waveformRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Reset zoom to fit when region changes
  useEffect(() => {
    setZoomX(defaultZoomX);
    setZoomY(1);
  }, [region.id, defaultZoomX]);

  const handleGainChange = (newGain: number) => {
    applyRegionUpdate({ gain: newGain });
  };

  const handleTrimStartChange = (newTrimStart: number) => {
    const currentTrimStart = region.trimStart || 0;
    const currentTrimEnd = currentTrimStart + region.length;

    // Clamp to valid range: 0 to (trimEnd - 0.25)
    const clampedTrimStart = Math.max(0, Math.min(newTrimStart, currentTrimEnd - 0.25));

    // When moving start, adjust length to keep end position fixed
    const newLength = currentTrimEnd - clampedTrimStart;

    applyRegionUpdate({
      trimStart: clampedTrimStart,
      length: newLength
    });
  };

  const handleTrimEndChange = (newTrimEnd: number) => {
    const currentTrimStart = region.trimStart || 0;
    const originalLength = region.originalLength || region.length;

    // Clamp to valid range: (trimStart + 0.25) to originalLength
    const clampedTrimEnd = Math.max(currentTrimStart + 0.25, Math.min(newTrimEnd, originalLength));

    // Calculate new length
    const newLength = clampedTrimEnd - currentTrimStart;

    applyRegionUpdate({ length: newLength });
  };

  const handleFadeInChange = (duration: number) => {
    const maxFade = Math.max(0, region.length - 0.25);
    const clampedDuration = Math.max(0, Math.min(duration, maxFade));
    applyRegionUpdate({ fadeInDuration: clampedDuration });
  };

  const handleFadeOutChange = (duration: number) => {
    const maxFade = Math.max(0, region.length - 0.25);
    const clampedDuration = Math.max(0, Math.min(duration, maxFade));
    applyRegionUpdate({ fadeOutDuration: clampedDuration });
  };

  // Sync scroll between ruler and waveform
  const handleWaveformScroll = useCallback(() => {
    if (waveformRef.current && rulerRef.current) {
      rulerRef.current.scrollLeft = waveformRef.current.scrollLeft;
    }
  }, []);

  const handleRulerScroll = useCallback(() => {
    if (rulerRef.current && waveformRef.current) {
      waveformRef.current.scrollLeft = rulerRef.current.scrollLeft;
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-base-100">
      {/* Header with controls */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-base-300">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold">{region.name}</h3>
          {/* Zoom X Control */}
          <label className="flex items-center gap-2">
            <span className="text-xs text-base-content/70">Zoom X</span>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={zoomX}
              onChange={(e) => setZoomX(Number(e.target.value))}
              className="range range-xs w-20"
            />
            <span className="text-xs font-mono w-10">{zoomX.toFixed(1)}x</span>
            <button
              type="button"
              onClick={() => setZoomX(defaultZoomX)}
              className="btn btn-xs"
              title="Reset to fit width"
            >
              ↻
            </button>
          </label>

          {/* Zoom Y Control */}
          <label className="flex items-center gap-2">
            <span className="text-xs text-base-content/70">Zoom Y</span>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={zoomY}
              onChange={(e) => setZoomY(Number(e.target.value))}
              className="range range-xs w-20"
            />
            <span className="text-xs font-mono w-10">{zoomY.toFixed(1)}x</span>
            <button
              type="button"
              onClick={() => setZoomY(1)}
              className="btn btn-xs"
              title="Reset Y zoom"
            >
              ↻
            </button>
          </label>
        </div>

        <div className="flex items-center gap-4">
          {/* Gain Control */}
          <label className="flex items-center gap-2">
            <span className="text-xs text-base-content/70">Gain</span>
            <input
              type="range"
              min={-24}
              max={24}
              step={0.1}
              value={region.gain || 0}
              onChange={(e) => handleGainChange(Number(e.target.value))}
              className="range range-xs w-32"
            />
            <span className="text-xs font-mono w-12 whitespace-nowrap">
              {(region.gain || 0) > 0 ? '+' : ''}
              {(region.gain || 0).toFixed(1)} dB
            </span>
          </label>

          {/* Fade In Control */}
          <label className="flex items-center gap-2">
            <span className="text-xs text-base-content/70">Fade In</span>
            <input
              type="range"
              min={0}
              max={Math.min(region.length / 2, 4)}
              step={0.01}
              value={region.fadeInDuration || 0}
              onChange={(e) => handleFadeInChange(Number(e.target.value))}
              className="range range-xs w-20"
            />
            <span className="text-xs font-mono w-10">{(region.fadeInDuration || 0).toFixed(2)}b</span>
          </label>

          {/* Fade Out Control */}
          <label className="flex items-center gap-2">
            <span className="text-xs text-base-content/70">Fade Out</span>
            <input
              type="range"
              min={0}
              max={Math.min(region.length / 2, 4)}
              step={0.01}
              value={region.fadeOutDuration || 0}
              onChange={(e) => handleFadeOutChange(Number(e.target.value))}
              className="range range-xs w-20"
            />
            <span className="text-xs font-mono w-10">{(region.fadeOutDuration || 0).toFixed(2)}b</span>
          </label>
        </div>
      </div>

      {/* Time Ruler */}
      <div
        ref={rulerRef}
        className="border-b border-base-300 overflow-x-auto overflow-y-hidden"
        onScroll={handleRulerScroll}
      >
        <TimeRuler
          totalBeats={region.originalLength || region.length}
          pixelsPerBeat={PIXELS_PER_BEAT}
          zoomX={zoomX}
          regionStart={region.start}
          trimStart={region.trimStart || 0}
          trimEnd={(region.trimStart || 0) + region.length}
          playheadBeats={playhead}
        />
      </div>

      {/* Waveform Canvas */}
      <div
        ref={waveformRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        onScroll={handleWaveformScroll}
      >
        <WaveformCanvas
          region={region}
          zoomX={zoomX}
          zoomY={zoomY}
          pixelsPerBeat={PIXELS_PER_BEAT}
          onTrimStartChange={handleTrimStartChange}
          onTrimEndChange={handleTrimEndChange}
          onFadeInChange={handleFadeInChange}
          onFadeOutChange={handleFadeOutChange}
        />
      </div>
    </div>
  );
};

