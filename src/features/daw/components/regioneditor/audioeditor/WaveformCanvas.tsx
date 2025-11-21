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

interface WaveformCanvasProps {
  region: AudioRegion;
  zoomX: number;
  zoomY: number;
  pixelsPerBeat: number;
  onTrimStartChange: (trimStart: number) => void;
  onTrimEndChange: (trimEnd: number) => void;
  onFadeInChange: (duration: number, options?: { commit?: boolean }) => void;
  onFadeOutChange: (duration: number, options?: { commit?: boolean }) => void;
}

// Base canvas height (will be multiplied by zoomY)
const BASE_CANVAS_HEIGHT = 280;
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
  onTrimStartChange,
  onTrimEndChange,
  onFadeInChange,
  onFadeOutChange,
}: WaveformCanvasProps) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const layerRef = useRef<any>(null);
  const lastScrollX = useRef<number>(0);
  const scrollThrottleTimer = useRef<number | null>(null);
  const hasWarnedAboutCanvasSize = useRef<boolean>(false);
  
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
  const canvasHeight = BASE_CANVAS_HEIGHT; // Fixed height, don't scale with zoomY

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
      // Generate or retrieve LOD data with higher max width for editor
      const lodData = getOrGenerateLOD(region.audioBuffer, region.id, 20000);
      
      if (!lodData || !lodData.levels || lodData.levels.length === 0) {
        console.warn('Invalid LOD data for audio editor:', region.id);
        return new Float32Array(0);
      }
      
      // Select appropriate LOD level based on ACTUAL canvas width (not virtual width)
      // This prevents selecting too high detail when canvas is capped
      const effectiveWidth = Math.min(fullWidth, MAX_CANVAS_WIDTH);
      const lodLevel = selectLODLevel(lodData, effectiveWidth, originalLength);
      
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
  }, [region.audioBuffer, region.id, fullWidth, originalLength, MAX_CANVAS_WIDTH]);

  // Calculate positions (absolute positions in the full waveform)
  const trimStart = region.trimStart || 0;
  const trimEnd = trimStart + region.length;
  const trimStartX = trimStart * beatWidth;
  const trimEndX = trimEnd * beatWidth;
  
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
  
  // CRITICAL: Limit canvas width to prevent browser canvas size limits
  // MAX_CANVAS_WIDTH is defined earlier before useMemo
  const stageWidth = Math.min(fullWaveformWidth, MAX_CANVAS_WIDTH);
  
  // Warn if canvas would exceed limits (only once)
  const isCanvasTooLarge = fullWaveformWidth > MAX_CANVAS_WIDTH;
  
  // Calculate zoom limit to prevent canvas overflow
  const maxSafeZoom = MAX_CANVAS_WIDTH / (originalLength * pixelsPerBeat);
  
  if (isCanvasTooLarge && process.env.NODE_ENV === 'development' && !hasWarnedAboutCanvasSize.current) {
    console.warn(
      `Canvas width (${fullWaveformWidth}px) exceeds safe limit (${MAX_CANVAS_WIDTH}px). ` +
      `Current zoom: ${zoomX.toFixed(1)}×, Max safe zoom: ${maxSafeZoom.toFixed(1)}×. ` +
      `Capping canvas width to prevent white canvas error.`
    );
    hasWarnedAboutCanvasSize.current = true;
  }
  
  // Reset warning flag when zoom goes back below limit
  if (!isCanvasTooLarge && hasWarnedAboutCanvasSize.current) {
    hasWarnedAboutCanvasSize.current = false;
  }

  return (
    <Stage
      ref={stageRef}
      width={stageWidth}
      height={canvasHeight}
      onPointerMove={handlePointerMove}
      onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
      onPointerUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
    >
      <Layer ref={layerRef}>
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={stageWidth}
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
              
              // Use stageWidth (capped) instead of fullWaveformWidth for rendering
              const renderWidth = stageWidth;
              
              // Calculate optimal bar width to prevent overdraw
              const barWidth = calculateOptimalBarWidth(renderWidth, peakCount, 0.5, 3);
              
              // Viewport culling: Get the visible range from the stage
              const stage = shape.getStage();
              let viewportStartX = 0;
              let viewportEndX = renderWidth;
              let startPeakIndex = 0;
              let endPeakIndex = peakCount;
              
              if (stage) {
                const container = stage.container();
                if (container && container.parentElement) {
                  const scrollContainer = container.parentElement;
                  const containerWidth = scrollContainer.clientWidth;
                  viewportStartX = scrollContainer.scrollLeft;
                  viewportEndX = viewportStartX + containerWidth;
                  
                  // Adaptive buffer based on zoom level
                  const currentPixelsPerBeat = renderWidth / originalLength;
                  let buffer = containerWidth * 0.15; // Default 15%
                  
                  if (currentPixelsPerBeat > 300) {
                    buffer = containerWidth * 0.1; // High zoom: smaller buffer
                  } else if (currentPixelsPerBeat < 100) {
                    buffer = containerWidth * 0.2; // Low zoom: larger buffer
                  }
                  
                  viewportStartX = Math.max(0, viewportStartX - buffer);
                  viewportEndX = Math.min(renderWidth, viewportEndX + buffer);
                  
                  // Calculate visible peak range
                  startPeakIndex = Math.floor((viewportStartX / renderWidth) * peakCount);
                  endPeakIndex = Math.ceil((viewportEndX / renderWidth) * peakCount);
                  
                  // Only apply culling if it provides significant benefit
                  const visiblePeakCount = endPeakIndex - startPeakIndex;
                  if (!shouldApplyViewportCulling(peakCount, visiblePeakCount)) {
                    // Not worth culling, render everything
                    startPeakIndex = 0;
                    endPeakIndex = peakCount;
                  }
                }
              }
              
              // Batch rendering for better performance
              context.beginPath();
              
              // Only draw visible peaks
              for (let index = startPeakIndex; index < Math.min(endPeakIndex, peakCount); index++) {
                const minValue = visiblePeaks[index * 2] || 0;
                const maxValue = visiblePeaks[index * 2 + 1] || 0;
                
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
          points={[0, canvasHeight / 2, stageWidth, canvasHeight / 2]}
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
          width={Math.max(0, stageWidth - trimEndX)}
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
        
        {/* Canvas Size Limit Warning */}
        {isCanvasTooLarge && (
          <>
            <Rect
              x={stageWidth - 300}
              y={10}
              width={290}
              height={60}
              fill="#ff6b6b"
              opacity={0.9}
              cornerRadius={4}
            />
            <Text
              x={stageWidth - 290}
              y={20}
              text="⚠️ Maximum Zoom Reached"
              fontSize={14}
              fontStyle="bold"
              fill="#ffffff"
            />
            <Text
              x={stageWidth - 290}
              y={40}
              text={`Max safe zoom: ${maxSafeZoom.toFixed(1)}× (current: ${zoomX.toFixed(1)}×)`}
              fontSize={11}
              fill="#ffffff"
            />
          </>
        )}
      </Layer>
    </Stage>
  );
};

// Memoize WaveformCanvas to prevent unnecessary re-renders
export const WaveformCanvas = memo(WaveformCanvasComponent);

