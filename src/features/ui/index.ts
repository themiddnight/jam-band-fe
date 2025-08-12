// UI Feature Barrel Export

// Components exports
export { default as ScaleSelector } from './components/ScaleSelector';
export { default as ScaleSlots } from './components/ScaleSlots';
export { Footer } from './components/Footer';

// Shared UI components exports
export { Modal } from './components/shared/Modal';
export { Knob } from './components/shared/Knob';
export { InstrumentButton } from './components/shared/InstrumentButton';
export { default as BaseInstrument } from './components/shared/BaseInstrument';
export { default as AnchoredPopup } from './components/shared/AnchoredPopup';
export { SharedChordKeys as ChordKeys } from './components/shared/ChordKeys';
export { ChordModifierButton } from './components/shared/ChordModifierButton';
export { FretboardBase } from './components/shared/FretboardBase';
export { default as GroupedDropdown } from './components/shared/GroupedDropdown';
export { SharedNoteKeys as NoteKeys } from './components/shared/NoteKeys';
export { VirtualKeyButton } from './components/shared/VirtualKeyButton';

// Types exports
export type { FretboardConfig } from './components/shared/FretboardBase';
export type { ChordKey } from './components/shared/ChordKeys';
export type { NoteKey } from './components/shared/NoteKeys';
export type { GroupedOption } from './components/shared/GroupedDropdown';

// Hooks exports
export { useScaleState } from './hooks/useScaleState';
export { useScaleSlotKeyboard } from './hooks/useScaleSlotKeyboard';
export { useTouchEvents } from './hooks/useTouchEvents';

// Constants exports
export * from './constants/chordModifierConfig';
export { ChordModifierType } from './constants/chordModifierConfig';

// Utilities exports
export * from './utils/musicUtils';