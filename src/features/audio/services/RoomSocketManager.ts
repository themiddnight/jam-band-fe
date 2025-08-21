import { ConnectionState } from "../types/connectionState";
import type {
  ConnectionConfig,
  ApprovalRequest,
} from "../types/connectionState";
import {
  ErrorRecoveryService,
  ErrorType,
  RecoveryAction,
  type ErrorContext,
} from "./ErrorRecoveryService";
import { SessionStorageManager } from "./SessionStorageManager";
import { io, Socket } from "socket.io-client";

/**
 * Manages socket connections for the room isolation architecture
 * Replaces the complex connection pool with simple namespace-based connections
 */
export class RoomSocketManager {
  private lobbySocket: Socket | null = null;
  private roomSocket: Socket | null = null;
  private approvalSocket: Socket | null = null;
  private currentState: ConnectionState = ConnectionState.DISCONNECTED;
  private currentConfig: ConnectionConfig | null = null;

  // Event handlers
  private stateChangeHandlers: Array<
    (state: ConnectionState, config: ConnectionConfig | null) => void
  > = [];
  private errorHandlers: Array<(error: string) => void> = [];
  private reconnectionHandlers: Array<() => void> = [];

  // Approval state
  private currentApprovalRequest: ApprovalRequest | null = null;
  private approvalTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Grace period and reconnection management
  private gracePeriodTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly GRACE_PERIOD_MS = 30000; // 30 seconds
  private isInGracePeriod = false;
  private reconnectionAttempts = 0;
  private readonly MAX_RECONNECTION_ATTEMPTS = 3;

  // Error recovery service
  private errorRecoveryService: ErrorRecoveryService;
  private connectionHealthCheckInterval: ReturnType<typeof setInterval> | null =
    null;
  private readonly CONNECTION_HEALTH_CHECK_INTERVAL = 10000; // 10 seconds

  constructor(private backendUrl: string) {
    // Initialize error recovery service
    this.errorRecoveryService = new ErrorRecoveryService({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      exponentialBackoff: true,
      enableUserFeedback: true,
      enableAutoRecovery: true,
    });

    // Set up error recovery handlers
    this.setupErrorRecoveryHandlers();

    // Start connection health monitoring
    this.startConnectionHealthMonitoring();
  }

  /**
   * Get current connection state
   */
  getCurrentState(): ConnectionState {
    return this.currentState;
  }

  /**
   * Get current connection configuration
   */
  getCurrentConfig(): ConnectionConfig | null {
    return this.currentConfig;
  }

  /**
   * Get the active socket for the current state
   */
  getActiveSocket(): Socket | null {
    switch (this.currentState) {
      case ConnectionState.LOBBY:
        return this.lobbySocket;
      case ConnectionState.REQUESTING:
        return this.approvalSocket;
      case ConnectionState.IN_ROOM:
        return this.roomSocket;
      default:
        return null;
    }
  }

  /**
   * Connect to lobby monitoring namespace
   */
  async connectToLobby(): Promise<void> {
    await this.transitionTo(ConnectionState.LOBBY, {
      state: ConnectionState.LOBBY,
      namespace: "/lobby-monitor",
    });
  }

  /**
   * Connect to room approval namespace for private rooms
   */
  async connectToApproval(
    roomId: string,
    userId: string,
    username: string,
    role: "band_member" | "audience",
  ): Promise<void> {
    const approvalRequest: ApprovalRequest = {
      roomId,
      userId,
      username,
      role,
      timestamp: Date.now(),
    };

    this.currentApprovalRequest = approvalRequest;

    await this.transitionTo(ConnectionState.REQUESTING, {
      state: ConnectionState.REQUESTING,
      namespace: `/approval/${roomId}`,
      roomId,
      role,
    });

    // Emit the approval request on the approval namespace
    if (this.approvalSocket) {
      const emitRequest = () => {
        this.approvalSocket!.emit("request_approval", approvalRequest);
      };
      if (this.approvalSocket.connected) {
        emitRequest();
      } else {
        this.approvalSocket.once("connect", emitRequest);
      }
    }

    // Set approval timeout (30 seconds)
    this.approvalTimeoutId = setTimeout(() => {
      this.handleApprovalTimeout();
    }, 30000);
  }

  /**
   * Connect to room namespace
   * Requirements: 6.6 - Session data storage for room reconnection after page refresh
   */
  async connectToRoom(
    roomId: string,
    role: "band_member" | "audience",
    userId?: string,
    username?: string,
  ): Promise<void> {
    // Store session data for reconnection
    if (userId && username) {
      SessionStorageManager.storeRoomSession({
        roomId,
        role,
        userId,
        username,
      });
    }

    await this.transitionTo(ConnectionState.IN_ROOM, {
      state: ConnectionState.IN_ROOM,
      namespace: `/room/${roomId}`,
      roomId,
      role,
    });
  }

  /**
   * Cancel approval request and return to lobby
   */
  async cancelApprovalRequest(): Promise<void> {
    if (this.currentState !== ConnectionState.REQUESTING) {
      return;
    }

    // Clear approval timeout
    if (this.approvalTimeoutId) {
      clearTimeout(this.approvalTimeoutId);
      this.approvalTimeoutId = null;
    }

    // Emit cancellation event if socket is connected
    if (this.approvalSocket?.connected && this.currentApprovalRequest) {
      this.approvalSocket.emit("cancel_approval_request", {
        userId: this.currentApprovalRequest.userId,
        roomId: this.currentApprovalRequest.roomId,
      });
    }

    // Clear approval request
    this.currentApprovalRequest = null;

    // Return to lobby
    await this.connectToLobby();
  }

  /**
   * Leave current room and return to lobby
   */
  async leaveRoom(): Promise<void> {
    if (
      this.currentState === ConnectionState.IN_ROOM &&
      this.roomSocket?.connected
    ) {
      this.roomSocket.emit("leave_room", { isIntendedLeave: true });
    }

    // Clear session data when intentionally leaving
    SessionStorageManager.clearRoomSession();

    await this.connectToLobby();
  }

  /**
   * Disconnect all connections
   */
  async disconnect(): Promise<void> {
    // Clear session data when disconnecting
    SessionStorageManager.clearRoomSession();
    await this.transitionTo(ConnectionState.DISCONNECTED, null);
  }

  /**
   * Add state change handler
   */
  onStateChange(
    handler: (state: ConnectionState, config: ConnectionConfig | null) => void,
  ): () => void {
    this.stateChangeHandlers.push(handler);
    return () => {
      const index = this.stateChangeHandlers.indexOf(handler);
      if (index > -1) {
        this.stateChangeHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Add error handler
   */
  onError(handler: (error: string) => void): () => void {
    this.errorHandlers.push(handler);
    return () => {
      const index = this.errorHandlers.indexOf(handler);
      if (index > -1) {
        this.errorHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Add reconnection handler
   * Requirements: 5.7 - WebRTC mesh restoration after page refresh or reconnection
   */
  onReconnection(handler: () => void): () => void {
    this.reconnectionHandlers.push(handler);
    return () => {
      const index = this.reconnectionHandlers.indexOf(handler);
      if (index > -1) {
        this.reconnectionHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Check if currently in grace period
   * Requirements: 5.6 - 30-second grace period for accidental disconnects
   */
  isInGracePeriodState(): boolean {
    return this.isInGracePeriod;
  }

  /**
   * Check if there's a stored session for automatic reconnection
   * Requirements: 6.6 - Automatic reconnection to correct room namespace after accidental disconnect
   */
  hasStoredSession(): boolean {
    return SessionStorageManager.hasValidSession();
  }

  /**
   * Get stored session data for reconnection
   * Requirements: 6.6, 6.7 - Session data storage and state restoration after reconnection
   */
  getStoredSession(): {
    roomId: string;
    role: "band_member" | "audience";
  } | null {
    const session = SessionStorageManager.getRoomSession();
    if (!session) {
      return null;
    }

    return {
      roomId: session.roomId,
      role: session.role,
    };
  }

  /**
   * Attempt automatic reconnection using stored session data
   * Requirements: 6.6 - Automatic reconnection to correct room namespace after accidental disconnect
   */
  async attemptStoredSessionReconnection(): Promise<boolean> {
    const session = SessionStorageManager.getRoomSession();
    if (!session) {
      return false;
    }

    try {
      console.log("🔄 Attempting reconnection using stored session:", {
        roomId: session.roomId,
        role: session.role,
      });
      await this.connectToRoom(
        session.roomId,
        session.role,
        session.userId,
        session.username,
      );
      return true;
    } catch (error) {
      console.error("❌ Failed to reconnect using stored session:", error);
      SessionStorageManager.clearRoomSession();
      return false;
    }
  }

  /**
   * Store instrument state for restoration after reconnection
   * Requirements: 6.7 - State restoration (user role, instrument, settings) after reconnection
   */
  storeInstrumentState(
    instrument: string,
    category: string,
    synthParams?: any,
  ): void {
    SessionStorageManager.storeInstrumentState(
      instrument,
      category,
      synthParams,
    );
  }

  /**
   * Get stored instrument state for restoration
   * Requirements: 6.7 - State restoration (user role, instrument, settings) after reconnection
   */
  getStoredInstrumentState(): {
    instrument?: string;
    category?: string;
    synthParams?: any;
  } | null {
    return SessionStorageManager.getStoredInstrumentState();
  }

  /**
   * Set up error recovery handlers
   * Requirements: 6.10 - Automatic state recovery for inconsistent connection states
   */
  private setupErrorRecoveryHandlers(): void {
    // Handle recovery actions
    this.errorRecoveryService.onRecovery(({ action, context }) => {
      this.handleRecoveryAction(action, context);
    });

    // Handle user feedback
    this.errorRecoveryService.onUserFeedback((message, type) => {
      this.notifyError(`${type.toUpperCase()}: ${message}`);
    });
  }

  /**
   * Handle recovery actions from error recovery service
   * Requirements: 6.10 - Automatic state recovery for inconsistent connection states
   */
  private async handleRecoveryAction(
    action: RecoveryAction,
    context: ErrorContext,
  ): Promise<void> {
    console.log(
      "🔧 RoomSocketManager: Executing recovery action",
      action,
      "for",
      context.errorType,
    );

    try {
      switch (action) {
        case RecoveryAction.RETRY_CONNECTION:
          if (this.currentConfig) {
            await this.retryCurrentConnection();
          } else {
            console.log(
              "⚠️ Cannot retry connection - no current configuration",
            );
            // Fall back to lobby if no config
            await this.connectToLobby();
          }
          break;

        case RecoveryAction.FALLBACK_TO_HTTP:
          await this.fallbackToHttpMode();
          break;

        case RecoveryAction.FORCE_RECONNECTION:
          await this.forceReconnection();
          break;

        case RecoveryAction.CLEAR_STATE:
          await this.clearStateAndReconnect();
          break;

        case RecoveryAction.RETURN_TO_LOBBY:
          await this.returnToLobby();
          break;

        case RecoveryAction.RELOAD_PAGE:
          this.reloadPage();
          break;

        case RecoveryAction.NO_ACTION:
          // Do nothing, just log
          console.log("🔧 RoomSocketManager: No recovery action needed");
          break;

        default:
          console.warn("🔧 RoomSocketManager: Unknown recovery action", action);
      }
    } catch (error) {
      console.error(
        "❌ RoomSocketManager: Recovery action failed",
        action,
        error,
      );

      // If recovery fails, try returning to lobby as last resort
      if (action !== RecoveryAction.RETURN_TO_LOBBY) {
        await this.returnToLobby();
      }
    }
  }

  /**
   * Retry current connection
   */
  private async retryCurrentConnection(): Promise<void> {
    if (!this.currentConfig) {
      throw new Error("No current configuration to retry");
    }

    console.log("🔄 RoomSocketManager: Retrying current connection");

    // Clean up current connections
    await this.cleanupCurrentConnections();

    // Re-establish connection with current config
    await this.establishConnection(this.currentConfig);
  }

  /**
   * Fallback to HTTP mode (disable real-time features)
   */
  private async fallbackToHttpMode(): Promise<void> {
    console.log("🔄 RoomSocketManager: Falling back to HTTP mode");

    // Disconnect all socket connections
    await this.cleanupCurrentConnections();

    // Set state to disconnected but keep config for potential retry
    this.currentState = ConnectionState.DISCONNECTED;

    // Notify handlers about fallback mode
    this.notifyError(
      "Connection failed. Some real-time features may be unavailable.",
    );
    this.notifyStateChange();
  }

  /**
   * Force reconnection with state cleanup
   */
  private async forceReconnection(): Promise<void> {
    console.log("🔄 RoomSocketManager: Force reconnecting");

    // Clear error recovery state
    this.errorRecoveryService.clearRecoveryState();

    // Reset reconnection attempts
    this.reconnectionAttempts = 0;
    this.isInGracePeriod = false;

    // Try to reconnect using stored session if available
    const success = await this.attemptStoredSessionReconnection();

    if (!success) {
      // If stored session reconnection fails, return to lobby
      await this.returnToLobby();
    }
  }

  /**
   * Clear state and reconnect
   */
  private async clearStateAndReconnect(): Promise<void> {
    console.log("🔄 RoomSocketManager: Clearing state and reconnecting");

    // Clear all state
    SessionStorageManager.clearRoomSession();
    this.errorRecoveryService.clearAllRetryCounts();

    // Return to lobby
    await this.connectToLobby();
  }

  /**
   * Return to lobby
   */
  private async returnToLobby(): Promise<void> {
    console.log("🔄 RoomSocketManager: Returning to lobby");

    // Clear session data
    SessionStorageManager.clearRoomSession();

    // Connect to lobby
    await this.connectToLobby();
  }

  /**
   * Reload page as last resort
   */
  private reloadPage(): void {
    console.log("🔄 RoomSocketManager: Reloading page");
    window.location.reload();
  }

  /**
   * Start connection health monitoring
   * Requirements: 6.10 - Connection health monitoring and automatic recovery
   */
  private startConnectionHealthMonitoring(): void {
    if (this.connectionHealthCheckInterval) {
      return;
    }

    this.connectionHealthCheckInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, this.CONNECTION_HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop connection health monitoring
   */
  private stopConnectionHealthMonitoring(): void {
    if (this.connectionHealthCheckInterval) {
      clearInterval(this.connectionHealthCheckInterval);
      this.connectionHealthCheckInterval = null;
    }
  }

  /**
   * Check connection health and detect inconsistencies
   * Requirements: 6.10 - Automatic state recovery for inconsistent connection states
   */
  private checkConnectionHealth(): void {
    const activeSocket = this.getActiveSocket();

    // Check for state inconsistencies
    if (
      this.currentState !== ConnectionState.DISCONNECTED &&
      (!activeSocket || !activeSocket.connected)
    ) {
      console.warn("⚠️ RoomSocketManager: State inconsistency detected", {
        currentState: this.currentState,
        hasSocket: !!activeSocket,
        socketConnected: activeSocket?.connected,
      });

      this.errorRecoveryService.handleError({
        errorType: ErrorType.STATE_INCONSISTENCY,
        message: "Connection state inconsistent with socket state",
        connectionState: this.currentState,
        timestamp: Date.now(),
        additionalData: {
          hasSocket: !!activeSocket,
          socketConnected: activeSocket?.connected,
        },
      });
    }

    // Check for stuck grace period
    if (
      this.isInGracePeriod &&
      Date.now() - (this.gracePeriodStartTime || 0) >
        this.GRACE_PERIOD_MS + 5000
    ) {
      console.warn("⚠️ RoomSocketManager: Grace period stuck, forcing cleanup");

      this.errorRecoveryService.handleError({
        errorType: ErrorType.GRACE_PERIOD_EXPIRED,
        message: "Grace period exceeded maximum duration",
        connectionState: this.currentState,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Track grace period start time for health monitoring
   */
  private gracePeriodStartTime: number | null = null;

  /**
   * Transition to a new connection state
   */
  private async transitionTo(
    newState: ConnectionState,
    config: ConnectionConfig | null,
  ): Promise<void> {
    // Clean up current connections
    await this.cleanupCurrentConnections();

    // Update state
    this.currentState = newState;
    this.currentConfig = config;

    // Establish new connection if needed
    if (config && config.namespace) {
      await this.establishConnection(config);
    }

    // Notify handlers
    this.notifyStateChange();
  }

  /**
   * Clean up all current connections
   */
  private async cleanupCurrentConnections(): Promise<void> {
    // Clear approval timeout
    if (this.approvalTimeoutId) {
      clearTimeout(this.approvalTimeoutId);
      this.approvalTimeoutId = null;
    }

    // Clear grace period timeout
    if (this.gracePeriodTimeoutId) {
      clearTimeout(this.gracePeriodTimeoutId);
      this.gracePeriodTimeoutId = null;
    }

    // Reset grace period state
    this.isInGracePeriod = false;
    this.gracePeriodStartTime = null;
    this.reconnectionAttempts = 0;

    // Stop connection health monitoring during cleanup
    this.stopConnectionHealthMonitoring();

    // Disconnect and clean up sockets
    if (this.lobbySocket) {
      this.lobbySocket.removeAllListeners();
      this.lobbySocket.disconnect();
      this.lobbySocket = null;
    }

    if (this.roomSocket) {
      this.roomSocket.removeAllListeners();
      this.roomSocket.disconnect();
      this.roomSocket = null;
    }

    if (this.approvalSocket) {
      this.approvalSocket.removeAllListeners();
      this.approvalSocket.disconnect();
      this.approvalSocket = null;
    }

    // Restart connection health monitoring if we're not fully disconnecting
    if (this.currentState !== ConnectionState.DISCONNECTED) {
      this.startConnectionHealthMonitoring();
    }
  }

  /**
   * Establish connection for the given configuration with comprehensive error handling
   * Requirements: 6.10 - Comprehensive error handling for namespace connection failures
   */
  private async establishConnection(config: ConnectionConfig): Promise<void> {
    console.log(
      "🔌 RoomSocketManager: Establishing connection to",
      config.namespace,
    );

    try {
      const socket = io(`${this.backendUrl}${config.namespace}`, {
        transports: ["websocket", "polling"],
        timeout: 20000,
        forceNew: true,
        reconnection: false, // We handle reconnection manually
      });

      // Set up common event handlers
      this.setupCommonEventHandlers(socket);

      // Set up state-specific event handlers
      switch (config.state) {
        case ConnectionState.LOBBY:
          this.lobbySocket = socket;
          this.setupLobbyEventHandlers(socket);
          break;
        case ConnectionState.REQUESTING:
          this.approvalSocket = socket;
          this.setupApprovalEventHandlers(socket, config);
          break;
        case ConnectionState.IN_ROOM:
          this.roomSocket = socket;
          this.setupRoomEventHandlers(socket, config);
          break;
      }

      // Wait for connection with enhanced error handling
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          const error = new Error(`Connection timeout to ${config.namespace}`);
          reject(error);
        }, 10000); // Reduced timeout to fail faster

        socket.on("connect", () => {
          clearTimeout(timeout);
          console.log("✅ RoomSocketManager: Connected to", config.namespace);

          // Clear any previous error recovery state for successful connection
          this.errorRecoveryService.clearRetryCount({
            errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
            roomId: config.roomId,
          });

          resolve();
        });

        socket.on("connect_error", (error) => {
          clearTimeout(timeout);
          console.error(
            "❌ RoomSocketManager: Connection error to",
            config.namespace,
            error,
          );

          // Handle specific connection errors
          this.handleConnectionError(error, config);
          reject(error);
        });

        // Handle transport errors
        socket.on("disconnect", (reason) => {
          if (reason === "transport error" || reason === "transport close") {
            console.warn(
              "⚠️ RoomSocketManager: Transport error during connection",
              reason,
            );
            this.handleTransportError(reason, config);
          }
        });
      });
    } catch (error) {
      console.error(
        "❌ RoomSocketManager: Failed to establish connection",
        error,
      );

      // Report error to recovery service
      await this.errorRecoveryService.handleError({
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        message: `Failed to connect to ${config.namespace}: ${error instanceof Error ? error.message : "Unknown error"}`,
        originalError:
          error instanceof Error ? error : new Error(String(error)),
        connectionState: config.state,
        roomId: config.roomId,
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Handle connection errors with specific error types
   * Requirements: 6.10 - Comprehensive error handling for namespace connection failures
   */
  private handleConnectionError(error: any, config: ConnectionConfig): void {
    let errorType = ErrorType.NAMESPACE_CONNECTION_FAILED;
    let message = `Connection failed to ${config.namespace}`;

    // Classify error types
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      errorType = ErrorType.NETWORK_ERROR;
      message =
        "Network connection failed. Please check your internet connection.";
    } else if (error.message?.includes("timeout")) {
      errorType = ErrorType.NETWORK_ERROR;
      message = "Connection timed out. Please check your network connection.";
    } else if (
      error.message?.includes("permission") ||
      error.message?.includes("forbidden")
    ) {
      errorType = ErrorType.PERMISSION_DENIED;
      message = "Permission denied. Please refresh the page and try again.";
    }

    this.errorRecoveryService.handleError({
      errorType,
      message,
      originalError: error,
      connectionState: config.state,
      roomId: config.roomId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle transport errors
   */
  private handleTransportError(reason: string, config: ConnectionConfig): void {
    this.errorRecoveryService.handleError({
      errorType: ErrorType.NETWORK_ERROR,
      message: `Transport error: ${reason}`,
      connectionState: config.state,
      roomId: config.roomId,
      timestamp: Date.now(),
      additionalData: { transportError: reason },
    });
  }

  /**
   * Set up common event handlers for all sockets with enhanced error handling
   * Requirements: 6.10 - Comprehensive error handling for namespace connection failures
   */
  private setupCommonEventHandlers(socket: Socket): void {
    socket.on("disconnect", (reason) => {
      console.log("🔌 RoomSocketManager: Socket disconnected", reason);

      // Handle different disconnect reasons
      if (
        reason === "io server disconnect" ||
        reason === "io client disconnect"
      ) {
        // Intentional disconnect, don't trigger recovery
        console.log(
          "🔌 RoomSocketManager: Intentional disconnect, no recovery needed",
        );
      } else {
        // Unexpected disconnection, handle with recovery
        this.handleUnexpectedDisconnection(reason);
      }
    });

    socket.on("connect_error", (error) => {
      console.error("❌ RoomSocketManager: Connect error", error);

      this.errorRecoveryService.handleError({
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        message: `Connection error: ${error.message}`,
        originalError: error,
        connectionState: this.currentState,
        roomId: this.currentConfig?.roomId,
        timestamp: Date.now(),
      });
    });

    socket.on(
      "error",
      (data: {
        message: string;
        code?: string;
        retryAfter?: number;
        details?: unknown;
      }) => {
        console.error("\u274c RoomSocketManager: Socket error", data);

        // Handle validation errors from server (e.g., Joi via secureSocketEvent)
        if (
          typeof data?.message === "string" &&
          data.message.includes("Invalid data format")
        ) {
          // Do NOT attempt auto-recovery/reconnect on validation errors to avoid loops
          const details =
            typeof data.details === "string"
              ? data.details
              : JSON.stringify(data.details || {});
          console.error("Validation details:", details);
          this.notifyError(
            `Invalid data sent to server${details ? `: ${details}` : ""}`,
          );

          // If we are in a room, return to lobby to stop further invalid emissions (e.g., periodic heartbeats)
          if (this.currentState === ConnectionState.IN_ROOM) {
            // Clear session and navigate back to lobby state
            this.returnToLobby();
          }
          return;
        }

        // Classify other error types based on message or code
        let errorType = ErrorType.UNKNOWN_ERROR;
        if (
          data.code === "RATE_LIMITED" ||
          data.message?.includes("rate limit")
        ) {
          // Don't trigger recovery for rate limiting, just notify user
          this.notifyError(
            `Rate limited: ${data.message}${data.retryAfter ? ` Try again in ${data.retryAfter} seconds.` : ""}`,
          );
          return;
        } else if (
          data.message?.includes("permission") ||
          data.message?.includes("unauthorized")
        ) {
          errorType = ErrorType.PERMISSION_DENIED;
        } else if (
          data.message?.includes("network") ||
          data.message?.includes("connection")
        ) {
          errorType = ErrorType.NETWORK_ERROR;
        }

        this.errorRecoveryService.handleError({
          errorType,
          message: data.message,
          connectionState: this.currentState,
          roomId: this.currentConfig?.roomId,
          timestamp: Date.now(),
          additionalData: { code: data.code, retryAfter: data.retryAfter },
        });
      },
    );

    // Handle reconnection events
    socket.on("reconnect", (attemptNumber) => {
      console.log(
        "✅ RoomSocketManager: Socket reconnected after",
        attemptNumber,
        "attempts",
      );

      // Clear error recovery state on successful reconnection
      this.errorRecoveryService.clearRetryCount({
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        roomId: this.currentConfig?.roomId,
      });

      // Notify reconnection handlers
      this.notifyReconnection();
    });

    socket.on("reconnect_error", (error) => {
      console.error("❌ RoomSocketManager: Reconnect error", error);

      this.errorRecoveryService.handleError({
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        message: `Reconnection failed: ${error.message}`,
        originalError: error,
        connectionState: this.currentState,
        roomId: this.currentConfig?.roomId,
        timestamp: Date.now(),
      });
    });

    socket.on("reconnect_failed", () => {
      console.error("❌ RoomSocketManager: Reconnection failed permanently");

      this.errorRecoveryService.handleError({
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        message: "Failed to reconnect after multiple attempts",
        connectionState: this.currentState,
        roomId: this.currentConfig?.roomId,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Set up lobby-specific event handlers
   */
  private setupLobbyEventHandlers(socket: Socket): void {
    // Reference socket to satisfy no-unused-vars without disabling linting
    void socket;
    // Lobby handles ping/pong for latency measurement
    // The ping_response event is automatically handled by the usePingMeasurement hook
    // when it attaches its own listeners to the socket, so we don't need to handle it here
  }

  /**
   * Set up approval-specific event handlers
   */
  private setupApprovalEventHandlers(
    socket: Socket,
    config: ConnectionConfig,
  ): void {
    socket.on("approval_granted", async () => {
      // Clear approval timeout
      if (this.approvalTimeoutId) {
        clearTimeout(this.approvalTimeoutId);
        this.approvalTimeoutId = null;
      }

      // Clear approval request
      this.currentApprovalRequest = null;

      // Transition to room
      if (config.roomId && config.role) {
        await this.connectToRoom(config.roomId, config.role);
      }
    });

    // Support legacy event name used by owner actions
    socket.on("member_approved", async () => {
      if (this.approvalTimeoutId) {
        clearTimeout(this.approvalTimeoutId);
        this.approvalTimeoutId = null;
      }
      this.currentApprovalRequest = null;
      if (config.roomId && config.role) {
        await this.connectToRoom(config.roomId, config.role);
      }
    });

    socket.on("approval_denied", async (data: { message: string }) => {
      // Clear approval timeout
      if (this.approvalTimeoutId) {
        clearTimeout(this.approvalTimeoutId);
        this.approvalTimeoutId = null;
      }

      // Clear approval request
      this.currentApprovalRequest = null;

      // Notify error and return to lobby
      this.notifyError(data.message);
      await this.connectToLobby();
    });

    // Support legacy event name used by owner actions
    socket.on("member_rejected", async (data: { message: string }) => {
      if (this.approvalTimeoutId) {
        clearTimeout(this.approvalTimeoutId);
        this.approvalTimeoutId = null;
      }
      this.currentApprovalRequest = null;
      this.notifyError(data.message || "Your request was rejected");
      await this.connectToLobby();
    });

    socket.on("approval_timeout", async () => {
      await this.handleApprovalTimeout();
    });

    // Optional: informational only
    socket.on("approval_pending", () => {
      // No-op: UI already reflects REQUESTING state
    });
  }

  /**
   * Set up room-specific event handlers
   */
  private setupRoomEventHandlers(
    socket: Socket,
    config: ConnectionConfig,
  ): void {
    // Reference params to satisfy no-unused-vars without disabling linting
    void socket;
    void config;
    // Room event handlers will be set up by the useSocket hook
    // The join_room emission should be handled by the calling code after connection is established
  }

  /**
   * Handle approval timeout
   */
  private async handleApprovalTimeout(): Promise<void> {
    if (this.approvalTimeoutId) {
      clearTimeout(this.approvalTimeoutId);
      this.approvalTimeoutId = null;
    }

    this.currentApprovalRequest = null;
    this.notifyError("Approval request timed out");
    await this.connectToLobby();
  }

  /**
   * Handle unexpected disconnections with grace period and enhanced error handling
   * Requirements: 5.6 - 30-second grace period for accidental disconnects
   * Requirements: 6.10 - Automatic state recovery for inconsistent connection states
   */
  private handleUnexpectedDisconnection(reason?: string): void {
    console.log(
      "🔄 RoomSocketManager: Unexpected disconnection detected",
      reason,
    );

    if (
      this.currentState === ConnectionState.IN_ROOM &&
      !this.isInGracePeriod
    ) {
      console.log("🔄 Entering grace period for room connection");

      this.isInGracePeriod = true;
      this.gracePeriodStartTime = Date.now();

      // Set grace period timeout
      this.gracePeriodTimeoutId = setTimeout(() => {
        console.log("⏰ Grace period expired");
        this.isInGracePeriod = false;
        this.gracePeriodStartTime = null;
        this.reconnectionAttempts = 0;

        // Report grace period expiration to error recovery service
        this.errorRecoveryService.handleError({
          errorType: ErrorType.GRACE_PERIOD_EXPIRED,
          message: "Grace period expired without successful reconnection",
          connectionState: this.currentState,
          roomId: this.currentConfig?.roomId,
          timestamp: Date.now(),
          additionalData: { disconnectReason: reason },
        });
      }, this.GRACE_PERIOD_MS);

      // Attempt reconnection
      this.attemptReconnection();
    } else if (this.currentState === ConnectionState.REQUESTING) {
      // Handle approval disconnection
      console.log("🔄 Approval connection lost");

      this.errorRecoveryService.handleError({
        errorType: ErrorType.APPROVAL_TIMEOUT,
        message: "Lost connection during approval process",
        connectionState: this.currentState,
        roomId: this.currentConfig?.roomId,
        timestamp: Date.now(),
        additionalData: { disconnectReason: reason },
      });
    } else {
      // Handle other disconnections
      console.log("🔄 Connection lost in state", this.currentState);

      this.errorRecoveryService.handleError({
        errorType: ErrorType.NAMESPACE_CONNECTION_FAILED,
        message: `Connection lost in ${this.currentState} state`,
        connectionState: this.currentState,
        roomId: this.currentConfig?.roomId,
        timestamp: Date.now(),
        additionalData: { disconnectReason: reason },
      });
    }
  }

  /**
   * Attempt reconnection during grace period
   * Requirements: 5.7 - WebRTC mesh restoration after page refresh or reconnection
   */
  private async attemptReconnection(): Promise<void> {
    if (!this.isInGracePeriod || !this.currentConfig) {
      return;
    }

    this.reconnectionAttempts++;

    if (this.reconnectionAttempts > this.MAX_RECONNECTION_ATTEMPTS) {
      console.log("❌ Max reconnection attempts reached");
      return;
    }

    console.log(
      `🔄 Attempting reconnection ${this.reconnectionAttempts}/${this.MAX_RECONNECTION_ATTEMPTS}`,
    );

    try {
      // Re-establish connection with current config
      await this.establishConnection(this.currentConfig);

      // Clear grace period
      if (this.gracePeriodTimeoutId) {
        clearTimeout(this.gracePeriodTimeoutId);
        this.gracePeriodTimeoutId = null;
      }

      this.isInGracePeriod = false;
      this.reconnectionAttempts = 0;

      console.log("✅ Reconnection successful");

      // Notify reconnection handlers
      this.notifyReconnection();
    } catch (error) {
      console.warn(
        `⚠️ Reconnection attempt ${this.reconnectionAttempts} failed:`,
        error,
      );

      // Retry with exponential backoff
      const delay = Math.min(
        1000 * Math.pow(2, this.reconnectionAttempts - 1),
        10000,
      );
      setTimeout(() => {
        this.attemptReconnection();
      }, delay);
    }
  }

  /**
   * Notify reconnection handlers
   * Requirements: 5.7 - WebRTC mesh restoration after page refresh or reconnection
   */
  private notifyReconnection(): void {
    this.reconnectionHandlers.forEach((handler) => {
      try {
        handler();
      } catch (error) {
        console.error("Error in reconnection handler:", error);
      }
    });
  }

  /**
   * Notify state change handlers
   */
  private notifyStateChange(): void {
    this.stateChangeHandlers.forEach((handler) => {
      try {
        handler(this.currentState, this.currentConfig);
      } catch (error) {
        console.error("Error in state change handler:", error);
      }
    });
  }

  /**
   * Notify error handlers
   */
  private notifyError(error: string): void {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (err) {
        console.error("Error in error handler:", err);
      }
    });
  }

  /**
   * Get error recovery service for external access
   */
  getErrorRecoveryService(): ErrorRecoveryService {
    return this.errorRecoveryService;
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(): {
    isHealthy: boolean;
    currentState: ConnectionState;
    isInGracePeriod: boolean;
    reconnectionAttempts: number;
    errorStats: ReturnType<ErrorRecoveryService["getErrorStats"]>;
  } {
    const activeSocket = this.getActiveSocket();

    return {
      isHealthy:
        this.currentState !== ConnectionState.DISCONNECTED &&
        !!activeSocket &&
        activeSocket.connected &&
        !this.isInGracePeriod,
      currentState: this.currentState,
      isInGracePeriod: this.isInGracePeriod,
      reconnectionAttempts: this.reconnectionAttempts,
      errorStats: this.errorRecoveryService.getErrorStats(),
    };
  }

  /**
   * Force clear error recovery state (for manual intervention)
   */
  clearErrorRecoveryState(): void {
    this.errorRecoveryService.clearRecoveryState();
    this.reconnectionAttempts = 0;
    this.isInGracePeriod = false;
    this.gracePeriodStartTime = null;
  }

  /**
   * Complete cleanup of the service
   */
  async cleanup(): Promise<void> {
    console.log("🧹 RoomSocketManager: Complete cleanup");

    // Stop all monitoring
    this.stopConnectionHealthMonitoring();

    // Clean up connections
    await this.cleanupCurrentConnections();

    // Clean up error recovery service
    this.errorRecoveryService.cleanup();

    // Clear all state
    this.currentState = ConnectionState.DISCONNECTED;
    this.currentConfig = null;
    this.currentApprovalRequest = null;

    // Clear handlers
    this.stateChangeHandlers.length = 0;
    this.errorHandlers.length = 0;
    this.reconnectionHandlers.length = 0;

    console.log("✅ RoomSocketManager: Cleanup complete");
  }
}
