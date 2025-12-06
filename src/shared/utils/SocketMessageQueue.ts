import { Socket } from 'socket.io-client';

interface QueueItem {
  event: string;
  data: any;
  timestamp: number;
}

export interface SocketMessageQueueOptions {
  batchInterval?: number;
  maxQueueSize?: number;
  keyGenerator?: (event: string, data: any) => string;
}

/**
 * A utility class for batching and throttling socket messages.
 * It collects messages and sends only the latest message for a given event/entity pair
 * at the end of the batch interval. This is useful for high-frequency updates
 * like cursor movements, fader adjustments, etc.
 */
export class SocketMessageQueue {
  private queue: QueueItem[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly batchInterval: number;
  private readonly maxQueueSize: number;
  private readonly keyGenerator: (event: string, data: any) => string;
  private socketProvider: () => Socket | null;

  constructor(
    socketProvider: () => Socket | null,
    options: SocketMessageQueueOptions = {}
  ) {
    this.socketProvider = socketProvider;
    this.batchInterval = options.batchInterval ?? 8; // ~120fps
    this.maxQueueSize = options.maxQueueSize ?? 100;
    this.keyGenerator = options.keyGenerator ?? this.defaultKeyGenerator;
  }

  private defaultKeyGenerator(event: string, data: any): string {
    // Try to find a unique identifier in the data
    const entityId = 
      data?.userId || 
      data?.trackId || 
      data?.regionId || 
      data?.id || 
      'global';
    return `${event}###${entityId}`;
  }

  /**
   * Add a message to the queue.
   * If the queue exceeds maxQueueSize, older messages are dropped.
   */
  public enqueue(event: string, data: any) {
    this.queue.push({ event, data, timestamp: Date.now() });

    if (this.queue.length > this.maxQueueSize) {
      // Keep the newest half of the queue
      this.queue = this.queue.slice(-this.maxQueueSize / 2);
    }

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.processBatch(), this.batchInterval);
    }
  }

  /**
   * Process the current batch of messages.
   * Sends only the latest message for each unique event+entity combination.
   */
  public processBatch() {
    if (this.queue.length === 0) return;

    const messages = [...this.queue];
    this.queue = [];
    this.batchTimeout = null;

    // Group messages by unique key
    // We use a Map to keep track of the latest message for each key
    const latestMessages = new Map<string, QueueItem>();
    
    messages.forEach(msg => {
      const key = this.keyGenerator(msg.event, msg.data);
      latestMessages.set(key, msg);
    });

    const socket = this.socketProvider();
    if (socket?.connected) {
      latestMessages.forEach((msg) => {
        socket.emit(msg.event, msg.data);
      });
    }
  }
  
  /**
   * Clear the queue and cancel any pending batch processing.
   */
  public clear() {
    this.queue = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
}
