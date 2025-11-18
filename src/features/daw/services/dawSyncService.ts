import type { Socket } from 'socket.io-client';
import { useTrackStore } from '../stores/trackStore';
import { useRegionStore } from '../stores/regionStore';
import { usePianoRollStore } from '../stores/pianoRollStore';
import { useLockStore } from '../stores/lockStore';
import { useEffectsStore } from '../../effects/stores/effectsStore';
import { useProjectStore } from '../stores/projectStore';
import { useSynthStore } from '../stores/synthStore';
import { trackInstrumentRegistry } from '../utils/trackInstrumentRegistry';
import type { Track, Region, MidiNote, TimeSignature } from '../types/daw';
import type { SynthState } from '@/features/instruments';
import type { EffectChainState } from '@/shared/types';
import { DEFAULT_BPM, DEFAULT_TIME_SIGNATURE } from '../types/daw';
import { debounce } from 'lodash';

export class DAWSyncService {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private username: string | null = null;
  private isSyncing = false; // Flag to prevent circular updates
  private effectChainDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Debounced effect chain update (500ms)
  private debouncedEffectChainUpdate = debounce(
    (trackId: string, chainType: string, effectChain: any) => {
      if (!this.socket || !this.roomId) return;
      this.socket.emit('arrange:effect_chain_update', {
        roomId: this.roomId,
        trackId,
        chainType,
        effectChain,
      });
    },
    500
  );

  /**
   * Initialize the sync service with socket and user info
   */
  initialize(socket: Socket, roomId: string, userId: string, username: string): void {
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId;
    this.username = username;
    this.setupEventListeners();
  }

  /**
   * Clean up the sync service
   */
  cleanup(): void {
    if (this.effectChainDebounceTimer) {
      clearTimeout(this.effectChainDebounceTimer);
    }
    this.debouncedEffectChainUpdate.cancel();
    this.removeEventListeners();
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.username = null;
  }

  /**
   * Set up event listeners for incoming updates
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('arrange:state_sync', this.handleStateSync.bind(this));
    this.socket.on('arrange:track_added', this.handleTrackAdded.bind(this));
    this.socket.on('arrange:track_updated', this.handleTrackUpdated.bind(this));
    this.socket.on('arrange:track_deleted', this.handleTrackDeleted.bind(this));
    this.socket.on('arrange:track_instrument_changed', this.handleTrackInstrumentChanged.bind(this));
    this.socket.on('arrange:region_added', this.handleRegionAdded.bind(this));
    this.socket.on('arrange:region_updated', this.handleRegionUpdated.bind(this));
    this.socket.on('arrange:region_moved', this.handleRegionMoved.bind(this));
    this.socket.on('arrange:region_deleted', this.handleRegionDeleted.bind(this));
    this.socket.on('arrange:note_added', this.handleNoteAdded.bind(this));
    this.socket.on('arrange:note_updated', this.handleNoteUpdated.bind(this));
    this.socket.on('arrange:note_deleted', this.handleNoteDeleted.bind(this));
    this.socket.on('arrange:effect_chain_updated', this.handleEffectChainUpdated.bind(this));
    this.socket.on('arrange:synth_params_updated', this.handleSynthParamsUpdated.bind(this));
    this.socket.on('arrange:bpm_changed', this.handleBpmChanged.bind(this));
    this.socket.on('arrange:time_signature_changed', this.handleTimeSignatureChanged.bind(this));
    this.socket.on('arrange:selection_changed', this.handleSelectionChanged.bind(this));
    this.socket.on('arrange:lock_acquired', this.handleLockAcquired.bind(this));
    this.socket.on('arrange:lock_released', this.handleLockReleased.bind(this));
    this.socket.on('arrange:lock_conflict', this.handleLockConflict.bind(this));
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    if (!this.socket) return;

    this.socket.off('arrange:state_sync');
    this.socket.off('arrange:track_added');
    this.socket.off('arrange:track_updated');
    this.socket.off('arrange:track_deleted');
    this.socket.off('arrange:track_instrument_changed');
    this.socket.off('arrange:region_added');
    this.socket.off('arrange:region_updated');
    this.socket.off('arrange:region_moved');
    this.socket.off('arrange:region_deleted');
    this.socket.off('arrange:note_added');
    this.socket.off('arrange:note_updated');
    this.socket.off('arrange:note_deleted');
    this.socket.off('arrange:effect_chain_updated');
    this.socket.off('arrange:synth_params_updated');
    this.socket.off('arrange:bpm_changed');
    this.socket.off('arrange:time_signature_changed');
    this.socket.off('arrange:selection_changed');
    this.socket.off('arrange:lock_acquired');
    this.socket.off('arrange:lock_released');
    this.socket.off('arrange:lock_conflict');
  }

  // ========== Outgoing sync methods (called from stores) ==========

  /**
   * Request initial state from server
   */
  requestState(): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('arrange:request_state', { roomId: this.roomId });
  }

  /**
   * Sync track add
   */
  syncTrackAdd(track: Track): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:track_add', { roomId: this.roomId, track });
  }

  /**
   * Sync track update
   */
  syncTrackUpdate(trackId: string, updates: Partial<Track>): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:track_update', { roomId: this.roomId, trackId, updates });
  }

  /**
   * Sync track delete
   */
  syncTrackDelete(trackId: string): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:track_delete', { roomId: this.roomId, trackId });
  }

  /**
   * Sync track instrument change
   */
  syncTrackInstrumentChange(trackId: string, instrumentId: string, instrumentCategory?: string): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:track_instrument_change', {
      roomId: this.roomId,
      trackId,
      instrumentId,
      instrumentCategory,
    });
  }

  /**
   * Sync region add
   */
  syncRegionAdd(region: Region): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:region_add', { roomId: this.roomId, region });
  }

  /**
   * Sync region update
   */
  syncRegionUpdate(regionId: string, updates: Partial<Region>): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:region_update', { roomId: this.roomId, regionId, updates });
  }

  /**
   * Sync region move
   */
  syncRegionMove(regionId: string, deltaBeats: number): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:region_move', { roomId: this.roomId, regionId, deltaBeats });
  }

  /**
   * Sync region delete
   */
  syncRegionDelete(regionId: string): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:region_delete', { roomId: this.roomId, regionId });
  }

  /**
   * Sync note add
   */
  syncNoteAdd(regionId: string, note: MidiNote): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:note_add', { roomId: this.roomId, regionId, note });
  }

  /**
   * Sync note update
   */
  syncNoteUpdate(regionId: string, noteId: string, updates: Partial<MidiNote>): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:note_update', { roomId: this.roomId, regionId, noteId, updates });
  }

  /**
   * Sync note delete
   */
  syncNoteDelete(regionId: string, noteId: string): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:note_delete', { roomId: this.roomId, regionId, noteId });
  }

  /**
   * Sync effect chain update (debounced)
   */
  syncEffectChainUpdate(trackId: string, chainType: string, effectChain: any): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.debouncedEffectChainUpdate(trackId, chainType, effectChain);
  }

  /**
   * Sync synth parameter updates
   */
  syncSynthParams(trackId: string, params: Partial<SynthState>): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:synth_params_update', {
      roomId: this.roomId,
      trackId,
      params,
    });
  }

  /**
   * Sync BPM change
   */
  syncBpmChange(bpm: number): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:bpm_change', {
      roomId: this.roomId,
      bpm,
    });
  }

  /**
   * Sync time signature change
   */
  syncTimeSignatureChange(timeSignature: TimeSignature): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:time_signature_change', {
      roomId: this.roomId,
      timeSignature,
    });
  }

  /**
   * Sync selection change
   */
  syncSelectionChange(selectedTrackId: string | null, selectedRegionIds: string[]): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:selection_change', {
      roomId: this.roomId,
      selectedTrackId,
      selectedRegionIds,
    });
  }

  /**
   * Acquire lock
   */
  acquireLock(elementId: string, type: 'region' | 'track' | 'track_property'): void {
    if (!this.socket || !this.roomId || !this.userId || !this.username) return;
    this.socket.emit('arrange:lock_acquire', {
      roomId: this.roomId,
      elementId,
      type,
    });
  }

  /**
   * Release lock
   */
  releaseLock(elementId: string): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('arrange:lock_release', {
      roomId: this.roomId,
      elementId,
    });
  }

  // ========== Incoming update handlers ==========

  private handleStateSync(data: {
    tracks: Track[];
    regions: Region[];
    locks: Array<{ elementId: string; userId: string; username: string; type: string; timestamp: number }>;
    selectedTrackId: string | null;
    selectedRegionIds: string[];
    bpm?: number;
    timeSignature?: TimeSignature;
    synthStates?: Record<string, SynthState>;
  }): void {
    this.isSyncing = true;
    try {
      // Clear existing state
      useTrackStore.getState().clearTracks();
      useRegionStore.getState().clearSelection();
      useSynthStore.getState().clearSynthStates();

      // Set tracks using sync handler
      useTrackStore.getState().syncSetTracks(data.tracks);

      // Set regions using sync handler
      useRegionStore.getState().syncSetRegions(data.regions);

      // Set synth states
      if (data.synthStates) {
        useSynthStore.getState().setAllSynthStates(data.synthStates);
      }

      // Update project settings
      const setBpm = useProjectStore.getState().setBpm;
      const setTimeSignature = useProjectStore.getState().setTimeSignature;
      setBpm(data.bpm ?? DEFAULT_BPM);
      setTimeSignature(data.timeSignature ?? DEFAULT_TIME_SIGNATURE);

      // Set locks (cast type to ensure it matches LockInfo)
      useLockStore.getState().setLocks(
        data.locks.map((lock) => ({
          ...lock,
          type: lock.type as 'region' | 'track' | 'track_property',
        }))
      );

      // Set selection using sync handlers
      useTrackStore.getState().syncSelectTrack(data.selectedTrackId);
      useRegionStore.getState().syncSelectRegions(data.selectedRegionIds);

      // Apply synth params to engines
      if (data.synthStates) {
        const tracks = data.tracks;
        Object.entries(data.synthStates).forEach(([trackId, synthState]) => {
          const track = tracks.find((t) => t.id === trackId);
          if (!track || track.type !== 'midi') {
            return;
          }
          void (async () => {
            try {
              const { engine } = await trackInstrumentRegistry.ensureEngine(track, {
                instrumentId: track.instrumentId,
                instrumentCategory: track.instrumentCategory,
              });
              await engine.updateSynthParams(synthState);
            } catch (error) {
              console.warn('Failed to apply synced synth parameters', {
                trackId,
                error,
              });
            }
          })();
        });
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private handleTrackAdded(data: { track: Track; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useTrackStore.getState().syncAddTrack(data.track);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleTrackUpdated(data: { trackId: string; updates: Partial<Track>; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useTrackStore.getState().syncUpdateTrack(data.trackId, data.updates);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleTrackDeleted(data: { trackId: string; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useTrackStore.getState().syncRemoveTrack(data.trackId);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleTrackInstrumentChanged(data: {
    trackId: string;
    instrumentId: string;
    instrumentCategory?: string;
    userId: string;
  }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useTrackStore.getState().syncSetTrackInstrument(
        data.trackId,
        data.instrumentId,
        data.instrumentCategory as any
      );
    } finally {
      this.isSyncing = false;
    }
  }

  private handleRegionAdded(data: { region: Region; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useRegionStore.getState().syncAddRegion(data.region);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleRegionUpdated(data: { regionId: string; updates: Partial<Region>; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useRegionStore.getState().syncUpdateRegion(data.regionId, data.updates);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleRegionMoved(data: { regionId: string; newStart: number; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useRegionStore.getState().syncMoveRegion(data.regionId, data.newStart);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleRegionDeleted(data: { regionId: string; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useRegionStore.getState().syncRemoveRegion(data.regionId);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleNoteAdded(data: { regionId: string; note: MidiNote; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      usePianoRollStore.getState().syncAddNote(data.regionId, data.note);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleNoteUpdated(data: { regionId: string; noteId: string; updates: Partial<MidiNote>; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      usePianoRollStore.getState().syncUpdateNote(data.regionId, data.noteId, data.updates);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleNoteDeleted(data: { regionId: string; noteId: string; userId: string }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      usePianoRollStore.getState().syncDeleteNote(data.regionId, data.noteId);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleEffectChainUpdated(data: {
    trackId: string;
    chainType: string;
    effectChain: EffectChainState;
    userId: string;
  }): void {
    if (this.isSyncing) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useEffectsStore.getState().syncUpdateEffectChain(
        data.chainType as any,
        data.effectChain
      );
    } finally {
      this.isSyncing = false;
    }
  }

  private handleSynthParamsUpdated(data: {
    trackId: string;
    params: Partial<SynthState>;
    userId: string;
  }): void {
    if (this.isSyncing) return;
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      const synthStore = useSynthStore.getState();
      if (synthStore.synthStates[data.trackId]) {
        synthStore.updateSynthState(data.trackId, data.params);
      }

      const track = useTrackStore.getState().tracks.find((t) => t.id === data.trackId);
      if (track && track.type === 'midi') {
        void (async () => {
          try {
            const { engine } = await trackInstrumentRegistry.ensureEngine(track, {
              instrumentId: track.instrumentId,
              instrumentCategory: track.instrumentCategory,
            });
            await engine.updateSynthParams(data.params);
            synthStore.setSynthState(track.id, engine.getSynthState());
          } catch (error) {
            console.warn('Failed to apply remote synth params', {
              trackId: track.id,
              error,
            });
          }
        })();
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private handleBpmChanged(data: { bpm: number; userId: string }): void {
    if (this.isSyncing) return;
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useProjectStore.getState().setBpm(data.bpm);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleTimeSignatureChanged(data: {
    timeSignature: TimeSignature;
    userId: string;
  }): void {
    if (this.isSyncing) return;
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useProjectStore.getState().setTimeSignature(data.timeSignature);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleSelectionChanged(data: {
    selectedTrackId?: string | null;
    selectedRegionIds?: string[];
    userId: string;
    username: string;
  }): void {
    if (this.isSyncing || data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      if (data.selectedTrackId !== undefined) {
        useTrackStore.getState().syncSelectTrack(data.selectedTrackId);
      }
      if (data.selectedRegionIds !== undefined) {
        useRegionStore.getState().syncSelectRegions(data.selectedRegionIds);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private handleLockAcquired(data: {
    elementId: string;
    lockInfo: { userId: string; username: string; type: string; timestamp: number };
  }): void {
    useLockStore.getState().acquireLock(data.elementId, {
      ...data.lockInfo,
      type: data.lockInfo.type as 'region' | 'track' | 'track_property',
    });
  }

  private handleLockReleased(data: { elementId: string }): void {
    // Release lock (we don't know the userId, so we'll check in the store)
    const lock = useLockStore.getState().isLocked(data.elementId);
    if (lock && lock.userId !== this.userId) {
      // Only release if it's not our lock (our own releases are handled locally)
      useLockStore.getState().releaseLock(data.elementId, lock.userId);
    }
  }

  private handleLockConflict(data: { elementId: string; lockedBy: string }): void {
    console.warn(`Lock conflict: ${data.elementId} is locked by ${data.lockedBy}`);
    // Could show a notification to the user
  }
}

// Singleton instance
export const dawSyncService = new DAWSyncService();

