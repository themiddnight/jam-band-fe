import {
  ChordModifierType,
  getChordModifierDisplayName,
  getChordModifierColorClass,
} from "../../constants/chordModifierConfig";
import { getKeyDisplayName } from "../../constants/utils/displayUtils";
import { useTouchEvents } from "../../hooks/useTouchEvents";

interface ChordModifierButtonProps {
  modifier: ChordModifierType;
  shortcutKey: string;
  isActive: boolean;
  onPress: () => void;
  onRelease: () => void;
}

export const ChordModifierButton: React.FC<ChordModifierButtonProps> = ({
  modifier,
  shortcutKey,
  isActive,
  onPress,
  onRelease,
}) => {
  const touchHandlers = useTouchEvents({
    onPress,
    onRelease,
  });

  return (
    <button
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      ref={touchHandlers.ref as React.RefObject<HTMLButtonElement>}
      className={`px-2 py-1 rounded text-xs touch-manipulation ${getChordModifierColorClass(modifier, isActive)}`}
    >
      {getChordModifierDisplayName(modifier)}{" "}
      <kbd className="kbd kbd-sm">{getKeyDisplayName(shortcutKey)}</kbd>
    </button>
  );
};
