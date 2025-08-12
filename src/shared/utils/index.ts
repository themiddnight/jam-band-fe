// Re-export shared utilities
export { 
  NOTE_NAMES, 
  SCALES, 
  getNoteAtFret, 
  getScaleNotes, 
  getChordFromDegree, 
  getChordName, 
  generateFretPositions, 
  generateVirtualKeys, 
  generateDrumPads 
} from "./musicUtils";
export * from "./performanceUtils";
export * from "./webkitCompat";
export * from "./displayUtils";
export { default as axiosInstance } from "./axiosInstance";
export * from "./endpoints";