import React, { useState, useEffect, useCallback } from 'react';

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

const STYLE_ELEMENT_ID = 'toast-notification-style';

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

export const ToastNotification: React.FC = () => {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const filtered = prev.filter((msg) => msg.id !== id);
      if (filtered.length === 0) {
        setIsVisible(false);
      }
      return filtered;
    });
  }, []);

  const addMessage = useCallback((message: ToastMessageInput) => {
    const newMessage: ToastMessage = {
      ...message,
      id: `toast-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev.slice(-4), newMessage]); // Keep only last 5 messages
    setIsVisible(true);

    // Auto-hide success and info messages
    if (
      message.autoHide !== false &&
      (message.type === 'success' || message.type === 'info')
    ) {
      setTimeout(() => {
        removeMessage(newMessage.id);
      }, 5000);
    }
  }, [removeMessage]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (document.getElementById(STYLE_ELEMENT_ID)) {
      return;
    }

    const styleSheet = document.createElement('style');
    styleSheet.id = STYLE_ELEMENT_ID;
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }, []);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe(addMessage);
    return unsubscribe;
  }, [addMessage]);

  if (!isVisible || messages.length === 0) {
    return null;
  }

  const getStatusIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  const getStatusColor = (type: ToastMessage['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-100 border-red-400 text-red-700';
      case 'warning':
        return 'bg-yellow-100 border-yellow-400 text-yellow-700';
      case 'info':
        return 'bg-blue-100 border-blue-400 text-blue-700';
      case 'success':
        return 'bg-green-100 border-green-400 text-green-700';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-700';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md space-y-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`border-l-4 p-4 rounded-md shadow-lg ${getStatusColor(message.type)} animate-slide-in`}
        >
          <div className="flex items-start">
            <div className="shrink-0">
              <span className="text-lg">{getStatusIcon(message.type)}</span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium">{message.message}</p>
              {message.action && (
                <div className="mt-2">
                  <button
                    onClick={message.action.onClick}
                    className="text-sm bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded border border-current transition-colors"
                  >
                    {message.action.label}
                  </button>
                </div>
              )}
            </div>
            <div className="ml-3 shrink-0">
              <button
                onClick={() => removeMessage(message.id)}
                className="text-current hover:opacity-70 transition-opacity"
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}

      {messages.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setMessages([]);
              setIsVisible(false);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

// CSS for animations
const styles = `
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
`;

