import type { RegionId } from "../../types/daw";

export interface DragState {
  regionIds: RegionId[];
  originBeat: number;
  originY: number;
  delta: number;
  targetTrackId: string | null;
  isDuplicate: boolean;
  initialPositions: Record<RegionId, number>;
  initialTrackIds: Record<RegionId, string>;
}

export interface PanState {
  startX: number;
  startY: number;
}

export interface ResizeState {
  regionIds: RegionId[];
  originBeat: number;
  delta: number;
  initialLengths: Record<RegionId, number>;
  previewLengths: Record<RegionId, number>;
}

export interface HeadResizeState {
  regionIds: RegionId[];
  originBeat: number;
  delta: number;
  initialStarts: Record<RegionId, number>;
  initialLengths: Record<RegionId, number>;
  previewStarts: Record<RegionId, number>;
  previewLengths: Record<RegionId, number>;
}

export interface LoopState {
  regionIds: RegionId[];
  baseIterations: number;
  previewIterations: number;
  startX: number;
  targetLength: number;
}

export interface MarqueeState {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
}

export interface HoldState {
  x: number;
  y: number;
  startTime: number;
}
