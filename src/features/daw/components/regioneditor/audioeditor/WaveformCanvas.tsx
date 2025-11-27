import { useCallback, useMemo, useState, useRef, memo } from 'react';
import { Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { AudioRegion } from '@/features/daw/types/daw';
import {
  getOrGenerateLOD,
  selectLODLevel,
  calculateOptimalBarWidth,
  shouldApplyViewportCulling,
} from '@/features/daw/utils/progressiveWaveformRenderer';
import { usePerformanceStore } from '@/features/daw/stores/performanceStore';

interface WaveformCanvasProps {
  region: AudioRegion;
  zoomX: number;
  zoomY: number;
  pixelsPerBeat: number;
  containerHeight: number;
  scrollLeft?: number;
  viewportWidth?: number;
  playheadBeats?: number;
  onTrimStartChange: (trimStart: number) => void;
  onTrimEndChange: (trimEnd: number) => void;
  onFadeInChange: (duration: number, options?: { commit?: boolean }) => void;
  onFadeOutChange: (duration: number, options?: { commit?: boolean }) => void;
}

const VERTICAL_PADDING = 40;
const HANDLE_WIDTH = 8;
const FADE_HANDLE_SIZE = 12;

interface DragState {
  type: 'trim-start' | 'trim-end' | 'fade-in' | 'fade-out';
  initialX: number;
  initialValue: number;
  initialTrimEnd?: number; // For trim-end drag, store the initial trim end position
}

const WaveformCanvasComponent = ({
  region,
  zoomX,
  zoomY,
  pixelsPerBeat,
  containerHeight,
  scrollLeft = 0,
  viewportWidth = 1200,
  playheadBeats = 0,
  onTrimStartChange,
  onTrimEndChange,
  onFadeInChange,
  onFadeOutChange,
}: WaveformCanvasProps) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const layerRef = useRef<any>(null);
  
  // Get performance settings
  const viewportCulling = usePerformanceStore((state) => state.settings.viewportCulling);
  const waveformQuality = usePerformanceStore((state) => state.settings.waveformQuality);
  const lastScrollX = useRef<number>(0);
  const scrollThrottleTimer = useRef<number | null>(null);
  
  const stageRef = useCallback((node: any) => {
    if (node) {
      const container = node.container();
      if (container && container.parentElement) {
        const scrollContainer = container.parentElement;
        
        // Throttled scroll handler for better performance
        const handleScroll = () => {
          const currentScrollX = scrollContainer.scrollLeft;
          
          // Only redraw if scroll changed significantly (>10px)
          if (Math.abs(currentScrollX - lastScrollX.current) > 10) {
            lastScrollX.current = currentScrollX;
            
            // Throttle redraws to max 30 FPS during scroll
            if (scrollThrottleTimer.current) {
              return;
            }
            
            scrollThrottleTimer.current = window.setTimeout(() => {
              if (layerRef.current) {
                layerRef.current.batchDraw();
              }
              scrollThrottleTimer.current = null;
            }, 33); // ~30 FPS
          }
        };
        
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => {
          scrollContainer.removeEventListener('scroll', handleScroll);
          if (scrollThrottleTimer.current) {
            clearTimeout(scrollThrottleTimer.current);
          }
        };
      }
    }
  }, []);

  const beatWidth = pixelsPerBeat * zoomX;
  const originalLength = region.originalLength || region.length;
  // Use dynamic container height, with a minimum fallback
  const canvasHeight = Math.max(containerHeight, 200);

  // Generate waveform data for the FULL recording using LOD
  const fullWidth = originalLength * beatWidth;
  
  // CRITICAL: Define canvas size limit BEFORE using it
  // Browsers have max canvas size (~32k pixels for Chrome, ~16k for Safari)
  const MAX_CANVAS_WIDTH = 16000; // Conservative limit for Safari compatibility
  
  // Use progressive LOD rendering for efficient waveform display
  const visiblePeaks = useMemo(() => {
    if (!region.audioBuffer) {
      return new Float32Array(0);
    }

    try {
      // Scale maxPeaks based on audio length for long files
      // This ensures enough detail when zoomed in on 5-10 minute audio
      // Base: 20000 peaks for short audio, up to 80000 for very long audio
      const audioLengthFactor = Math.max(1, originalLength / 100); // 100 beats = ~50 seconds at 120 BPM
      const scaledMaxPeaks = Math.min(Math.ceil(20000 * Math.sqrt(audioLengthFactor)), 80000);
      
      // Generate or retrieve LOD data with scaled peaks for long audio
      const lodData = getOrGenerateLOD(region.audioBuffer, region.id, scaledMaxPeaks, waveformQuality);
      
      if (!lodData || !lodData.levels || lodData.levels.length === 0) {
        console.warn('Invalid LOD data for audio editor:', region.id);
        return new Float32Array(0);
      }
      
      // Select LOD level based on actual zoom level (fullWidth), not capped canvas width
      // When zoomed in on long audio, we need high detail even though canvas is virtualized
      const lodLevel = selectLODLevel(lodData, fullWidth, originalLength);
      
      if (!lodLevel || !lodLevel.peaks || lodLevel.peaks.length === 0) {
        console.warn('Invalid LOD level for audio editor:', region.id);
        return new Float32Array(0);
      }
      
      // For the editor, we show the full waveform (no trim extraction here)
      return lodLevel.peaks;
    } catch (error) {
      console.error('Failed to generate waveform LOD for editor:', error, {
        regionId: region.id,
        fullWidth,
        originalLength,
      });
      return new Float32Array(0);
    }
  }, [region.audioBuffer, region.id, fullWidth, originalLength, waveformQuality]);

  // Calculate positions (absolute positions in the full waveform)
  const trimStart = region.trimStart || 0;
  const trimEnd = trimStart + region.length;
  const trimStartX = trimStart * beatWidth;
  const trimEndX = trimEnd * beatWidth;
  
  // Calculate playhead position relative to waveform start
  // The waveform starts at (region.start - trimStart) on the main timeline
  const absoluteStartBeat = region.start - trimStart;
  const playheadX = (playheadBeats - absoluteStartBeat) * beatWidth;
  
  // Calculate fade positions (relative to visible region)
  const fadeInDuration = region.fadeInDuration || 0;
  const fadeOutDuration = region.fadeOutDuration || 0;
  const fadeInEndX = trimStartX + fadeInDuration * beatWidth;
  const fadeOutStartX = trimEndX - fadeOutDuration * beatWidth;
  
  // Apply gain to waveform visualization
  const gainMultiplier = useMemo(() => {
    const gainDb = region.gain || 0;
    return Math.pow(10, gainDb / 20); // Convert dB to linear
  }, [region.gain]);

  const handleTrimStartDragStart = useCallback((event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true;
    const stage = event.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    setDragState({
      type: 'trim-start',
      initialX: pointer.x,
      initialValue: trimStart,
    });
  }, [trimStart]);

  const handleTrimEndDragStart = useCallback((event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true;
    const stage = event.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const currentTrimEnd = (region.trimStart || 0) + region.length;
    setDragState({
      type: 'trim-end',
      initialX: pointer.x,
      initialValue: currentTrimEnd,
      initialTrimEnd: currentTrimEnd,
    });
  }, [region.trimStart, region.length]);

  const handleFadeInDragStart = useCallback((event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true;
    const stage = event.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    setDragState({
      type: 'fade-in',
      initialX: pointer.x,
      initialValue: region.fadeInDuration || 0,
    });
  }, [region.fadeInDuration]);

  const handleFadeOutDragStart = useCallback((event: KonvaEventObject<PointerEvent>) => {
    event.cancelBubble = true;
    const stage = event.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    setDragState({
      type: 'fade-out',
      initialX: pointer.x,
      initialValue: region.fadeOutDuration || 0,
    });
  }, [region.fadeOutDuration]);

  const handlePointerMove = useCallback((event: KonvaEventObject<PointerEvent>) => {
    if (!dragState) return;

    const stage = event.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Delta calculation is the same in stage-relative coordinates
    const deltaX = pointer.x - dragState.initialX;
    const deltaBeats = deltaX / beatWidth;

    if (dragState.type === 'trim-start') {
      const newTrimStart = dragState.initialValue + deltaBeats;
      onTrimStartChange(newTrimStart);
    } else if (dragState.type === 'trim-end') {
      const newTrimEnd = dragState.initialValue + deltaBeats;
      onTrimEndChange(newTrimEnd);
    } else if (dragState.type === 'fade-in') {
      const newFadeIn = dragState.initialValue + deltaBeats;
      onFadeInChange(newFadeIn);
    } else if (dragState.type === 'fade-out') {
      const newFadeOut = dragState.initialValue - deltaBeats; // Subtract for fade out (drag left = longer fade)
      onFadeOutChange(newFadeOut);
    }
  }, [dragState, beatWidth, onTrimStartChange, onTrimEndChange, onFadeInChange, onFadeOutChange]);

  const handlePointerUp = useCallback(() => {
    if (dragState?.type === 'fade-in') {
      onFadeInChange(region.fadeInDuration || 0, { commit: true });
    } else if (dragState?.type === 'fade-out') {
      onFadeOutChange(region.fadeOutDuration || 0, { commit: true });
    }
    setDragState(null);
  }, [dragState, onFadeInChange, onFadeOutChange, region.fadeInDuration, region.fadeOutDuration]);

  // Width for rendering (full original length)
  const fullWaveformWidth = originalLength * beatWidth;
  
  // Virtualized Stage: only render viewport + buffer, not full width
  // This prevents massive canvas allocation at high zoom levels
  const stageBuffer = 200;
  const virtualizedStageWidth = Math.min(fullWaveformWidth, viewportWidth + stageBuffer * 2);
  const stageOffsetX = Math.max(0, Math.min(scrollLeft - stageBuffer, fullWaveformWidth - virtualizedStageWidth));
  
  // Final stage width (also respect browser limits)
  const stageWidth = Math.min(virtualizedStageWidth, MAX_CANVAS_WIDTH);

  return (
    <div style={{ position: 'relative', width: fullWaveformWidth, height: canvasHeight }}>
      {/* Virtualized Stage - positioned at stageOffsetX */}
      <div style={{ position: 'absolute', left: stageOffsetX, top: 0 }}>
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={canvasHeight}
          onPointerMove={handlePointerMove}
          onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
        >
          <Layer ref={layerRef} x={-stageOffsetX}>
            {/* Background */}
            <Rect
              x={0}
              y={0}
              width={fullWaveformWidth}
              height={canvasHeight}
              fill="#1f2937"
            />

        {/* Waveform - full recording - optimized rendering with smart viewport culling */}
        {visiblePeaks.length > 0 && (
          <Shape
            sceneFunc={(context, shape) => {
              context.fillStyle = '#34d399';
              context.globalAlpha = 0.8;
              
              const availableHeight = Math.max(canvasHeight - VERTICAL_PADDING * 2, 0);
              const centerY = canvasHeight / 2;
              const topLimit = VERTICAL_PADDING;
              const bottomLimit = canvasHeight - VERTICAL_PADDING;
              
              // Each peak is a min/max pair
              const peakCount = Math.floor(visiblePeaks.length / 2);
              
              // IMPORTANT: Use fullWaveformWidth for positioning - Layer offset handles virtualization
              const renderWidth = fullWaveformWidth;
              
              // Calculate optimal bar width to prevent overdraw
              const barWidth = calculateOptimalBarWidth(renderWidth, peakCount, 0.5, 3);
              
              // Viewport culling based on stageOffsetX and stageWidth (virtualized viewport)
              // Only render peaks that are visible in the virtualized stage
              const visibleStartX = stageOffsetX;
              const visibleEndX = stageOffsetX + stageWidth;
              const buffer = stageWidth * 0.15;
              
              const cullStartX = Math.max(0, visibleStartX - buffer);
              const cullEndX = Math.min(renderWidth, visibleEndX + buffer);
              
              // Calculate visible peak range
              let startPeakIndex = Math.floor((cullStartX / renderWidth) * peakCount);
              let endPeakIndex = Math.ceil((cullEndX / renderWidth) * peakCount);
              
              // Only apply culling if it provides significant benefit
              const visiblePeakCount = endPeakIndex - startPeakIndex;
              if (!shouldApplyViewportCulling(peakCount, visiblePeakCount, viewportCulling)) {
                // Not worth culling, render everything
                startPeakIndex = 0;
                endPeakIndex = peakCount;
              }
              
              // Batch rendering for better performance
              context.beginPath();
              
              // Only draw visible peaks
              for (let index = startPeakIndex; index < Math.min(endPeakIndex, peakCount); index++) {
                const minValue = visiblePeaks[index * 2] || 0;
                const maxValue = visiblePeaks[index * 2 + 1] || 0;
                
                // Position peaks at absolute X coordinates (Layer offset handles virtualization)
                const x = (index / peakCount) * renderWidth;
                
                // Use max value for height (representing peak amplitude)
                const amplitude = Math.max(Math.abs(minValue), Math.abs(maxValue));
                const baseHeight = Math.max(amplitude * gainMultiplier * availableHeight, 1);
                const waveHeight = baseHeight * zoomY;
                
                const rectTop = Math.max(topLimit, centerY - waveHeight / 2);
                const rectBottom = Math.min(bottomLimit, rectTop + waveHeight);
                const clampedHeight = Math.max(rectBottom - rectTop, 1);
                
                if (isFinite(x) && isFinite(rectTop) && isFinite(clampedHeight)) {
                  context.fillRect(x, rectTop, barWidth, clampedHeight);
                }
              }
              
              // Required for Konva
              context.fillStrokeShape(shape);
            }}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        )}

        {/* Center line */}
        <Line
          points={[0, canvasHeight / 2, fullWaveformWidth, canvasHeight / 2]}
          stroke="#4b5563"
          strokeWidth={1}
          dash={[4, 4]}
        />

        {/* Crop overlay - before trim start */}
        <Rect
          x={0}
          y={0}
          width={trimStartX}
          height={canvasHeight}
          fill="#000000"
          opacity={0.6}
        />

        {/* Crop overlay - after trim end */}
        <Rect
          x={trimEndX}
          y={0}
          width={Math.max(0, fullWaveformWidth - trimEndX)}
          height={canvasHeight}
          fill="#000000"
          opacity={0.6}
        />

        {/* Trim start handle */}
        <Rect
          x={trimStartX - HANDLE_WIDTH / 2}
          y={0}
          width={HANDLE_WIDTH}
          height={canvasHeight}
          fill="#3b82f6"
          opacity={0.8}
          onPointerDown={handleTrimStartDragStart}
          onTouchStart={(e) => handleTrimStartDragStart(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'ew-resize';
          }}
          onPointerLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        />
        <Text
          x={trimStartX + 8}
          y={20}
          text="Start"
          fontSize={12}
          fill="#3b82f6"
          listening={false}
        />

        {/* Trim end handle */}
        <Rect
          x={trimEndX - HANDLE_WIDTH / 2}
          y={0}
          width={HANDLE_WIDTH}
          height={canvasHeight}
          fill="#ef4444"
          opacity={0.8}
          onPointerDown={handleTrimEndDragStart}
          onTouchStart={(e) => handleTrimEndDragStart(e as unknown as KonvaEventObject<PointerEvent>)}
          onPointerEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'ew-resize';
          }}
          onPointerLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        />
        <Text
          x={trimEndX - 30}
          y={20}
          text="End"
          fontSize={12}
          fill="#ef4444"
          listening={false}
        />

        {/* Active region highlight */}
        <Rect
          x={trimStartX}
          y={0}
          width={trimEndX - trimStartX}
          height={canvasHeight}
          stroke="#10b981"
          strokeWidth={2}
          listening={false}
        />

        {/* Fade In Curve Overlay - Linear (flipped) */}
        {fadeInDuration > 0 && (() => {
          const fadeWidth = fadeInDuration * beatWidth;
          
          // Linear fade overlay: inverted triangle (wide at top, narrow at bottom)
          const points = [
            trimStartX, 0,                      // Top left (full darkness/silence)
            trimStartX, canvasHeight,           // Bottom left (full darkness/silence)
            trimStartX + fadeWidth, 0,          // Top right (no darkness/full volume)
            trimStartX, 0,                      // Close
          ];
          
          return (
            <Line
              points={points}
              fill="#fbbf24"
              opacity={0.3}
              closed={true}
              listening={false}
            />
          );
        })()}

        {/* Fade Out Curve Overlay - Linear (flipped) */}
        {fadeOutDuration > 0 && (() => {
          // Linear fade overlay: inverted triangle (narrow at top, wide at bottom)
          const points = [
            fadeOutStartX, 0,                   // Top left (no darkness/full volume)
            trimEndX, 0,                        // Top right (full darkness/silence)
            trimEndX, canvasHeight,             // Bottom right (full darkness/silence)
            fadeOutStartX, 0,                   // Close
          ];
          
          return (
            <Line
              points={points}
              fill="#f97316"
              opacity={0.3}
              closed={true}
              listening={false}
            />
          );
        })()}

        {/* Fade In Handle */}
        {fadeInDuration > 0 && (
          <Rect
            x={fadeInEndX - FADE_HANDLE_SIZE / 2}
            y={canvasHeight / 2 - FADE_HANDLE_SIZE / 2}
            width={FADE_HANDLE_SIZE}
            height={FADE_HANDLE_SIZE}
            fill="#fbbf24"
            cornerRadius={FADE_HANDLE_SIZE / 2}
            stroke="#f59e0b"
            strokeWidth={2}
            onPointerDown={handleFadeInDragStart}
            onTouchStart={(e) => handleFadeInDragStart(e as unknown as KonvaEventObject<PointerEvent>)}
            onPointerEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'ew-resize';
            }}
            onPointerLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'default';
            }}
          />
        )}

        {/* Fade Out Handle */}
        {fadeOutDuration > 0 && (
          <Rect
            x={fadeOutStartX - FADE_HANDLE_SIZE / 2}
            y={canvasHeight / 2 - FADE_HANDLE_SIZE / 2}
            width={FADE_HANDLE_SIZE}
            height={FADE_HANDLE_SIZE}
            fill="#f97316"
            cornerRadius={FADE_HANDLE_SIZE / 2}
            stroke="#ea580c"
            strokeWidth={2}
            onPointerDown={handleFadeOutDragStart}
            onTouchStart={(e) => handleFadeOutDragStart(e as unknown as KonvaEventObject<PointerEvent>)}
            onPointerEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'ew-resize';
            }}
            onPointerLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'default';
            }}
          />
        )}
        
        {/* Playhead indicator */}
        {playheadX >= 0 && playheadX <= fullWaveformWidth && (
          <Line
            points={[playheadX, 0, playheadX, canvasHeight]}
            stroke="#3b82f6"
            strokeWidth={2}
            listening={false}
          />
        )}
        
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

// Memoize WaveformCanvas to prevent unnecessary re-renders
export const WaveformCanvas = memo(WaveformCanvasComponent);

