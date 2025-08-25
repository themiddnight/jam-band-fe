import { memo, useState } from "react";
import { useTouchEvents } from "@/features/ui";
import { Modal } from "@/features/ui/components/shared/Modal";
import type { CSSProperties } from "react";

interface BankActionsProps {
  currentBank: string;
  onCopyBank: (bankName: string) => void;
  onPasteBank: (bankName: string) => void;
  onClearBank: () => void;
}

export const BankActions = memo(
  ({ currentBank, onCopyBank, onPasteBank, onClearBank }: BankActionsProps) => {
    const [showClearModal, setShowClearModal] = useState(false);
    const copyTouchHandlers = useTouchEvents({
      onPress: () => onCopyBank(currentBank),
      onRelease: () => {},
      isPlayButton: true,
    });

    const pasteTouchHandlers = useTouchEvents({
      onPress: () => onPasteBank(currentBank),
      onRelease: () => {},
      isPlayButton: true,
    });

    const clearTouchHandlers = useTouchEvents({
      onPress: () => setShowClearModal(true),
      onRelease: () => {},
      isPlayButton: true,
    });

    const handleClearConfirm = () => {
      onClearBank();
      setShowClearModal(false);
    };

    const mobileButtonStyle: CSSProperties = {
      touchAction: "manipulation",
      WebkitTapHighlightColor: "transparent",
      WebkitTouchCallout: "none" as const,
      WebkitUserSelect: "none",
      userSelect: "none",
    };

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="join">
          <button
            className="btn btn-sm join-item btn-outline btn-info touch-manipulation"
            onMouseDown={() => onCopyBank(currentBank)}
            ref={copyTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
            style={mobileButtonStyle}
            title={`Copy Bank ${currentBank} patterns`}
          >
            📋 Copy
          </button>
          <button
            className="btn btn-sm join-item btn-outline btn-success touch-manipulation"
            onMouseDown={() => onPasteBank(currentBank)}
            ref={pasteTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
            style={mobileButtonStyle}
            title={`Paste copied patterns to Bank ${currentBank}`}
          >
            📄 Paste
          </button>
        </div>

        {/* <div className="divider divider-horizontal !w-0"></div> */}

        <button
          className="btn btn-sm btn-outline btn-error touch-manipulation"
          onMouseDown={() => setShowClearModal(true)}
          ref={clearTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
          style={mobileButtonStyle}
          title={`Clear Bank ${currentBank}`}
        >
          Clear
        </button>

        <Modal
          open={showClearModal}
          setOpen={setShowClearModal}
          title="Clear Bank"
          onOk={handleClearConfirm}
          okText="Clear"
          cancelText="Cancel"
        >
          <p>
            Are you sure you want to clear all patterns in Bank {currentBank}?
            This action cannot be undone.
          </p>
        </Modal>
      </div>
    );
  }
);

BankActions.displayName = "BankActions";
