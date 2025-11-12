import { Group, Rect } from 'react-konva';
import type { Region } from '../../../types/daw';
import { MidiRegionContent } from './MidiRegionContent';
import { AudioRegionContent } from './AudioRegionContent';

interface DuplicateRegionPreviewProps {
  region: Region;
  x: number;
  y: number;
  width: number;
  height: number;
  beatWidth: number;
}

export const DuplicateRegionPreview = ({
  region,
  x,
  y,
  width,
  height,
  beatWidth,
}: DuplicateRegionPreviewProps) => {
  return (
    <Group>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={`${region.color}99`}
        stroke="#10b981"
        strokeWidth={2}
        dash={[4, 4]}
        cornerRadius={4}
        listening={false}
      />

      {/* Region content preview */}
      {region.type === 'midi' ? (
        <MidiRegionContent
          region={region}
          loopX={x}
          y={y}
          width={width}
          height={height}
          beatWidth={beatWidth}
          isMainLoop={true}
          length={region.length}
          headResizeState={null}
        />
      ) : (
        <AudioRegionContent
          region={region}
          loopX={x}
          y={y}
          width={width}
          height={height}
          beatWidth={beatWidth}
          isMainLoop={true}
          length={region.length}
          headResizeState={null}
        />
      )}
    </Group>
  );
};

