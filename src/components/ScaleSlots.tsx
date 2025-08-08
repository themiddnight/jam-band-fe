import { SCALE_SLOT_COUNT, getScaleSlotLabel } from "../constants/scaleSlots";
import type { Scale } from "../hooks/useScaleState";
import { useScaleSlotsStore } from "../stores/scaleSlotsStore";
import ScaleSelector from "./ScaleSelector";
import { Modal } from "./shared/Modal";
import { useState } from "react";

export interface ScaleSlotsProps {
  onSlotSelect: (rootNote: string, scale: Scale) => void;
}

export default function ScaleSlots({ onSlotSelect }: ScaleSlotsProps) {
  const { slots, selectedSlotId, selectSlot, setSlot } = useScaleSlotsStore();
  const [showPopup, setShowPopup] = useState(false);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editingValues, setEditingValues] = useState<{
    rootNote: string;
    scale: Scale;
  } | null>(null);
  const [lastTap, setLastTap] = useState<{
    slotId: number;
    timestamp: number;
  } | null>(null);

  const handleSlotClick = (slotId: number) => {
    const slot = slots.find((s) => s.id === slotId);
    if (slot) {
      selectSlot(slotId);
      onSlotSelect(slot.rootNote, slot.scale);
    }
  };

  const handleSlotDoubleClick = (slotId: number) => {
    const slot = slots.find((s) => s.id === slotId);
    if (slot) {
      setEditingSlot(slotId);
      setEditingValues({ rootNote: slot.rootNote, scale: slot.scale });
      setShowPopup(true);
    }
  };

  const handleSlotTouch = (slotId: number) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // 300ms for double tap

    if (
      lastTap &&
      lastTap.slotId === slotId &&
      now - lastTap.timestamp < DOUBLE_TAP_DELAY
    ) {
      // Double tap detected
      setEditingSlot(slotId);
      setShowPopup(true);
      setLastTap(null);
    } else {
      // Single tap
      const slot = slots.find((s) => s.id === slotId);
      if (slot) {
        selectSlot(slotId);
        onSlotSelect(slot.rootNote, slot.scale);
      }
      setLastTap({ slotId, timestamp: now });
    }
  };

  const handlePopupClose = () => {
    setShowPopup(false);
    setEditingSlot(null);
    setEditingValues(null);
  };

  const handleScaleChange = (rootNote: string, scale: Scale) => {
    if (editingSlot && editingValues) {
      // Update the local editing values
      setEditingValues({ rootNote, scale });
      // Update the slot in the store
      setSlot(editingSlot, rootNote, scale);
      // Also apply the scale to the current state
      onSlotSelect(rootNote, scale);
    }
  };

  return (
    <>
      <div className="card bg-base-100 shadow-lg grow">
        <div className="card-body p-3">
          <div className="flex justify-center items-center gap-2 my-auto">
            <label className="label py-1">
              <span className="label-text hidden lg:block text-xs">Scale</span>
            </label>
            <div className="join flex-wrap">
              {Array.from({ length: SCALE_SLOT_COUNT }, (_, index) => {
                const slotId = index + 1;
                const slot = slots.find((s) => s.id === slotId);
                const isSelected = selectedSlotId === slotId;

                return (
                  <button
                    key={slotId}
                    onClick={() => handleSlotClick(slotId)}
                    onDoubleClick={() => handleSlotDoubleClick(slotId)}
                    onTouchEnd={() => handleSlotTouch(slotId)}
                    className={`btn btn-xs lg:btn-sm join-item ${
                      isSelected ? "btn-primary" : "btn-outline"
                    }`}
                    title={`Slot ${slotId}: ${slot ? getScaleSlotLabel(slot.rootNote, slot.scale) : ''} (Press ${slotId}, Double-click/tap to edit)`}
                  >
                    <span className="text-xs">
                      {slot ? getScaleSlotLabel(slot.rootNote, slot.scale) : ''}
                      <kbd className="kbd kbd-xs ml-1">{slotId}</kbd>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Scale Selector Modal */}
      <Modal
        open={showPopup}
        setOpen={setShowPopup}
        onClose={handlePopupClose}
        title={`Edit Slot ${editingSlot}`}
        size="sm"
        showCancelButton={true}
        showOkButton={true}
        okText="Done"
        cancelText="Cancel"
        onOk={handlePopupClose}
        onCancel={handlePopupClose}
      >
        {editingSlot && editingValues && (
          <ScaleSelector
            rootNote={editingValues.rootNote}
            scale={editingValues.scale}
            onRootNoteChange={(rootNote) => {
              const currentScale = editingValues.scale;
              handleScaleChange(rootNote, currentScale);
            }}
            onScaleChange={(scale) => {
              const currentRootNote = editingValues.rootNote;
              handleScaleChange(currentRootNote, scale);
            }}
          />
        )}
      </Modal>
    </>
  );
}
