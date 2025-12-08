import { useCallback } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timestamp: number;
  autoHide?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export type ToastMessageInput = Omit<ToastMessage, 'id' | 'timestamp'>;

// Global toast manager
class ToastManager {
  private listeners: Set<(message: ToastMessageInput) => void> = new Set();

  subscribe(listener: (message: ToastMessageInput) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  show(message: ToastMessageInput) {
    this.listeners.forEach((listener) => listener(message));
  }
}

const toastManager = new ToastManager();

// Expose globally for useConnectionStatusDisplay compatibility
if (typeof window !== 'undefined') {
  (window as any).addConnectionStatusMessage = (message: ToastMessageInput) => {
    toastManager.show(message);
  };
}

// Export toastManager for use in ToastNotification component
export { toastManager };

export const useToastNotification = () => {
  const showError = useCallback(
    (message: string, action?: { label: string; onClick: () => void }) => {
      toastManager.show({ message, type: 'error', autoHide: false, action });
    },
    []
  );

  const showWarning = useCallback((message: string, autoHide: boolean = true) => {
    toastManager.show({ message, type: 'warning', autoHide });
  }, []);

  const showInfo = useCallback((message: string, autoHide: boolean = true) => {
    toastManager.show({ message, type: 'info', autoHide });
  }, []);

  const showSuccess = useCallback((message: string, autoHide: boolean = true) => {
    toastManager.show({ message, type: 'success', autoHide });
  }, []);

  return {
    showError,
    showWarning,
    showInfo,
    showSuccess,
  };
};

