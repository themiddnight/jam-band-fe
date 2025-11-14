import { Line, Rect } from 'react-konva';
import type { AudioRegion } from '../../../types/daw';
import type { RegionContentProps } from './types';
import { generateWaveformData, normalizeWaveform } from '../../../utils/waveformUtils';

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
  if (!region.audioBuffer) {
    return null;
  }

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
  const waveformData = generateWaveformData(audioBuffer, totalSamples);
  const normalizedData = normalizeWaveform(waveformData);

  // Calculate which part of the waveform to show based on trim
  const trimRatio = effectiveTrimStart / originalLength;
  const lengthRatio = length / originalLength;
  const startIdx = Math.floor(trimRatio * normalizedData.length);
  const endIdx = Math.ceil((trimRatio + lengthRatio) * normalizedData.length);
  const visibleData = normalizedData.slice(startIdx, endIdx);

  const waveformHeight = height - 16;
  const centerY = y + height / 2;

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
      {visibleData.map((amplitude, index) => {
        const waveX = loopX + (index / visibleData.length) * width;
        const waveHeight = amplitude * gainMultiplier * waveformHeight / 2;

        return (
          <Rect
            key={`${region.id}-wave-${index}`}
            x={waveX}
            y={centerY - waveHeight / 2}
            width={Math.max(width / visibleData.length, 1)}
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

