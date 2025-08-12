import { InstrumentButton } from "./InstrumentButton";
import { memo } from "react";

export interface NoteKey {
  note: string;
  keyboardKey: string;
  isPressed: boolean;
  position?: number;
}

interface SharedNoteKeysProps {
  noteKeys: NoteKey[];
  onKeyPress: (noteKey: NoteKey) => void;
  onKeyRelease: (noteKey: NoteKey) => void;
  variant?: "keyboard" | "guitar";
  size?: "sm" | "md" | "lg";
  // Add sustain state to prevent mouse leave issues
  sustain?: boolean;
  sustainToggle?: boolean;
}

export const SharedNoteKeys = memo<SharedNoteKeysProps>(
  ({
    noteKeys,
    onKeyPress,
    onKeyRelease,
    variant = "keyboard",
    size = "md",
    sustain = false,
    sustainToggle = false,
  }) => {
    // Separate keys by position for better organization (for keyboard)
    const lowerRowKeys = noteKeys.filter((key) => (key.position || 0) < 100);
    const upperRowKeys = noteKeys.filter((key) => (key.position || 0) >= 100);

    // For guitar, we don't use position filtering, so show all keys in one row
    if (variant === "guitar") {
      return (
        <div className="flex justify-center gap-1">
          {noteKeys.map((noteKey, index) => (
            <InstrumentButton
              key={`note-${index}`}
              keyboardKey={noteKey.keyboardKey}
              note={noteKey.note}
              isPressed={noteKey.isPressed}
              onPress={() => onKeyPress(noteKey)}
              onRelease={() => onKeyRelease(noteKey)}
              variant="note"
              size={size}
              sustain={sustain}
              sustainToggle={sustainToggle}
            />
          ))}
        </div>
      );
    }

    // For keyboard, use the two-row layout
    return (
      <div className="flex flex-col gap-4 w-fit mx-auto">
        {/* Upper row */}
        {upperRowKeys.length > 0 && (
          <div className="flex justify-center gap-1">
            {upperRowKeys.map((noteKey, index) => (
              <InstrumentButton
                key={`upper-${index}`}
                keyboardKey={noteKey.keyboardKey}
                note={noteKey.note}
                isPressed={noteKey.isPressed}
                onPress={() => onKeyPress(noteKey)}
                onRelease={() => onKeyRelease(noteKey)}
                variant="note"
                size={size}
                sustain={sustain}
                sustainToggle={sustainToggle}
              />
            ))}
          </div>
        )}

        {/* Lower row */}
        {lowerRowKeys.length > 0 && (
          <div className="flex justify-center gap-1">
            {lowerRowKeys.map((noteKey, index) => (
              <InstrumentButton
                key={`lower-${index}`}
                keyboardKey={noteKey.keyboardKey}
                note={noteKey.note}
                isPressed={noteKey.isPressed}
                onPress={() => onKeyPress(noteKey)}
                onRelease={() => onKeyRelease(noteKey)}
                variant="note"
                size={size}
                sustain={sustain}
                sustainToggle={sustainToggle}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

SharedNoteKeys.displayName = "SharedNoteKeys";
