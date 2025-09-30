import { useCallback } from "react";
import type { StatusMessageInput } from "./index";

declare global {
  interface Window {
    addConnectionStatusMessage?: (message: StatusMessageInput) => void;
  }
}

export const useConnectionStatusDisplay = () => {
  const addMessage = useCallback((message: StatusMessageInput) => {
    window.addConnectionStatusMessage?.(message);
  }, []);

  const showError = useCallback(
    (
      message: string,
      action?: { label: string; onClick: () => void },
    ) => {
      addMessage({ message, type: "error", autoHide: false, action });
    },
    [addMessage],
  );

  const showWarning = useCallback(
    (message: string, autoHide: boolean = true) => {
      addMessage({ message, type: "warning", autoHide });
    },
    [addMessage],
  );

  const showInfo = useCallback(
    (message: string, autoHide: boolean = true) => {
      addMessage({ message, type: "info", autoHide });
    },
    [addMessage],
  );

  const showSuccess = useCallback(
    (message: string, autoHide: boolean = true) => {
      addMessage({ message, type: "success", autoHide });
    },
    [addMessage],
  );

  return {
    showError,
    showWarning,
    showInfo,
    showSuccess,
  };
};
