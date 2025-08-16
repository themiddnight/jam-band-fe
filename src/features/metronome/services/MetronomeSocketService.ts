// Metronome Socket Service

import { Socket } from 'socket.io-client';
import type { MetronomeTickData, UpdateMetronomeData } from '../types';

export class MetronomeSocketService {
  constructor(private socket: Socket | null) {}

  // Request current metronome state when joining room
  requestMetronomeState() {
    if (!this.socket) return;
    this.socket.emit('request_metronome_state');
  }

  // Update metronome BPM (only room owner and band members)
  updateBpm(bpm: number) {
    if (!this.socket) return;
    
    const data: UpdateMetronomeData = { bpm };
    this.socket.emit('update_metronome', data);
  }

  // Listen for metronome state updates
  onMetronomeUpdated(callback: (data: { bpm: number; lastTickTimestamp: number }) => void) {
    if (!this.socket) return;
    this.socket.on('metronome_updated', callback);
  }

  // Listen for metronome ticks
  onMetronomeTick(callback: (data: MetronomeTickData) => void) {
    if (!this.socket) return;
    this.socket.on('metronome_tick', callback);
  }

  // Listen for initial metronome state
  onMetronomeState(callback: (data: { bpm: number; lastTickTimestamp: number }) => void) {
    if (!this.socket) return;
    this.socket.on('metronome_state', callback);
  }

  // Remove metronome event listeners
  removeListeners() {
    if (!this.socket) return;
    this.socket.off('metronome_updated');
    this.socket.off('metronome_tick');
    this.socket.off('metronome_state');
  }

  // Update socket reference
  updateSocket(socket: Socket | null) {
    this.socket = socket;
  }
}
