import { ConnectionState } from "../../types/connectionState";
import React, { useState, useEffect, useCallback } from "react";

/**
 * Connection Status Display Component
 * Requirements: 6.10 - User feedback for connection issues and recovery status
 */

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  isHealthy: boolean;
  isInGracePeriod: boolean;
  reconnectionAttempts: number;
  onRetry?: () => void;
  onReturnToLobby?: () => void;
  onClearErrors?: () => void;
}

export interface StatusMessage {
  id: string;
  message: string;
  type: "error" | "warning" | "info" | "success";
  timestamp: number;
  autoHide?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export type StatusMessageInput = Omit<StatusMessage, "id" | "timestamp">;

const STYLE_ELEMENT_ID = "connection-status-display-style";

export const ConnectionStatusDisplay: React.FC<ConnectionStatusProps> = ({
  connectionState,
  isHealthy,
  isInGracePeriod,
  reconnectionAttempts,
  onRetry,
  onReturnToLobby,
  onClearErrors,
}) => {
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Add message to display
  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const filtered = prev.filter((msg) => msg.id !== id);
      if (filtered.length === 0) {
        setIsVisible(false);
      }
      return filtered;
    });
  }, []);

  const addMessage = useCallback((message: StatusMessageInput) => {
    const newMessage: StatusMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev.slice(-4), newMessage]); // Keep only last 5 messages
    setIsVisible(true);

    // Auto-hide success and info messages
    if (
      message.autoHide !== false &&
      (message.type === "success" || message.type === "info")
    ) {
      setTimeout(() => {
        removeMessage(newMessage.id);
      }, 5000);
    }
  }, [removeMessage]);

  // Remove message
  const clearAllMessages = useCallback(() => {
    setMessages([]);
    setIsVisible(false);
    onClearErrors?.();
  }, [onClearErrors]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (document.getElementById(STYLE_ELEMENT_ID)) {
      return;
    }

    const styleSheet = document.createElement("style");
    styleSheet.id = STYLE_ELEMENT_ID;
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }, []);

  // Update status based on connection state
  useEffect(() => {
    if (connectionState === ConnectionState.DISCONNECTED && !isHealthy) {
      addMessage({
        message: "Connection lost. Please check your internet connection.",
        type: "error",
        autoHide: false,
        action: onRetry
          ? {
              label: "Retry",
              onClick: onRetry,
            }
          : undefined,
      });
    } else if (isInGracePeriod) {
      addMessage({
        message: `Reconnecting... (attempt ${reconnectionAttempts}/3)`,
        type: "warning",
        autoHide: false,
      });
    } else if (connectionState === ConnectionState.IN_ROOM && isHealthy) {
      addMessage({
        message: "Connected successfully",
        type: "success",
        autoHide: true,
      });
    }
  }, [
    connectionState,
    isHealthy,
    isInGracePeriod,
    reconnectionAttempts,
    onRetry,
    addMessage,
  ]);

  // Expose addMessage function globally for error recovery service
  useEffect(() => {
    (window as any).addConnectionStatusMessage = addMessage;
    return () => {
      delete (window as any).addConnectionStatusMessage;
    };
  }, [addMessage]);

  if (!isVisible || messages.length === 0) {
    return null;
  }

  const getStatusIcon = (type: StatusMessage["type"]) => {
    switch (type) {
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      case "success":
        return "✅";
      default:
        return "ℹ️";
    }
  };

  const getStatusColor = (type: StatusMessage["type"]) => {
    switch (type) {
      case "error":
        return "bg-red-100 border-red-400 text-red-700";
      case "warning":
        return "bg-yellow-100 border-yellow-400 text-yellow-700";
      case "info":
        return "bg-blue-100 border-blue-400 text-blue-700";
      case "success":
        return "bg-green-100 border-green-400 text-green-700";
      default:
        return "bg-gray-100 border-gray-400 text-gray-700";
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
            <div className="flex-shrink-0">
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
            <div className="ml-3 flex-shrink-0">
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
            onClick={clearAllMessages}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Connection actions */}
      {(connectionState === ConnectionState.DISCONNECTED || !isHealthy) && (
        <div className="bg-white border border-gray-300 rounded-md p-3 shadow-lg">
          <div className="text-sm text-gray-600 mb-2">Connection Options:</div>
          <div className="space-x-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors"
              >
                Retry Connection
              </button>
            )}
            {onReturnToLobby && (
              <button
                onClick={onReturnToLobby}
                className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
              >
                Return to Lobby
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
// CSS for animations (add to your global CSS)
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
