import { SharedNoteKeys, type NoteKey } from "../../shared/NoteKeys";
import type { KeyboardKey } from "../types/keyboard";
import { memo } from "react";

interface MelodyKeyboardProps {
  virtualKeys: KeyboardKey[];
  pressedKeys: Set<string>;
  onKeyPress: (key: KeyboardKey) => void;
  onKeyRelease: (key: KeyboardKey) => void;
  // Add sustain state to prevent mouse leave issues
  sustain?: boolean;
  sustainToggle?: boolean;
}

export const MelodyKeyboard = memo<MelodyKeyboardProps>(
  ({ virtualKeys, pressedKeys, onKeyPress, onKeyRelease, sustain = false, sustainToggle = false }) => {
    // Convert KeyboardKey to NoteKey format
    const noteKeys: NoteKey[] = virtualKeys.map((key) => ({
      note: key.note,
      keyboardKey: key.keyboardKey || "",
      isPressed: pressedKeys.has(key.note),
      position: key.position,
    }));

    return (
      <SharedNoteKeys
        noteKeys={noteKeys}
        onKeyPress={(noteKey) => {
          const originalKey = virtualKeys.find(
            (k) =>
              k.note === noteKey.note && k.keyboardKey === noteKey.keyboardKey,
          );
          if (originalKey) {
            onKeyPress(originalKey);
          }
        }}
        onKeyRelease={(noteKey) => {
          const originalKey = virtualKeys.find(
            (k) =>
              k.note === noteKey.note && k.keyboardKey === noteKey.keyboardKey,
          );
          if (originalKey) {
            onKeyRelease(originalKey);
          }
        }}
        variant="keyboard"
        sustain={sustain}
        sustainToggle={sustainToggle}
      />
    );
  },
);

MelodyKeyboard.displayName = "MelodyKeys";
