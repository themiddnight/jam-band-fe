import { Socket } from 'socket.io-client';

/**
 * Utility to ensure socket is properly authenticated before WebRTC operations
 */
export class SocketAuthGuard {
  private static readonly MAX_WAIT_TIME = 5000; // 5 seconds max wait
  private static readonly CHECK_INTERVAL = 100; // Check every 100ms

  /**
   * Wait for socket to be connected and authenticated
   */
  static async waitForAuthentication(socket: Socket | null): Promise<boolean> {
    if (!socket) {
      console.warn('🔐 SocketAuthGuard: No socket provided');
      return false;
    }

    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkAuth = () => {
        const elapsed = Date.now() - startTime;
        
        // Check if socket is connected
        if (!socket.connected) {
          if (elapsed >= this.MAX_WAIT_TIME) {
            console.warn('🔐 SocketAuthGuard: Timeout waiting for socket connection');
            resolve(false);
            return;
          }
          setTimeout(checkAuth, this.CHECK_INTERVAL);
          return;
        }

        // Socket is connected, consider it authenticated
        
        resolve(true);
      };

      checkAuth();
    });
  }

  /**
   * Check if socket is ready for WebRTC operations
   */
  static isSocketReady(socket: Socket | null): boolean {
    return !!(socket && socket.connected);
  }

  /**
   * Execute a function only if socket is authenticated, with optional retry
   */
  static async executeWhenReady<T>(
    socket: Socket | null,
    operation: () => Promise<T> | T,
    maxRetries: number = 3
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const isReady = await this.waitForAuthentication(socket);
      
      if (isReady) {
        try {
          return await operation();
        } catch (error) {
          console.error(`🔐 SocketAuthGuard: Operation failed on attempt ${attempt}:`, error);
          if (attempt === maxRetries) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } else {
        console.warn(`🔐 SocketAuthGuard: Socket not ready on attempt ${attempt}/${maxRetries}`);
        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    console.error('🔐 SocketAuthGuard: All attempts failed');
    return null;
  }
}