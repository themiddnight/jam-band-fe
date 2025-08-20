// Metronome Socket Service - Updated for namespace-based connections

import { Socket } from 'socket.io-client';
import type { MetronomeTickData, UpdateMetronomeData } from '../types';

type MetronomeEventHandler =
  | ((data: { bpm: number; lastTickTimestamp: number }) => void)
  | ((data: MetronomeTickData) => void);

export class MetronomeSocketService {
  private socket: Socket | null = null;
  private eventHandlers: Map<string, MetronomeEventHandler> = new Map();

  constructor(socket?: Socket | null) {
    if (socket) {
      this.updateSocket(socket);
    }
  }

  // Request current metronome state when joining room
  requestMetronomeState() {
    if (!this.socket?.connected) return;
    this.socket.emit('request_metronome_state');
  }

  // Update metronome BPM (only room owner and band members)
  updateBpm(bpm: number) {
    if (!this.socket?.connected) return;

    const data: UpdateMetronomeData = { bpm };
    this.socket.emit('update_metronome', data);
  }

  // Listen for metronome state updates
  onMetronomeUpdated(callback: (data: { bpm: number; lastTickTimestamp: number }) => void) {
    if (!this.socket) return () => { };

    // Remove existing handler if any
    this.removeHandler('metronome_updated');

    // Add new handler
    this.socket.on('metronome_updated', callback);
    this.eventHandlers.set('metronome_updated', callback);

    // Return cleanup function
    return () => {
      this.removeHandler('metronome_updated');
    };
  }

  // Listen for metronome ticks
  onMetronomeTick(callback: (data: MetronomeTickData) => void) {
    if (!this.socket) return () => { };

    // Remove existing handler if any
    this.removeHandler('metronome_tick');

    // Add new handler
    this.socket.on('metronome_tick', callback);
    this.eventHandlers.set('metronome_tick', callback);

    // Return cleanup function
    return () => {
      this.removeHandler('metronome_tick');
    };
  }

  // Listen for initial metronome state
  onMetronomeState(callback: (data: { bpm: number; lastTickTimestamp: number }) => void) {
    if (!this.socket) return () => { };

    // Remove existing handler if any
    this.removeHandler('metronome_state');

    // Add new handler
    this.socket.on('metronome_state', callback);
    this.eventHandlers.set('metronome_state', callback);

    // Return cleanup function
    return () => {
      this.removeHandler('metronome_state');
    };
  }

  // Remove specific event handler
  private removeHandler(eventName: string) {
    if (this.socket && this.eventHandlers.has(eventName)) {
      const handler = this.eventHandlers.get(eventName);
      if (handler) {
        this.socket.off(eventName, handler);
        this.eventHandlers.delete(eventName);
      }
    }
  }

  // Remove all metronome event listeners
  removeListeners() {
    if (!this.socket) return;

    // Remove all tracked handlers
    for (const [eventName, handler] of this.eventHandlers.entries()) {
      this.socket.off(eventName, handler);
    }
    this.eventHandlers.clear();
  }

  // Update socket reference and clean up old listeners
  updateSocket(socket: Socket | null) {
    // Clean up old socket listeners
    this.removeListeners();

    // Update socket reference
    this.socket = socket;

    // Note: Event handlers will need to be re-registered after socket update
    // This is intentional to ensure proper namespace isolation
  }

  // Check if socket is connected and ready
  isReady(): boolean {
    return this.socket?.connected ?? false;
  }

  // Get current socket (for debugging)
  getSocket(): Socket | null {
    return this.socket;
  }
}
