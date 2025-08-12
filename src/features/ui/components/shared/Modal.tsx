import React, { useEffect } from "react";

interface ModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpen?: () => void;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  showCancelButton?: boolean;
  showOkButton?: boolean;
  okText?: string;
  cancelText?: string;
  onOk?: () => void;
  onCancel?: () => void;
  size?:
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl"
    | "7xl";
}

export const Modal: React.FC<ModalProps> = ({
  open,
  setOpen,
  onOpen,
  onClose,
  title = "Confirm",
  children,
  showCancelButton = true,
  showOkButton = true,
  okText = "OK",
  cancelText = "Cancel",
  onOk,
  onCancel,
  size = "md",
}) => {
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Enter" && showOkButton && onOk) {
        // Don't handle Enter if focus is on an input element
        const activeElement = document.activeElement;
        const isInputElement =
          activeElement &&
          (activeElement.tagName === "TEXTAREA" ||
            (activeElement as HTMLElement).contentEditable === "true");

        if (!isInputElement) {
          e.preventDefault();
          handleOk();
        }
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      onOpen?.();
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showOkButton, onOk]);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleOk = () => {
    onOk?.();
    handleClose();
  };

  const handleCancel = () => {
    onCancel?.();
    handleClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <div className="modal modal-open" onClick={handleBackdropClick}>
      <div
        className={`modal-box max-w-${size} max-h-[90vh] flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button
            onClick={handleClose}
            className="btn btn-sm btn-circle btn-ghost"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {children}
        </div>

        {/* Footer */}
        {(showOkButton || showCancelButton) && (
          <div className="modal-action">
            {showCancelButton && (
              <button onClick={handleCancel} className="btn btn-outline">
                {cancelText}
              </button>
            )}
            {showOkButton && (
              <button onClick={handleOk} className="btn btn-primary">
                {okText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
