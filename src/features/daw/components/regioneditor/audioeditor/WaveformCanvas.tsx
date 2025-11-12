import { useCallback, useMemo, useState } from 'react';
import { Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { AudioRegion } from '../../../types/daw';
import { generateWaveformData, normalizeWaveform } from '../../../utils/waveformUtils';

interface WaveformCanvasProps {
  region: AudioRegion;
  zoomX: number;
  zoomY: number;
  pixelsPerBeat: number;
  onTrimStartChange: (trimStart: number) => void;
  onTrimEndChange: (trimEnd: number) => void;
  onFadeInChange: (duration: number) => void;
  onFadeOutChange: (duration: number) => void;
}

// Base canvas height (will be multiplied by zoomY)
const BASE_CANVAS_HEIGHT = 280;
const HANDLE_WIDTH = 8;
const FADE_HANDLE_SIZE = 12;

interface DragState {
  type: 'trim-start' | 'trim-end' | 'fade-in' | 'fade-out';
  initialX: number;
  initialValue: number;
  initialTrimEnd?: number; // For trim-end drag, store the initial trim end position
}

export const WaveformCanvas = ({
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

  const beatWidth = pixelsPerBeat * zoomX;
  const originalLength = region.originalLength || region.length;
  const canvasHeight = BASE_CANVAS_HEIGHT; // Fixed height, don't scale with zoomY

  // Generate waveform data for the FULL recording
  const waveformData = useMemo(() => {
    if (!region.audioBuffer) return [];
    
    const fullWidth = originalLength * beatWidth;
    const samples = Math.max(200, Math.floor(fullWidth / 2));
    const data = generateWaveformData(region.audioBuffer, samples);
    return normalizeWaveform(data);
  }, [region.audioBuffer, originalLength, beatWidth]);

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
    setDragState(null);
  }, []);

  // Width for rendering (full original length)
  const fullWaveformWidth = originalLength * beatWidth;

  return (
    <Stage
      width={fullWaveformWidth}
      height={canvasHeight}
      onPointerMove={handlePointerMove}
      onTouchMove={(e) => handlePointerMove(e as unknown as KonvaEventObject<PointerEvent>)}
      onPointerUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
    >
      <Layer>
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={fullWaveformWidth}
          height={canvasHeight}
          fill="#1f2937"
        />

        {/* Waveform - full recording */}
        {waveformData.map((amplitude, index) => {
          const x = (index / waveformData.length) * fullWaveformWidth;
          // Apply zoomY to scale from center (with padding for margins)
          const baseWaveHeight = amplitude * gainMultiplier * (canvasHeight / 2 - 40);
          const waveHeight = baseWaveHeight * zoomY;
          const centerY = canvasHeight / 2;
          
          return (
            <Rect
              key={`wave-${index}`}
              x={x}
              y={centerY - waveHeight / 2}
              width={Math.max(fullWaveformWidth / waveformData.length, 1)}
              height={Math.max(waveHeight, 1)}
              fill="#34d399"
              opacity={0.8}
              listening={false}
            />
          );
        })}

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
          width={fullWaveformWidth - trimEndX}
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
      </Layer>
    </Stage>
  );
};

