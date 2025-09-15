/**
 * Session Storage Manager for Room Reconnection
 * Requirements: 6.6, 6.7 - Session data storage and state restoration after reconnection
 */

export interface RoomSessionData {
  roomId: string;
  role: "band_member" | "audience";
  userId: string;
  username: string;
  instrument?: string;
  category?: string;
  synthParams?: any;
  timestamp: number;
}

export class SessionStorageManager {
  private static readonly SESSION_KEY = "jam-band-room-session";
  private static readonly SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Store room session data for reconnection
   * Requirements: 6.6 - Session data storage for room reconnection after page refresh
   */
  static storeRoomSession(data: Omit<RoomSessionData, "timestamp">): void {
    try {
      const sessionData: RoomSessionData = {
        ...data,
        timestamp: Date.now(),
      };

      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
      console.log("💾 Stored room session data:", {
        roomId: data.roomId,
        role: data.role,
      });
    } catch (error) {
      console.warn("⚠️ Failed to store room session data:", error);
    }
  }

  /**
   * Retrieve stored room session data
   * Requirements: 6.6 - Session data storage for room reconnection after page refresh
   */
  static getRoomSession(): RoomSessionData | null {
    try {
      const stored = sessionStorage.getItem(this.SESSION_KEY);
      if (!stored) {
        return null;
      }

      const sessionData: RoomSessionData = JSON.parse(stored);

      // Check if session has expired
      const now = Date.now();
      if (now - sessionData.timestamp > this.SESSION_EXPIRY_MS) {
        
        this.clearRoomSession();
        return null;
      }

      console.log("📖 Retrieved room session data:", {
        roomId: sessionData.roomId,
        role: sessionData.role,
      });
      return sessionData;
    } catch (error) {
      console.warn("⚠️ Failed to retrieve room session data:", error);
      this.clearRoomSession();
      return null;
    }
  }

  /**
   * Update specific fields in the stored session
   * Requirements: 6.7 - State restoration (user role, instrument, settings) after reconnection
   */
  static updateRoomSession(
    updates: Partial<Omit<RoomSessionData, "timestamp">>,
  ): void {
    try {
      const existing = this.getRoomSession();
      if (!existing) {
        console.warn("⚠️ No existing session to update");
        return;
      }

      const updated: RoomSessionData = {
        ...existing,
        ...updates,
        timestamp: Date.now(),
      };

      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(updated));
      
    } catch (error) {
      console.warn("⚠️ Failed to update room session data:", error);
    }
  }

  /**
   * Clear stored room session data
   */
  static clearRoomSession(): void {
    try {
      sessionStorage.removeItem(this.SESSION_KEY);
      
    } catch (error) {
      console.warn("⚠️ Failed to clear room session data:", error);
    }
  }

  /**
   * Check if there's a valid stored session for automatic reconnection
   * Requirements: 6.6 - Automatic reconnection to correct room namespace after accidental disconnect
   */
  static hasValidSession(): boolean {
    const session = this.getRoomSession();
    return session !== null;
  }

  /**
   * Get the room ID from stored session for reconnection
   */
  static getStoredRoomId(): string | null {
    const session = this.getRoomSession();
    return session?.roomId || null;
  }

  /**
   * Get the role from stored session for reconnection
   */
  static getStoredRole(): "band_member" | "audience" | null {
    const session = this.getRoomSession();
    return session?.role || null;
  }

  /**
   * Store instrument state for restoration
   * Requirements: 6.7 - State restoration (user role, instrument, settings) after reconnection
   */
  static storeInstrumentState(
    instrument: string,
    category: string,
    synthParams?: any,
  ): void {
    this.updateRoomSession({
      instrument,
      category,
      synthParams,
    });
  }

  /**
   * Get stored instrument state for restoration
   * Requirements: 6.7 - State restoration (user role, instrument, settings) after reconnection
   */
  static getStoredInstrumentState(): {
    instrument?: string;
    category?: string;
    synthParams?: any;
  } | null {
    const session = this.getRoomSession();
    if (!session) {
      return null;
    }

    return {
      instrument: session.instrument,
      category: session.category,
      synthParams: session.synthParams,
    };
  }

  /**
   * Check if current page load is likely a refresh (has stored session but no active connection)
   * Requirements: 6.6 - Automatic reconnection to correct room namespace after accidental disconnect
   */
  static isLikelyPageRefresh(): boolean {
    // If we have a valid session but no active socket connections, it's likely a page refresh
    return this.hasValidSession();
  }
}
