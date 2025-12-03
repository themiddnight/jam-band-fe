import { useTouchEvents } from "../../hooks/useTouchEvents";
import { getKeyDisplayName } from "@/shared/utils/displayUtils";

interface SharpModifierButtonProps {
  shortcutKey: string;
  isActive: boolean;
  onPress: () => void;
  onRelease: () => void;
}

/**
 * Button for +1 semitone (sharp) modifier
 * Similar to ChordModifierButton but for transposing notes up by 1 semitone
 * Works with shift key held down
 */
export const SharpModifierButton: React.FC<SharpModifierButtonProps> = ({
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
      className={`btn btn-xs sm:btn-sm join-item touch-manipulation ${
        isActive ? "btn-accent" : "btn-outline"
      }`}
    >
      <span>#</span>{" "}
      <kbd className="kbd kbd-xs hidden sm:inline">
        {getKeyDisplayName(shortcutKey)}
      </kbd>
    </button>
  );
};
