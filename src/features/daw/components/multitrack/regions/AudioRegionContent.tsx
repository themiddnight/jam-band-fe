import { useMemo } from 'react';
import { Line, Rect } from 'react-konva';
import type { RegionContentProps } from './types';
import type { AudioRegion } from '@/features/daw/types/daw';
import { useWaveformData } from '@/features/daw/hooks/useWaveformData';

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
}: AudioRegionContentProps) => {
  const audioBuffer = region.audioBuffer;
  const originalLength = region.originalLength ?? length;

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

  // Generate waveform based on ORIGINAL length for consistent detail
  // Sample density: ~1 sample per 4 pixels of original length
  const originalWidthPixels = originalLength * beatWidth;
  const totalSamples = Math.max(100, Math.floor(originalWidthPixels / 4));
  const { data: waveformData } = useWaveformData(audioBuffer ?? null, totalSamples, { normalize: false });

  const visiblePeaks = useMemo(() => {
    if (!waveformData || waveformData.length === 0) {
      return [] as number[];
    }

    // Calculate which part of the waveform to show based on trim
    const trimRatio = effectiveTrimStart / originalLength;
    const lengthRatio = length / originalLength;
    const startIdx = Math.floor(trimRatio * waveformData.length);
    const endIdx = Math.min(
      waveformData.length,
      Math.max(startIdx + 1, Math.ceil((trimRatio + lengthRatio) * waveformData.length)),
    );

    return Array.from(waveformData.subarray(startIdx, endIdx));
  }, [waveformData, effectiveTrimStart, originalLength, length]);

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

  return (
    <>
      {visiblePeaks.map((amplitude, index) => {
        const waveX = loopX + (index / visiblePeaks.length) * width;
        const scaledAmplitude = amplitude * gainMultiplier;
        const availableHeight = innerAvailableHeight > 0 ? innerAvailableHeight : waveformHeight;
        const clampedHeight = Math.max(Math.min(scaledAmplitude * availableHeight, availableHeight), 1);
        const minY = innerTop;
        const maxY = innerBottom;
        const rectTop = Math.max(minY, centerY - clampedHeight / 2);
        const rectBottom = Math.min(maxY, rectTop + clampedHeight);
        const waveHeight = Math.max(rectBottom - rectTop, 1);

        return (
          <Rect
            key={`${region.id}-wave-${index}`}
            x={waveX}
            y={rectTop}
            width={Math.max(width / visiblePeaks.length, 1)}
            height={Math.max(waveHeight, 1)}
            fill="#1f2937"
            opacity={isMainLoop ? 0.7 : 0.4}
            listening={false}
          />
        );
      })}

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

