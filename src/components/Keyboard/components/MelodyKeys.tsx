import { SharedNoteKeys, type NoteKey } from "../../shared/NoteKeys";
import type { KeyboardKey } from "../types/keyboard";
import { memo } from "react";

interface MelodyKeysProps {
  virtualKeys: KeyboardKey[];
  pressedKeys: Set<string>;
  onKeyPress: (key: KeyboardKey) => void;
  onKeyRelease: (key: KeyboardKey) => void;
}

export const MelodyKeys = memo<MelodyKeysProps>(
  ({ virtualKeys, pressedKeys, onKeyPress, onKeyRelease }) => {
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
      />
    );
  },
);

MelodyKeys.displayName = "MelodyKeys";
