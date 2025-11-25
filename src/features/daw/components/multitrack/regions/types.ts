import type { KonvaEventObject } from 'konva/lib/Node';
import type { Region, RegionId } from '@/features/daw/types/daw';

export interface BaseRegionProps {
  region: Region;
  x: number;
  y: number;
  width: number;
  height: number;
  beatWidth: number;
  isSelected: boolean;
  isMovingToNewTrack: boolean;
  loops: number;
  isLockedByRemote: boolean;
  onPointerDown: (event: KonvaEventObject<PointerEvent>) => void;
}

export interface RegionContentProps {
  region: Region;
  loopX: number;
  y: number;
  width: number;
  height: number;
  beatWidth: number;
  isMainLoop: boolean;
  length: number;
  headResizeState?: {
    regionIds: RegionId[];
    initialStarts: Record<RegionId, number>;
    previewStarts: Record<RegionId, number>;
    previewLengths: Record<RegionId, number>;
  } | null;
  viewportStartBeat?: number;
  viewportEndBeat?: number;
}

export interface RegionHandlesProps {
  x: number;
  y: number;
  width: number;
  height: number;
  loops: number;
  handleSize: number;
  disabled?: boolean;
  onHeadHandleDown: (event: KonvaEventObject<PointerEvent>) => void;
  onLengthHandleDown: (event: KonvaEventObject<PointerEvent>) => void;
  onLoopHandleDown: (event: KonvaEventObject<PointerEvent>) => void;
}

