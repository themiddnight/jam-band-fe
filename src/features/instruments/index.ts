// Instruments Feature Barrel Export

// Components exports
export { default as Guitar } from './components/Guitar';
export { default as Bass } from './components/Bass';
export { default as Keyboard } from './components/Keyboard';
export { default as Drumpad } from './components/Drumpad';
export { default as Drumset } from './components/Drumset';
// Synthesizer components are exported individually
export { SynthControls } from './components/Synthesizer/SynthControls';
export { LatencyControls } from './components/Synthesizer/LatencyControls';
export { default as InstrumentCategorySelector } from './components/InstrumentCategorySelector';

// Store exports
export { useGuitarStore } from './stores/guitarStore';
export { useBassStore } from './stores/bassStore';
export { useKeyboardStore } from './stores/keyboardStore';
export { useDrumStore } from './stores/drumStore';
export { useBaseInstrumentStore } from './stores/baseInstrumentStore';
export { useDrumpadPresetsStore } from './stores/drumpadPresetsStore';