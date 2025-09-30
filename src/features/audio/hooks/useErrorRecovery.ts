import { useConnectionStatusDisplay } from "../components/ConnectionStatusDisplay/useConnectionStatusDisplay";
import { ErrorType, RecoveryAction } from "../services/ErrorRecoveryService";
import { RoomAudioManager } from "../services/RoomAudioManager";
import { RoomSocketManager } from "../services/RoomSocketManager";
import { useEffect, useRef, useCallback } from "react";

/**
 * Hook for comprehensive error recovery across all audio services
 * Requirements: 6.10, 10.6, 10.7 - Comprehensive error handling and recovery
 */

interface UseErrorRecoveryOptions {
  roomSocketManager?: RoomSocketManager;
  webRTCManager?: {
    peerConnections: Map<string, RTCPeerConnection>;
    connectionError: string | null;
    isConnecting: boolean;
  };
  roomAudioManager?: RoomAudioManager;
  onReturnToLobby?: () => void;
  onReloadPage?: () => void;
}

export const useErrorRecovery = (options: UseErrorRecoveryOptions) => {
  const {
    roomSocketManager,
    webRTCManager,
    roomAudioManager,
    onReturnToLobby,
    onReloadPage,
  } = options;

  const statusDisplay = useConnectionStatusDisplay();
  const cleanupFunctionsRef = useRef<Array<() => void>>([]);

  /**
   * Set up error recovery integration with all services
   */
  useEffect(() => {
    const cleanupFunctions: Array<() => void> = [];

    // Integrate with RoomSocketManager
    if (roomSocketManager) {
      const errorRecoveryService = roomSocketManager.getErrorRecoveryService();

      // Handle socket errors
      const unsubscribeSocketErrors = errorRecoveryService.onError((error) => {
        handleServiceError("Socket", error);
      });

      // Handle socket recovery
      const unsubscribeSocketRecovery = errorRecoveryService.onRecovery(
        ({ action }) => {
          handleServiceRecovery("Socket", action);
        },
      );

      cleanupFunctions.push(unsubscribeSocketErrors, unsubscribeSocketRecovery);
    }

    // Monitor WebRTC connection state if manager is provided
    if (webRTCManager) {
      // Monitor WebRTC connection errors
      const monitorWebRTCErrors = () => {
        if (webRTCManager.connectionError) {
          handleServiceError("WebRTC", {
            errorType: ErrorType.WEBRTC_CONNECTION_FAILED,
            message: webRTCManager.connectionError,
          });
        }
      };

      // Check for WebRTC errors periodically
      const webRTCErrorInterval = setInterval(monitorWebRTCErrors, 5000);
      cleanupFunctions.push(() => clearInterval(webRTCErrorInterval));
    }

    // Integrate with RoomAudioManager
    if (roomAudioManager) {
      const errorRecoveryService = roomAudioManager.getErrorRecoveryService();

      // Handle audio errors
      const unsubscribeAudioErrors = errorRecoveryService.onError((error) => {
        handleServiceError("Audio", error);
      });

      // Handle audio recovery
      const unsubscribeAudioRecovery = errorRecoveryService.onRecovery(
        ({ action }) => {
          handleServiceRecovery("Audio", action);
        },
      );

      cleanupFunctions.push(unsubscribeAudioErrors, unsubscribeAudioRecovery);
    }

    cleanupFunctionsRef.current = cleanupFunctions;

    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomSocketManager, webRTCManager, roomAudioManager]);

  /**
   * Handle errors from any service
   */
  const handleServiceError = useCallback(
    (serviceName: string, error: any) => {
      console.error(`🚨 ${serviceName} Error:`, error);

      // Determine user-friendly message based on error type
      let userMessage = error.message || "An unexpected error occurred";
      let showAction = false;
      let actionLabel = "";
      let actionHandler: (() => void) | undefined;

      switch (error.errorType) {
        case ErrorType.NAMESPACE_CONNECTION_FAILED:
          userMessage = "Connection failed. Retrying...";
          showAction = true;
          actionLabel = "Return to Lobby";
          actionHandler = onReturnToLobby;
          break;

        case ErrorType.WEBRTC_CONNECTION_FAILED:
          userMessage =
            "Voice connection failed. Music features still available.";
          break;

        case ErrorType.AUDIO_INITIALIZATION_FAILED:
          userMessage = "Audio system failed. Some features may be limited.";
          showAction = true;
          actionLabel = "Refresh Page";
          actionHandler = onReloadPage || (() => window.location.reload());
          break;

        case ErrorType.STATE_INCONSISTENCY:
          userMessage = "Connection state error. Attempting recovery...";
          break;

        case ErrorType.NETWORK_ERROR:
          userMessage =
            "Network connection issues. Please check your internet.";
          showAction = true;
          actionLabel = "Retry";
          actionHandler = () => {
            // Trigger retry through the appropriate service
            if (roomSocketManager) {
              roomSocketManager.clearErrorRecoveryState();
            }
          };
          break;

        case ErrorType.PERMISSION_DENIED:
          userMessage = "Permission denied. Please refresh and allow access.";
          showAction = true;
          actionLabel = "Refresh";
          actionHandler = () => window.location.reload();
          break;

        default:
          userMessage = `${serviceName}: ${userMessage}`;
      }

      // Show error to user
      statusDisplay.showError(
        userMessage,
        showAction && actionHandler
          ? {
              label: actionLabel,
              onClick: actionHandler,
            }
          : undefined,
      );
    },
    [statusDisplay, onReturnToLobby, onReloadPage, roomSocketManager],
  );

  /**
   * Handle recovery actions from any service
   */
  const handleServiceRecovery = useCallback(
    (serviceName: string, action: RecoveryAction) => {
      

      // Show recovery status to user
      let recoveryMessage = "";

      switch (action) {
        case RecoveryAction.RETRY_CONNECTION:
          recoveryMessage = `${serviceName}: Retrying connection...`;
          statusDisplay.showInfo(recoveryMessage);
          break;

        case RecoveryAction.FALLBACK_TO_HTTP:
          recoveryMessage = `${serviceName}: Switched to basic mode`;
          statusDisplay.showWarning(recoveryMessage);
          break;

        case RecoveryAction.FORCE_RECONNECTION:
          recoveryMessage = `${serviceName}: Reconnecting...`;
          statusDisplay.showInfo(recoveryMessage);
          break;

        case RecoveryAction.CLEAR_STATE:
          recoveryMessage = `${serviceName}: Clearing state and reconnecting...`;
          statusDisplay.showInfo(recoveryMessage);
          break;

        case RecoveryAction.RETURN_TO_LOBBY:
          recoveryMessage = "Returning to lobby...";
          statusDisplay.showWarning(recoveryMessage);
          setTimeout(() => {
            onReturnToLobby?.();
          }, 1000);
          break;

        case RecoveryAction.RELOAD_PAGE:
          recoveryMessage = "Reloading page...";
          statusDisplay.showWarning(recoveryMessage);
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          break;

        case RecoveryAction.NO_ACTION:
          // Don't show message for no action
          break;

        default:
          recoveryMessage = `${serviceName}: Attempting recovery...`;
          statusDisplay.showInfo(recoveryMessage);
      }
    },
    [statusDisplay, onReturnToLobby],
  );

  /**
   * Get overall system health status
   */
  const getSystemHealth = useCallback(() => {
    const socketHealth = roomSocketManager?.getConnectionHealth();
    const audioHealth = roomAudioManager?.getAudioHealth();

    const isHealthy =
      (socketHealth?.isHealthy ?? true) && (audioHealth?.isHealthy ?? true);

    const totalErrors =
      (socketHealth?.errorStats.totalErrors ?? 0) +
      (audioHealth?.errorStats.totalErrors ?? 0);

    return {
      isHealthy,
      totalErrors,
      socketHealth,
      audioHealth,
      hasActiveRecoveries:
        (socketHealth?.errorStats.activeRecoveries.length ?? 0) > 0 ||
        (audioHealth?.errorStats.activeRecoveries.length ?? 0) > 0,
    };
  }, [roomSocketManager, roomAudioManager]);

  /**
   * Force clear all error recovery states
   */
  const clearAllErrorStates = useCallback(() => {
    roomSocketManager?.clearErrorRecoveryState();
    roomAudioManager?.clearErrorRecoveryState();

    statusDisplay.showSuccess("Error states cleared");
  }, [roomSocketManager, roomAudioManager, statusDisplay]);

  /**
   * Manual retry for all services
   */
  const retryAllConnections = useCallback(async () => {
    statusDisplay.showInfo("Retrying all connections...");

    try {
      // Clear error states first
      clearAllErrorStates();

      // Attempt reconnection through socket manager
      if (roomSocketManager) {
        const storedSession = roomSocketManager.getStoredSession();
        if (storedSession) {
          await roomSocketManager.attemptStoredSessionReconnection();
        }
      }

      statusDisplay.showSuccess("Retry completed");
    } catch (error) {
      console.error("Manual retry failed:", error);
      statusDisplay.showError("Retry failed. Please refresh the page.");
    }
  }, [roomSocketManager, statusDisplay, clearAllErrorStates]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    cleanupFunctionsRef.current.forEach((cleanup) => cleanup());
    cleanupFunctionsRef.current = [];
  }, []);

  return {
    getSystemHealth,
    clearAllErrorStates,
    retryAllConnections,
    cleanup,
    statusDisplay,
  };
};
