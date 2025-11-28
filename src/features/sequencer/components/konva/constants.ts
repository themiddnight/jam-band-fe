// Konva Step Sequencer constants
import { SEQUENCER_CONSTANTS } from '@/shared/constants';

export const KONVA_GRID = {
  CELL_SIZE: SEQUENCER_CONSTANTS.GRID.GRID_CELL_SIZE,
  NOTE_SIZE: SEQUENCER_CONSTANTS.GRID.NOTE_CELL_SIZE,
  CELL_GAP: SEQUENCER_CONSTANTS.GRID.CELL_GAP,
  LABEL_WIDTH: SEQUENCER_CONSTANTS.GRID.LABEL_WIDTH,
  HEADER_HEIGHT: SEQUENCER_CONSTANTS.GRID.BEAT_HEADER_HEIGHT,
} as const;

// Colors matching DaisyUI dark theme
export const COLORS = {
  // Background colors
  BACKGROUND: '#1d232a',
  CELL_INACTIVE: 'rgba(255, 255, 255, 0.05)',
  CELL_INACTIVE_BEAT: 'rgba(255, 255, 255, 0.08)',
  CELL_BORDER: 'rgba(255, 255, 255, 0.15)',
  
  // Active step colors
  STEP_ACTIVE: '#36d399', // success color
  STEP_ACTIVE_DRUM: '#fbbd23', // warning for drum
  STEP_ACTIVE_OUT_SCALE: '#f87272', // error for out of scale
  
  // Gate/velocity mode colors
  GATE_FILL: 'rgba(54, 211, 153, 0.6)',
  VELOCITY_FILL: 'rgba(251, 189, 35, 0.6)',
  
  // Root note highlight
  ROOT_NOTE_BG: 'rgba(99, 102, 241, 0.15)',
  ROOT_NOTE_BORDER: 'rgba(99, 102, 241, 0.5)',
  
  // Out of scale
  OUT_OF_SCALE: 'rgba(255, 255, 255, 0.3)',
  
  // Playhead
  PLAYHEAD: '#6366f1', // primary
  PLAYHEAD_RECORDING: '#f87272', // error
  
  // Text
  TEXT: '#ffffff',
  TEXT_DIM: 'rgba(255, 255, 255, 0.5)',
} as const;

// Interaction constants
export const INTERACTION = {
  TOUCH_MOVE_THRESHOLD: 10,
  TAP_TIME_THRESHOLD: 300,
  DOUBLE_TAP_DELAY: 300, // ms for double tap detection
  LONG_PRESS_DELAY: 400, // ms to hold before starting marquee on touch
  GATE_SENSITIVITY: 100,
  VELOCITY_SENSITIVITY: 80,
  MIN_GATE: SEQUENCER_CONSTANTS.MIN_GATE,
  MIN_VELOCITY: SEQUENCER_CONSTANTS.MIN_VELOCITY,
  GATE_STEPS: SEQUENCER_CONSTANTS.GATE_STEPS,
  VELOCITY_STEPS: SEQUENCER_CONSTANTS.VELOCITY_STEPS,
  DEFAULT_GATE: SEQUENCER_CONSTANTS.DEFAULT_GATE,
  DEFAULT_VELOCITY: SEQUENCER_CONSTANTS.DEFAULT_VELOCITY,
} as const;

// Calculate cell position
export const getCellPosition = (beatIndex: number, rowIndex: number) => {
  const x = beatIndex * (KONVA_GRID.CELL_SIZE + KONVA_GRID.CELL_GAP);
  const y = rowIndex * (KONVA_GRID.CELL_SIZE + KONVA_GRID.CELL_GAP);
  return { x, y };
};

// Calculate total grid dimensions
export const getGridDimensions = (beats: number, rows: number) => {
  const width = beats * (KONVA_GRID.CELL_SIZE + KONVA_GRID.CELL_GAP);
  const height = rows * (KONVA_GRID.CELL_SIZE + KONVA_GRID.CELL_GAP);
  return { width, height };
};
