import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SocketMessageQueue } from '../SocketMessageQueue';
import { Socket } from 'socket.io-client';

describe('SocketMessageQueue', () => {
  let mockSocket: any;
  let socketProvider: () => Socket | null;
  
  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket = {
      connected: true,
      emit: vi.fn(),
    };
    socketProvider = () => mockSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should enqueue messages and batch them', () => {
    const queue = new SocketMessageQueue(socketProvider, { batchInterval: 100 });
    
    // Use 'value' instead of 'id' to ensure they map to the same entity key ('global')
    // because 'id' is used as a unique identifier in defaultKeyGenerator
    queue.enqueue('test_event', { value: 1 });
    queue.enqueue('test_event', { value: 2 });
    
    // Should not emit immediately
    expect(mockSocket.emit).not.toHaveBeenCalled();
    
    // Advance timer
    vi.advanceTimersByTime(100);
    
    // Should emit now (only the latest one)
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { value: 2 });
  });

  it('should handle multiple events independently', () => {
    const queue = new SocketMessageQueue(socketProvider, { batchInterval: 100 });
    
    queue.enqueue('event_a', { id: 1 });
    queue.enqueue('event_b', { id: 2 });
    
    vi.advanceTimersByTime(100);
    
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    expect(mockSocket.emit).toHaveBeenCalledWith('event_a', { id: 1 });
    expect(mockSocket.emit).toHaveBeenCalledWith('event_b', { id: 2 });
  });

  it('should handle throttling by userId (last write wins per user)', () => {
    const queue = new SocketMessageQueue(socketProvider, { batchInterval: 100 });
    
    // User 1 moves cursor
    queue.enqueue('cursor_move', { userId: 'user1', x: 10 });
    queue.enqueue('cursor_move', { userId: 'user1', x: 20 });
    
    // User 2 moves cursor
    queue.enqueue('cursor_move', { userId: 'user2', x: 5 });
    
    // User 1 moves again
    queue.enqueue('cursor_move', { userId: 'user1', x: 30 });
    
    vi.advanceTimersByTime(100);
    
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    // Should send latest for user1
    expect(mockSocket.emit).toHaveBeenCalledWith('cursor_move', { userId: 'user1', x: 30 });
    // Should send latest for user2
    expect(mockSocket.emit).toHaveBeenCalledWith('cursor_move', { userId: 'user2', x: 5 });
  });

  it('should respect maxQueueSize', () => {
    const queue = new SocketMessageQueue(socketProvider, { 
      batchInterval: 100,
      maxQueueSize: 4 
    });
    
    // Add 5 messages
    queue.enqueue('event', { i: 1 });
    queue.enqueue('event', { i: 2 });
    queue.enqueue('event', { i: 3 });
    queue.enqueue('event', { i: 4 });
    queue.enqueue('event', { i: 5 });
    
    // Queue should slice to keep last maxQueueSize/2 = 2 items when exceeding max
    // So it keeps {i:4}, {i:5}
    
    vi.advanceTimersByTime(100);
    
    // With the slicing logic in enqueue: 
    // After 5th enqueue, length is 5 > 4. Sliced to last 2.
    // So we effectively dropped 1, 2, 3.
    
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    expect(mockSocket.emit).toHaveBeenCalledWith('event', { i: 5 });
  });

  it('should not emit if socket is disconnected', () => {
    mockSocket.connected = false;
    const queue = new SocketMessageQueue(socketProvider, { batchInterval: 100 });
    
    queue.enqueue('test', {});
    
    vi.advanceTimersByTime(100);
    
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('should clear queue', () => {
    const queue = new SocketMessageQueue(socketProvider, { batchInterval: 100 });
    
    queue.enqueue('test', {});
    queue.clear();
    
    vi.advanceTimersByTime(100);
    
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});
