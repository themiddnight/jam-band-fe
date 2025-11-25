import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import type { AudioRegion } from '@/features/daw/types/daw';
import { useRegionStore } from '@/features/daw/stores/regionStore';
import { useProjectStore } from '@/features/daw/stores/projectStore';
import { WaveformCanvas } from './WaveformCanvas';
import { TimeRuler } from './TimeRuler';
import { useDAWCollaborationContext } from '@/features/daw/contexts/useDAWCollaborationContext';
import { MAX_CANVAS_WIDTH, MAX_AUDIO_ZOOM, MIN_AUDIO_ZOOM } from '@/features/daw/constants/canvas';
import { InfoTooltip } from '../../common/InfoTooltip';

interface AudioEditorProps {
  region: AudioRegion;
}

const PIXELS_PER_BEAT = 80;

export const AudioEditor = ({ region }: AudioEditorProps) => {
  const updateRegion = useRegionStore((state) => state.updateRegion);
  const playhead = useProjectStore((state) => state.playhead);
  const {
    handleRegionUpdate,
    handleRegionRealtimeUpdates,
    handleRegionRealtimeFlush,
  } = useDAWCollaborationContext();
  const [zoomX, setZoomX] = useState(1);
  const [zoomY, setZoomY] = useState(1);
  const rulerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(400);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);

  // Use react-resize-detector to track waveform container size
  const { ref: resizeRef } = useResizeDetector({
    onResize: (payload) => {
      if (payload?.width) setContainerWidth(payload.width);
      if (payload?.height) setContainerHeight(payload.height);
    },
    refreshMode: 'debounce',
    refreshRate: 100,
  });

  const applyRegionUpdate = useCallback(
    (updates: Partial<AudioRegion>) => {
      if (!updates || Object.keys(updates).length === 0) {
        return;
      }
      updateRegion(region.id, updates);
      handleRegionUpdate(region.id, updates);
    },
    [handleRegionUpdate, region.id, updateRegion]
  );

  const pushRealtimeRegionUpdate = useCallback(
    (updates: Partial<AudioRegion>) => {
      if (!updates || Object.keys(updates).length === 0) {
        return;
      }
      updateRegion(region.id, updates);
      handleRegionRealtimeUpdates([
        {
          regionId: region.id,
          updates,
        },
      ]);
    },
    [handleRegionRealtimeUpdates, region.id, updateRegion]
  );

  const commitRegionUpdate = useCallback(
    (updates: Partial<AudioRegion>) => {
      if (!updates || Object.keys(updates).length === 0) {
        return;
      }
      handleRegionRealtimeFlush();
      updateRegion(region.id, updates);
      handleRegionUpdate(region.id, updates);
    },
    [handleRegionRealtimeFlush, handleRegionUpdate, region.id, updateRegion]
  );

  const originalLength = region.originalLength || region.length;
  const baseWaveformWidth = originalLength * PIXELS_PER_BEAT;

  const maxZoomX = useMemo(() => {
    if (baseWaveformWidth <= 0) {
      return MAX_AUDIO_ZOOM;
    }
    const widthLimitedZoom = MAX_CANVAS_WIDTH / baseWaveformWidth;
    if (!Number.isFinite(widthLimitedZoom) || widthLimitedZoom <= 0) {
      return MAX_AUDIO_ZOOM;
    }
    return Math.min(MAX_AUDIO_ZOOM, widthLimitedZoom);
  }, [baseWaveformWidth]);

  const minZoomX = useMemo(() => {
    return Math.min(MIN_AUDIO_ZOOM, maxZoomX);
  }, [maxZoomX]);

  const clampZoomX = useCallback((value: number) => {
    const upperBound = maxZoomX > 0 ? maxZoomX : MIN_AUDIO_ZOOM;
    const lowerBound = Math.min(minZoomX, upperBound);
    const withinUpper = Math.min(upperBound, value);
    return Math.max(lowerBound, withinUpper);
  }, [maxZoomX, minZoomX]);

  // Calculate default zoom to fit full waveform in container
  const defaultZoomX = useMemo(() => {
    if (baseWaveformWidth <= 0) {
      return MIN_AUDIO_ZOOM;
    }
    const fitZoom = containerWidth / baseWaveformWidth;
    return clampZoomX(fitZoom || MIN_AUDIO_ZOOM);
  }, [baseWaveformWidth, containerWidth, clampZoomX]);

  // Handle zoom changes centered on cursor
  const handleZoomXChange = useCallback((newZoom: number, cursorX?: number) => {
    const clampedZoom = clampZoomX(newZoom);
    if (!waveformRef.current) {
      setZoomX(clampedZoom);
      return;
    }

    if (cursorX !== undefined) {
      // Calculate focus point in beats
      const focusPoint = (scrollLeft + cursorX) / (PIXELS_PER_BEAT * zoomX);
      
      // Calculate new scroll position to keep focus point at same position
      const newFocusPixels = focusPoint * PIXELS_PER_BEAT * clampedZoom;
      const newScrollLeft = newFocusPixels - cursorX;
      
      setZoomX(clampedZoom);
      
      requestAnimationFrame(() => {
        if (waveformRef.current) {
          waveformRef.current.scrollLeft = Math.max(0, newScrollLeft);
        }
      });
    } else {
      setZoomX(clampedZoom);
    }
  }, [zoomX, scrollLeft, clampZoomX]);

  const handleZoomYChange = useCallback((newZoom: number) => {
    setZoomY(newZoom);
  }, []);



  // Reset zoom to fit when region changes
  useEffect(() => {
    setZoomX(defaultZoomX);
    setZoomY(1);
  }, [region.id, defaultZoomX]);

  const handleGainChange = (newGain: number, commit = false) => {
    const clamped = Math.max(-24, Math.min(newGain, 24));
    const updates: Partial<AudioRegion> = { gain: clamped };
    if (commit) {
      commitRegionUpdate(updates);
    } else {
      pushRealtimeRegionUpdate(updates);
    }
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
      length: newLength,
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

  const handleFadeInChange = (duration: number, options?: { commit?: boolean }) => {
    const maxFade = Math.max(0, region.length - 0.25);
    const clampedDuration = Math.max(0, Math.min(duration, maxFade));
    if (options?.commit) {
      commitRegionUpdate({ fadeInDuration: clampedDuration });
    } else {
      pushRealtimeRegionUpdate({ fadeInDuration: clampedDuration });
    }
  };

  const handleFadeOutChange = (duration: number, options?: { commit?: boolean }) => {
    const maxFade = Math.max(0, region.length - 0.25);
    const clampedDuration = Math.max(0, Math.min(duration, maxFade));
    if (options?.commit) {
      commitRegionUpdate({ fadeOutDuration: clampedDuration });
    } else {
      pushRealtimeRegionUpdate({ fadeOutDuration: clampedDuration });
    }
  };

  // Sync scroll between ruler and waveform
  const handleWaveformScroll = useCallback(() => {
    if (waveformRef.current && rulerRef.current) {
      rulerRef.current.scrollLeft = waveformRef.current.scrollLeft;
      setScrollLeft(waveformRef.current.scrollLeft);
    }
  }, []);

  const handleRulerScroll = useCallback(() => {
    if (rulerRef.current && waveformRef.current) {
      waveformRef.current.scrollLeft = rulerRef.current.scrollLeft;
      setScrollLeft(rulerRef.current.scrollLeft);
    }
  }, []);

  // Handle Ctrl+drag panning
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          scrollLeft: waveformRef.current?.scrollLeft || 0,
        };
        // Change cursor to grabbing
        if (waveformRef.current) {
          waveformRef.current.style.cursor = 'grabbing';
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isPanning && panStartRef.current && waveformRef.current) {
        e.preventDefault();
        const deltaX = panStartRef.current.x - e.clientX;
        waveformRef.current.scrollLeft = panStartRef.current.scrollLeft + deltaX;
      }
    };

    const handlePointerUp = () => {
      if (isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
        // Reset cursor
        if (waveformRef.current) {
          waveformRef.current.style.cursor = '';
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && waveformRef.current && !isPanning) {
        waveformRef.current.style.cursor = 'grab';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey && waveformRef.current && !isPanning) {
        waveformRef.current.style.cursor = '';
      }
    };

    const waveform = waveformRef.current;
    if (waveform) {
      waveform.addEventListener('pointerdown', handlePointerDown);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      
      return () => {
        waveform.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [isPanning]);

  // Handle wheel zoom with Ctrl key
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        const delta = -e.deltaY;
        const zoomSpeed = 0.01;
        
        // Shift key for Y zoom, otherwise X zoom
        if (e.shiftKey) {
          const newZoomY = Math.max(1, Math.min(20, zoomY + delta * zoomSpeed));
          handleZoomYChange(newZoomY);
        } else {
          const newZoomX = clampZoomX(zoomX + delta * zoomSpeed);
          
          // Get cursor position relative to waveform
          const rect = waveformRef.current?.getBoundingClientRect();
          const cursorX = rect ? e.clientX - rect.left : undefined;
          
          handleZoomXChange(newZoomX, cursorX);
        }
      }
    };

    const waveform = waveformRef.current;
    if (waveform) {
      waveform.addEventListener('wheel', handleWheel, { passive: false });
      return () => waveform.removeEventListener('wheel', handleWheel);
    }
  }, [zoomX, zoomY, handleZoomXChange, handleZoomYChange, clampZoomX]);

  return (
    <div className="flex flex-col h-full bg-base-100">
      {/* Header with controls */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-base-300">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold">{region.name}</h3>
          <div className="flex items-center gap-2">
            <InfoTooltip>
              <ul className="space-y-1 list-disc ml-3">
                <li>Ctrl+Drag to pan</li>
                <li>Ctrl+Scroll to zoom X</li>
                <li>Ctrl+Shift+Scroll to zoom Y</li>
              </ul>
            </InfoTooltip>
            <button
              type="button"
              onClick={() => handleZoomXChange(defaultZoomX)}
              className="btn btn-xs"
              title="Reset to fit width"
            >
              Fit
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => {
                  const centerX = containerWidth / 2;
                  handleZoomXChange(zoomX * 0.8, centerX);
                }}
                title="Zoom Out"
              >
                −
              </button>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => {
                  const centerX = containerWidth / 2;
                  handleZoomXChange(zoomX * 1.25, centerX);
                }}
                title="Zoom In"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleZoomYChange(1)}
              className="btn btn-xs"
              title="Reset Y zoom"
            >
              Reset Y
            </button>
          </div>
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
              onPointerUp={(e) => handleGainChange(Number(e.currentTarget.value), true)}
              onPointerCancel={(e) => handleGainChange(Number(e.currentTarget.value), true)}
              onBlur={(e) => handleGainChange(Number(e.currentTarget.value), true)}
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
              onPointerUp={(e) => handleFadeInChange(Number(e.currentTarget.value), { commit: true })}
              onPointerCancel={(e) => handleFadeInChange(Number(e.currentTarget.value), { commit: true })}
              onBlur={(e) => handleFadeInChange(Number(e.currentTarget.value), { commit: true })}
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
              onPointerUp={(e) => handleFadeOutChange(Number(e.currentTarget.value), { commit: true })}
              onPointerCancel={(e) => handleFadeOutChange(Number(e.currentTarget.value), { commit: true })}
              onBlur={(e) => handleFadeOutChange(Number(e.currentTarget.value), { commit: true })}
              className="range range-xs w-20"
            />
            <span className="text-xs font-mono w-10">{(region.fadeOutDuration || 0).toFixed(2)}b</span>
          </label>
        </div>
      </div>

      {/* Time Ruler */}
      <div
        ref={rulerRef}
        className="border-b border-base-300 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
        ref={(node) => {
          // Combine refs for both scroll tracking and resize detection
          if (node) {
            waveformRef.current = node;
            resizeRef(node);
          }
        }}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        onScroll={handleWaveformScroll}
      >
        <WaveformCanvas
          region={region}
          zoomX={zoomX}
          zoomY={zoomY}
          pixelsPerBeat={PIXELS_PER_BEAT}
          containerHeight={containerHeight}
          playheadBeats={playhead}
          onTrimStartChange={handleTrimStartChange}
          onTrimEndChange={handleTrimEndChange}
          onFadeInChange={handleFadeInChange}
          onFadeOutChange={handleFadeOutChange}
        />
      </div>
    </div>
  );
};

