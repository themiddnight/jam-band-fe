import { SCALE_SLOT_SHORTCUTS } from "../constants/scaleSlots";
import type { Scale } from "../hooks/useScaleState";
import { useScaleSlotsStore } from "../stores/scaleSlotsStore";
import { useEffect } from "react";

export const useScaleSlotKeyboard = (
  onSlotSelect: (rootNote: string, scale: Scale) => void,
) => {
  const { slots, selectSlot } = useScaleSlotsStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;

      // Check if the target is an input element
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.closest('input, textarea, [contenteditable="true"]');

      // Skip if it's an input element
      if (isInputElement) {
        return;
      }

      // Check if the key is a scale slot shortcut (1-5)
      if (SCALE_SLOT_SHORTCUTS.includes(key)) {
        const slotId = parseInt(key);
        const slot = slots.find((s) => s.id === slotId);

        if (slot) {
          event.preventDefault();
          selectSlot(slotId);
          onSlotSelect(slot.rootNote, slot.scale);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slots, selectSlot, onSlotSelect]);
};
