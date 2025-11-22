import { useCallback } from 'react';
import { Group, Text, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { TimeMarker } from '../../types/marker';

interface TimeRulerMarkerProps {
  marker: TimeMarker;
  pixelsPerBeat: number;
  zoom: number;
  height: number;
  isEditMode: boolean;
  isSelected: boolean;
  onDoubleClick: (markerId: string) => void;
}

export const TimeRulerMarker = ({
  marker,
  pixelsPerBeat,
  zoom,
  height,
  isEditMode,
  isSelected,
  onDoubleClick,
}: TimeRulerMarkerProps) => {
  const x = marker.position * pixelsPerBeat * zoom;
  const markerWidth = 8;
  const markerHeight = 16;
  
  // Truncate description for display
  const maxChars = 15;
  const displayText = marker.description.length > maxChars 
    ? marker.description.substring(0, maxChars) + '...' 
    : marker.description;

  const handleDoubleClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!isEditMode) return;
    e.cancelBubble = true;
    onDoubleClick(marker.id);
  }, [isEditMode, marker.id, onDoubleClick]);

  return (
    <Group
      x={x}
      y={0}
      name={`marker-${marker.id}`}
      onDblClick={handleDoubleClick}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage && isEditMode) {
          stage.container().style.cursor = 'grab';
        }
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) {
          stage.container().style.cursor = 'default';
        }
      }}
    >
      {/* Marker flag */}
      <Line
        points={[0, 0, markerWidth, 0, markerWidth, markerHeight, 0, markerHeight, 0, 0]}
        fill={isSelected ? '#fbbf24' : marker.color || '#3b82f6'}
        stroke={isSelected ? '#f59e0b' : '#1e40af'}
        strokeWidth={1}
        closed
      />
      
      {/* Vertical line */}
      <Line
        points={[0, 0, 0, height]}
        stroke={isSelected ? '#fbbf24' : marker.color || '#3b82f6'}
        strokeWidth={isSelected ? 2 : 1}
        opacity={0.6}
        dash={[4, 4]}
      />
      
      {/* Description text */}
      {displayText && (
        <Text
          x={markerWidth + 4}
          y={2}
          text={displayText}
          fontSize={10}
          fill="#ffffff"
          listening={false}
        />
      )}
    </Group>
  );
};
