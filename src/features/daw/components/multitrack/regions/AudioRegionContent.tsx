import { useMemo } from 'react';
import { Shape, Line, Rect } from 'react-konva';
import type { RegionContentProps } from './types';
import type { AudioRegion } from '@/features/daw/types/daw';
import {
  getOrGenerateLOD,
  selectLODLevel,
  extractVisiblePeaks,
  calculateOptimalBarWidth,
  shouldApplyViewportCulling,
} from '@/features/daw/utils/progressiveWaveformRenderer';
import { usePerformanceStore } from '@/features/daw/stores/performanceStore';

const TRACK_WAVEFORM_PADDING = 6;

interface AudioRegionContentProps extends RegionContentProps {
  region: AudioRegion;
}

export const AudioRegionContent = ({
  region,
  loopX,
  y,
  width,
  height,
  beatWidth,
  isMainLoop,
  length,
  headResizeState,
  viewportStartBeat,
  viewportEndBeat,
}: AudioRegionContentProps) => {
  const audioBuffer = region.audioBuffer;
  const originalLength = region.originalLength ?? length;
  
  // Get performance settings
  const viewportCulling = usePerformanceStore((state) => state.settings.viewportCulling);
  const waveformQuality = usePerformanceStore((state) => state.settings.waveformQuality);

  // Use preview trim values during head resize
  const isHeadResizing = headResizeState?.regionIds.includes(region.id);
  let effectiveTrimStart = region.trimStart ?? 0;

  if (isHeadResizing) {
    // Calculate preview trim during head resize
    const initialStart = headResizeState?.initialStarts[region.id] ?? region.start;
    const previewStart = headResizeState?.previewStarts[region.id] ?? region.start;
    const delta = previewStart - initialStart;
    effectiveTrimStart = (region.trimStart ?? 0) + delta;
  }

  // Use progressive LOD rendering for large audio files
  const visiblePeaks = useMemo(() => {
    if (!audioBuffer) {
      return new Float32Array(0);
    }

    try {
      // Scale maxPeaks based on audio length for long files
      // This ensures enough detail when zoomed in on 5-10 minute audio
      const audioLengthFactor = Math.max(1, originalLength / 100);
      const scaledMaxPeaks = Math.min(Math.ceil(20000 * Math.sqrt(audioLengthFactor)), 80000);
      
      // Generate or retrieve LOD data with scaled peaks for long audio
      const lodData = getOrGenerateLOD(audioBuffer, region.id, scaledMaxPeaks, waveformQuality);

      // Validate LOD data
      if (!lodData || !lodData.levels || lodData.levels.length === 0) {
        console.warn('Invalid LOD data for region:', region.id);
        return new Float32Array(0);
      }

      // Select appropriate LOD level based on actual zoom (width * zoom factor)
      // Use a larger effective width to get more detail when zoomed in
      const effectiveWidth = width * Math.max(1, beatWidth / 20);
      const lodLevel = selectLODLevel(lodData, effectiveWidth, length);

      // Validate LOD level
      if (!lodLevel || !lodLevel.peaks || lodLevel.peaks.length === 0) {
        console.warn('Invalid LOD level for region:', region.id);
        return new Float32Array(0);
      }

      // Extract visible peaks based on trim and length
      const peaks = extractVisiblePeaks(lodLevel, effectiveTrimStart, length, originalLength);

      // Validate extracted peaks
      if (!peaks || peaks.length === 0) {
        return new Float32Array(0);
      }

      return peaks;
    } catch (error) {
      console.error('Failed to generate waveform LOD:', error);
      return new Float32Array(0);
    }
  }, [audioBuffer, region.id, width, length, effectiveTrimStart, originalLength, waveformQuality, beatWidth]);

  if (!audioBuffer || visiblePeaks.length === 0) {
    return null;
  }

  const waveformHeight = height - 16;
  const innerAvailableHeight = Math.max(waveformHeight - TRACK_WAVEFORM_PADDING * 2, 0);
  const innerTop = y + (height - waveformHeight) / 2 + TRACK_WAVEFORM_PADDING;
  const innerBottom = innerTop + innerAvailableHeight;
  const centerY = innerTop + innerAvailableHeight / 2;

  // Apply gain to waveform visualization
  const gainMultiplier = (() => {
    const gainDb = region.gain || 0;
    return Math.pow(10, gainDb / 20); // Convert dB to linear
  })();

  // Calculate fade positions
  const fadeInDuration = region.fadeInDuration || 0;
  const fadeOutDuration = region.fadeOutDuration || 0;
  const fadeInWidth = fadeInDuration * beatWidth;
  const fadeOutWidth = fadeOutDuration * beatWidth;
  const fadeInEndX = loopX + fadeInWidth;
  const fadeOutStartX = loopX + width - fadeOutWidth;

  // Render MinMax peaks (each peak is a min/max pair)
  const peakCount = Math.floor(visiblePeaks.length / 2);

  // If no peaks, show a placeholder
  if (peakCount === 0) {
    return (
      <Rect
        x={loopX}
        y={centerY - 1}
        width={width}
        height={2}
        fill="#1f2937"
        opacity={0.3}
        listening={false}
      />
    );
  }

  // Optimized waveform rendering using single Shape with custom drawing
  return (
    <>
      <Shape
        sceneFunc={(context, shape) => {
          context.fillStyle = '#1f2937';
          context.globalAlpha = isMainLoop ? 0.7 : 0.4;

          const availableHeight = innerAvailableHeight > 0 ? innerAvailableHeight : waveformHeight;

          // Calculate optimal bar width to prevent overdraw
          const barWidth = calculateOptimalBarWidth(width, peakCount, 0.5, 2);

          // Viewport culling: Only draw bars that are visible on screen
          let startBarIndex = 0;
          let endBarIndex = peakCount;

          // Use passed viewport props if available
          if (typeof viewportStartBeat === 'number' && typeof viewportEndBeat === 'number') {
            // Calculate region's position in beats relative to viewport
            // region.start is not available here directly, but we can infer relative position
            // loopX is the absolute X position of this loop iteration

            // Calculate absolute start and end X of this loop iteration
            const regionStartX = loopX;
            const regionEndX = loopX + width;

            // Calculate viewport X range
            const viewportStartX = viewportStartBeat * beatWidth;
            const viewportEndX = viewportEndBeat * beatWidth;

            // Check if this loop iteration is visible
            if (regionEndX < viewportStartX || regionStartX > viewportEndX) {
              // Completely off-screen
              return;
            }

            // Calculate visible intersection
            const visibleStartX = Math.max(regionStartX, viewportStartX);
            const visibleEndX = Math.min(regionEndX, viewportEndX);

            // Convert back to local ratio within the region (0 to 1)
            const startRatio = (visibleStartX - regionStartX) / width;
            const endRatio = (visibleEndX - regionStartX) / width;

            // Convert to bar indices
            startBarIndex = Math.floor(startRatio * peakCount);
            endBarIndex = Math.ceil(endRatio * peakCount);

            // Clamp indices
            startBarIndex = Math.max(0, startBarIndex);
            endBarIndex = Math.min(peakCount, endBarIndex);

            // Only apply culling if beneficial
            const visibleBarCount = endBarIndex - startBarIndex;
            if (!shouldApplyViewportCulling(peakCount, visibleBarCount, viewportCulling)) {
              startBarIndex = 0;
              endBarIndex = peakCount;
            }
          }

          // Only draw visible bars
          for (let index = startBarIndex; index < endBarIndex; index++) {
            const minValue = visiblePeaks[index * 2] || 0;
            const maxValue = visiblePeaks[index * 2 + 1] || 0;

            const waveX = loopX + (index / peakCount) * width;

            // Scale min and max by gain
            const scaledMin = minValue * gainMultiplier;
            const scaledMax = maxValue * gainMultiplier;

            // Calculate positions for min and max
            const minHeight = Math.abs(scaledMin) * availableHeight;
            const maxHeight = Math.abs(scaledMax) * availableHeight;

            // Draw from center outward
            const topY = Math.max(innerTop, centerY - maxHeight / 2);
            const bottomY = Math.min(innerBottom, centerY + Math.abs(minHeight) / 2);
            const waveHeight = Math.max(bottomY - topY, 1);

            // Ensure valid dimensions
            if (isFinite(waveX) && isFinite(topY) && isFinite(waveHeight)) {
              context.fillRect(waveX, topY, barWidth, waveHeight);
            }
          }

          // Required for Konva
          context.fillStrokeShape(shape);
        }}
        listening={false}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />

      {/* Fade In Overlay - only on main loop */}
      {isMainLoop && fadeInDuration > 0 && (
        <Line
          points={[
            loopX, y,                    // Top left (full darkness/silence)
            loopX, y + height,           // Bottom left (full darkness/silence)
            fadeInEndX, y,               // Top right (no darkness/full volume)
            loopX, y,                    // Close
          ]}
          fill="#fbbf24"
          opacity={0.3}
          closed={true}
          listening={false}
        />
      )}

      {/* Fade Out Overlay - only on main loop */}
      {isMainLoop && fadeOutDuration > 0 && (
        <Line
          points={[
            fadeOutStartX, y,            // Top left (no darkness/full volume)
            loopX + width, y,            // Top right (full darkness/silence)
            loopX + width, y + height,   // Bottom right (full darkness/silence)
            fadeOutStartX, y,            // Close
          ]}
          fill="#f97316"
          opacity={0.3}
          closed={true}
          listening={false}
        />
      )}
    </>
  );
};

