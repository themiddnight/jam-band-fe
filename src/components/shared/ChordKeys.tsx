import { memo } from "react";
import { InstrumentButton } from "./InstrumentButton";

export interface ChordKey {
  degree: number;
  keyboardKey: string;
  chordName: string;
  chordSuffix?: string;
  isPressed: boolean;
}

interface SharedChordKeysProps {
  chordKeys: ChordKey[];
  onChordPress: (degree: number) => void;
  onChordRelease: (degree: number) => void;
  variant?: 'keyboard' | 'guitar';
}

export const SharedChordKeys = memo<SharedChordKeysProps>(({
  chordKeys,
  onChordPress,
  onChordRelease,
  variant = 'keyboard',
}) => {
  return (
    <div className="flex justify-center gap-1">
      {chordKeys.map((chordKey) => (
        <InstrumentButton
          key={`chord-${chordKey.degree}`}
          keyboardKey={chordKey.keyboardKey}
          chordName={chordKey.chordName}
          chordSuffix={chordKey.chordSuffix}
          isPressed={chordKey.isPressed}
          onPress={() => onChordPress(chordKey.degree)}
          onRelease={() => onChordRelease(chordKey.degree)}
          variant="chord"
          size={variant === 'guitar' ? 'lg' : 'md'}
        />
      ))}
    </div>
  );
});

SharedChordKeys.displayName = 'SharedChordKeys'; 