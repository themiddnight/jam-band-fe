import type { Socket } from 'socket.io-client';
import { useTrackStore } from '../stores/trackStore';
import { useRegionStore } from '../stores/regionStore';
import { usePianoRollStore } from '../stores/pianoRollStore';
import { useLockStore, type LockType } from '../stores/lockStore';
import { useEffectsStore } from '../../effects/stores/effectsStore';
import { useProjectStore } from '../stores/projectStore';
import { useSynthStore } from '../stores/synthStore';
import { useRecordingStore } from '../stores/recordingStore';
import { useMarkerStore } from '../stores/markerStore';
import { useBroadcastStore } from '../stores/broadcastStore';
import { useArrangeUserStateStore } from '../stores/userStateStore';
import { trackInstrumentRegistry } from '../utils/trackInstrumentRegistry';
import type { Track, Region, MidiNote, TimeSignature } from '../types/daw';
import type { TimeMarker } from '../types/marker';
import type { SynthState } from '@/features/instruments';
import type { EffectChainState } from '@/shared/types';
import { DEFAULT_BPM, DEFAULT_TIME_SIGNATURE } from '../types/daw';
import { InstrumentCategory } from '@/shared/constants/instruments';
import { debounce } from 'lodash';

export type RegionDragUpdatePayload = {
  regionId: string;
  newStart: number;
  trackId?: string | null;
};

export class DAWSyncService {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private username: string | null = null;
  private isSyncing = false; // Flag to prevent circular updates
  private isPaused = false; // Flag to pause incoming sync updates (e.g., during mixdown)
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
    console.log('🎵 DAW Sync Service initialized', {
      roomId,
      userId,
      username,
      socketId: socket.id,
      socketNamespace: (socket as any).nsp,
    });
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
    this.socket.on('arrange:track_reordered', this.handleTrackReordered.bind(this));
    this.socket.on('arrange:region_added', this.handleRegionAdded.bind(this));
    this.socket.on('arrange:region_updated', this.handleRegionUpdated.bind(this));
    this.socket.on('arrange:region_moved', this.handleRegionMoved.bind(this));
    this.socket.on('arrange:region_dragged', this.handleRegionDragBatch.bind(this));
    this.socket.on('arrange:region_deleted', this.handleRegionDeleted.bind(this));
    this.socket.on('arrange:note_added', this.handleNoteAdded.bind(this));
    this.socket.on('arrange:note_updated', this.handleNoteUpdated.bind(this));
    this.socket.on('arrange:note_deleted', this.handleNoteDeleted.bind(this));
    this.socket.on('arrange:recording_preview', this.handleRecordingPreview.bind(this));
    this.socket.on('arrange:recording_preview_end', this.handleRecordingPreviewEnd.bind(this));
    this.socket.on('arrange:effect_chain_updated', this.handleEffectChainUpdated.bind(this));
    this.socket.on('arrange:synth_params_updated', this.handleSynthParamsUpdated.bind(this));
    this.socket.on('arrange:bpm_changed', this.handleBpmChanged.bind(this));
    this.socket.on('arrange:time_signature_changed', this.handleTimeSignatureChanged.bind(this));
    this.socket.on('arrange:project_scale_changed', this.handleProjectScaleChanged.bind(this));
    this.socket.on('arrange:selection_changed', this.handleSelectionChanged.bind(this));
    this.socket.on('arrange:lock_acquired', this.handleLockAcquired.bind(this));
    this.socket.on('arrange:lock_released', this.handleLockReleased.bind(this));
    this.socket.on('arrange:lock_conflict', this.handleLockConflict.bind(this));
    this.socket.on('arrange:project_loaded', this.handleProjectLoaded.bind(this));
    this.socket.on('arrange:marker_added', this.handleMarkerAdded.bind(this));
    this.socket.on('arrange:marker_updated', this.handleMarkerUpdated.bind(this));
    this.socket.on('arrange:marker_deleted', this.handleMarkerDeleted.bind(this));
    this.socket.on('arrange:voice_state', this.handleVoiceStateUpdate.bind(this));
    this.socket.on('arrange:full_state_update', this.handleFullStateUpdate.bind(this));
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
    this.socket.off('arrange:track_reordered');
    this.socket.off('arrange:region_added');
    this.socket.off('arrange:region_updated');
    this.socket.off('arrange:region_moved');
    this.socket.off('arrange:region_deleted');
    this.socket.off('arrange:region_dragged');
    this.socket.off('arrange:note_added');
    this.socket.off('arrange:note_updated');
    this.socket.off('arrange:note_deleted');
    this.socket.off('arrange:recording_preview');
    this.socket.off('arrange:recording_preview_end');
    this.socket.off('arrange:effect_chain_updated');
    this.socket.off('arrange:synth_params_updated');
    this.socket.off('arrange:bpm_changed');
    this.socket.off('arrange:time_signature_changed');
    this.socket.off('arrange:project_scale_changed');
    this.socket.off('arrange:selection_changed');
    this.socket.off('arrange:lock_acquired');
    this.socket.off('arrange:lock_released');
    this.socket.off('arrange:lock_conflict');
    this.socket.off('arrange:project_loaded');
    this.socket.off('arrange:marker_added');
    this.socket.off('arrange:marker_updated');
    this.socket.off('arrange:marker_deleted');
    this.socket.off('arrange:voice_state');
    this.socket.off('arrange:full_state_update');
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
   * Pause incoming sync updates (e.g., during mixdown export)
   * Outgoing updates are still sent so other users can continue working
   */
  pauseSync(): void {
    console.log('🎵 DAW Sync paused (incoming updates blocked)');
    this.isPaused = true;
  }

  /**
   * Resume incoming sync updates and request latest state from server
   */
  resumeSync(): void {
    console.log('🎵 DAW Sync resumed (requesting latest state)');
    this.isPaused = false;
    this.requestState();
  }

  /**
   * Check if sync is currently paused
   */
  isPausedSync(): boolean {
    return this.isPaused;
  }

  /**
   * Check if incoming updates should be blocked
   * Returns true if syncing or paused
   */
  private shouldBlockIncoming(): boolean {
    return this.isSyncing || this.isPaused;
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
   * Sync track reorder
   */
  syncTrackReorder(trackIds: string[]): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:track_reorder', { roomId: this.roomId, trackIds });
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
   * Sync batched region drag updates
   */
  syncRegionDragBatch(updates: RegionDragUpdatePayload[]): void {
    if (!this.socket || !this.roomId || this.isSyncing || updates.length === 0) return;
    this.socket.emit('arrange:region_drag', {
      roomId: this.roomId,
      updates: updates.map((update) => ({
        regionId: update.regionId,
        newStart: update.newStart,
        trackId: update.trackId ?? undefined,
      })),
    });
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
   * Sync project scale change
   */
  syncProjectScaleChange(rootNote: string, scale: 'major' | 'minor'): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:project_scale_change', {
      roomId: this.roomId,
      rootNote,
      scale,
    });
  }

  /**
   * Sync selection change
   * Track selections remain local, so callers should only include region data when needed.
   */
  syncSelectionChange(payload: { selectedTrackId?: string | null; selectedRegionIds?: string[] }): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;

    const hasPayload =
      Object.prototype.hasOwnProperty.call(payload, 'selectedTrackId') ||
      Object.prototype.hasOwnProperty.call(payload, 'selectedRegionIds');

    if (!hasPayload) {
      return;
    }

    this.socket.emit('arrange:selection_change', {
      roomId: this.roomId,
      ...payload,
    });
  }

  /**
   * Acquire lock
   */
  acquireLock(elementId: string, type: LockType): void {
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

  syncRecordingPreview(preview: {
    trackId: string;
    recordingType: 'midi' | 'audio';
    startBeat: number;
    durationBeats: number;
  }): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:recording_preview', {
      roomId: this.roomId,
      preview,
    });
  }

  syncRecordingPreviewEnd(): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:recording_preview_end', {
      roomId: this.roomId,
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
    projectScale?: { rootNote: string; scale: 'major' | 'minor' };
    synthStates?: Record<string, SynthState>;
    effectChains?: Record<string, EffectChainState>;
    markers?: TimeMarker[];
    voiceStates?: Record<string, { isMuted: boolean }>;
    broadcastStates?: Record<string, { username: string; trackId: string | null }>;
  }): void {
    // Allow state sync even when paused (this is used to reload state after mixdown)
    this.isSyncing = true;
    try {
      // Clear existing state
      useTrackStore.getState().clearTracks();
      useRegionStore.getState().clearSelection();
      useSynthStore.getState().clearSynthStates();

      // Set tracks using sync handler
      useTrackStore.getState().syncSetTracks(data.tracks);

      // Set regions using sync handler
      console.log('State sync - received regions:', data.regions.map(r => ({
        id: r.id,
        type: r.type,
        audioUrl: r.type === 'audio' ? (r as any).audioUrl : undefined,
      })));
      useRegionStore.getState().syncSetRegions(data.regions);

      // Set synth states
      if (data.synthStates) {
        useSynthStore.getState().setAllSynthStates(data.synthStates);
      }

      // Set markers
      if (data.markers) {
        useMarkerStore.getState().syncSetMarkers(data.markers);
      }

      const arrangeUserStore = useArrangeUserStateStore.getState();
      arrangeUserStore.setVoiceStates(data.voiceStates ?? {});

      const broadcastStore = useBroadcastStore.getState();
      broadcastStore.setBroadcastStates(data.broadcastStates ?? {});

      // Update project settings
      const setBpm = useProjectStore.getState().setBpm;
      const setTimeSignature = useProjectStore.getState().setTimeSignature;
      const setProjectScale = useProjectStore.getState().setProjectScale;
      setBpm(data.bpm ?? DEFAULT_BPM);
      setTimeSignature(data.timeSignature ?? DEFAULT_TIME_SIGNATURE);
      if (data.projectScale) {
        setProjectScale(data.projectScale.rootNote, data.projectScale.scale);
      }

      // Restore effect chains
      if (data.effectChains) {
        const effectsStore = useEffectsStore.getState();
        Object.entries(data.effectChains).forEach(([chainType, effectChain]) => {
          effectsStore.syncUpdateEffectChain(chainType as any, effectChain);
        });
      }

      // Set locks (cast type to ensure it matches LockInfo)
      useLockStore.getState().setLocks(
        data.locks.map((lock) => ({
          ...lock,
          type: lock.type as 'region' | 'track' | 'track_property',
        }))
      );

      // Track selection stays local per collaborator, so we intentionally do not
      // apply remote selection state here.

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
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
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

  private handleTrackReordered(data: { trackIds: string[]; userId: string }): void {
    if (this.shouldBlockIncoming()) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useTrackStore.getState().syncReorderTracks(data.trackIds);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleRegionAdded(data: { region: Region; userId: string }): void {
    if (this.shouldBlockIncoming()) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useRegionStore.getState().syncAddRegion(data.region);
      useRecordingStore.getState().removeRemoteRecordingPreview(data.userId);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleRegionUpdated(data: { regionId: string; updates: Partial<Region>; userId: string }): void {
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
    // Filter out self-generated events
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useRegionStore.getState().syncMoveRegion(data.regionId, data.newStart);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleRegionDragBatch(data: { updates: RegionDragUpdatePayload[]; userId: string }): void {
    if (this.shouldBlockIncoming() || data.userId === this.userId) return;
    if (!Array.isArray(data.updates) || data.updates.length === 0) {
      return;
    }

    this.isSyncing = true;
    try {
      const regionStore = useRegionStore.getState();
      const trackStore = useTrackStore.getState();

      data.updates.forEach((update) => {
        const region = regionStore.regions.find((r) => r.id === update.regionId);
        if (!region) {
          return;
        }

        const nextTrackId = update.trackId ?? region.trackId;
        if (nextTrackId && nextTrackId !== region.trackId) {
          trackStore.detachRegionFromTrack(region.trackId, region.id);
          trackStore.attachRegionToTrack(nextTrackId, region.id);
        }

        regionStore.syncUpdateRegion(region.id, {
          start: Math.max(0, update.newStart),
          trackId: nextTrackId,
        });
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private handleRegionDeleted(data: { regionId: string; userId: string }): void {
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
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

  /**
   * Apply synth states from loaded project to instrument engines
   */
  private async applySynthStatesFromProject(projectData: any): Promise<void> {
    if (!projectData.synthStates || Object.keys(projectData.synthStates).length === 0) {
      return;
    }

    const tracks = useTrackStore.getState().tracks;

    for (const track of tracks) {
      // Only apply to synth tracks
      if (track.type !== 'midi' || track.instrumentCategory !== InstrumentCategory.Synthesizer) {
        continue;
      }

      const synthState = projectData.synthStates[track.id];
      if (!synthState) {
        continue;
      }

      try {
        // Ensure the engine is loaded (without sync callback during project load)
        const { engine } = await trackInstrumentRegistry.ensureEngine(track, {
          instrumentId: track.instrumentId,
          instrumentCategory: track.instrumentCategory,
          // Don't trigger synth param change callbacks during project load
          onSynthParamsChange: undefined,
        });

        // Apply the saved synth parameters (isSyncing flag prevents broadcasts)
        await engine.updateSynthParams(synthState);
        
        console.log(`Applied synth state to track ${track.name} from server project`);
      } catch (error) {
        console.warn(`Failed to apply synth state to track ${track.id}:`, error);
      }
    }
  }

  private handleBpmChanged(data: { bpm: number; userId: string }): void {
    if (this.shouldBlockIncoming()) return;
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
    if (this.shouldBlockIncoming()) return;
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useProjectStore.getState().setTimeSignature(data.timeSignature);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleProjectScaleChanged(data: {
    rootNote: string;
    scale: 'major' | 'minor';
    userId: string;
  }): void {
    if (this.shouldBlockIncoming()) return;
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useProjectStore.getState().setProjectScale(data.rootNote, data.scale);
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
    if (this.shouldBlockIncoming() || data.userId === this.userId) return;
    // Track and region selections remain local so other users don't see our highlight state.
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

  private handleProjectLoaded(data: {
    projectData: any;
    uploadedBy: string;
    uploadedAt: string;
  }): void {
    console.log('🎵 Received arrange:project_loaded event', {
      uploadedBy: data.uploadedBy,
      currentUsername: this.username,
      projectName: data.projectData.metadata?.name,
      tracksCount: data.projectData.tracks?.length,
      regionsCount: data.projectData.regions?.length,
    });
    
    // Don't load if this is the user who uploaded it
    if (data.uploadedBy === this.username) {
      console.log('Skipping project load - uploaded by current user');
      return;
    }
    
    console.log(`🎵 Loading project from ${data.uploadedBy}:`, data.projectData.metadata?.name);
    
    // Set loading flag to trigger auto-fit zoom
    useProjectStore.getState().setIsLoadingProject(true);
    
    // Import the deserialize functions
    import('./projectSerializer').then(async ({ deserializeProject }) => {
      this.isSyncing = true;
      try {
        // Deserialize and load the project settings
        deserializeProject(data.projectData);
        
        // Load regions directly from projectData (they already have audioUrl set by the server)
        // Don't use deserializeRegions as it would overwrite the audioUrl
        useRegionStore.setState({
          regions: data.projectData.regions || [],
          selectedRegionIds: [],
          lastSelectedRegionId: null,
        });

        // Apply synth states to instrument engines
        await this.applySynthStatesFromProject(data.projectData);
        
        console.log('Project loaded successfully from server', {
          tracks: data.projectData.tracks?.length || 0,
          regions: data.projectData.regions?.length || 0,
          synthStates: Object.keys(data.projectData.synthStates || {}).length,
        });
        
        // Clear loading flag after a short delay to allow auto-fit to trigger
        setTimeout(() => {
          useProjectStore.getState().setIsLoadingProject(false);
        }, 200);
      } catch (error) {
        console.error('Failed to load project from server:', error);
        useProjectStore.getState().setIsLoadingProject(false);
      } finally {
        this.isSyncing = false;
      }
    });
  }

  private handleRecordingPreview(data: {
    userId: string;
    username: string;
    preview: {
      trackId: string;
      recordingType: 'midi' | 'audio';
      startBeat: number;
      durationBeats: number;
    };
  }): void {
    if (this.shouldBlockIncoming() || data.userId === this.userId) return;
    const store = useRecordingStore.getState();
    store.setRemoteRecordingPreview({
      userId: data.userId,
      username: data.username,
      trackId: data.preview.trackId,
      recordingType: data.preview.recordingType,
      startBeat: data.preview.startBeat,
      durationBeats: data.preview.durationBeats,
    });
  }

  private handleRecordingPreviewEnd(data: { userId: string }): void {
    if (this.shouldBlockIncoming() || data.userId === this.userId) return;
    useRecordingStore.getState().removeRemoteRecordingPreview(data.userId);
  }

  // ========== Marker sync methods ==========

  /**
   * Sync marker add
   */
  syncMarkerAdd(marker: TimeMarker): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:marker_add', { roomId: this.roomId, marker });
  }

  /**
   * Sync marker update
   */
  syncMarkerUpdate(markerId: string, updates: Partial<TimeMarker>): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:marker_update', { roomId: this.roomId, markerId, updates });
  }

  /**
   * Sync marker delete
   */
  syncMarkerDelete(markerId: string): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    this.socket.emit('arrange:marker_delete', { roomId: this.roomId, markerId });
  }

  /**
   * Sync full state update (for undo/redo operations)
   * This broadcasts the complete current state to other users
   */
  syncFullStateUpdate(): void {
    if (!this.socket || !this.roomId || this.isSyncing) return;
    
    const trackStore = useTrackStore.getState();
    const regionStore = useRegionStore.getState();
    const markerStore = useMarkerStore.getState();
    const projectStore = useProjectStore.getState();
    
    // Sanitize regions to remove non-serializable data
    const sanitizedRegions = regionStore.regions.map((region) => {
      if (region.type === 'audio') {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { audioBuffer, audioBlob, ...rest } = region;
        return rest;
      }
      return region;
    });
    
    this.socket.emit('arrange:full_state_update', {
      roomId: this.roomId,
      state: {
        tracks: trackStore.tracks,
        regions: sanitizedRegions,
        markers: markerStore.markers,
        bpm: projectStore.bpm,
        timeSignature: projectStore.timeSignature,
      },
    });
  }

  private handleMarkerAdded(data: { marker: TimeMarker; userId: string }): void {
    if (this.shouldBlockIncoming() || data.userId === this.userId) return;

    this.isSyncing = true;
    try {
      useMarkerStore.getState().syncAddMarker(data.marker);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleMarkerUpdated(data: { markerId: string; updates: Partial<TimeMarker>; userId: string }): void {
    if (this.shouldBlockIncoming() || data.userId === this.userId) return;

    this.isSyncing = true;
    try {
      useMarkerStore.getState().syncUpdateMarker(data.markerId, data.updates);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleMarkerDeleted(data: { markerId: string; userId: string }): void {
    if (this.shouldBlockIncoming()) return;
    if (data.userId === this.userId) return;
    this.isSyncing = true;
    try {
      useMarkerStore.getState().syncRemoveMarker(data.markerId);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleVoiceStateUpdate(data: { userId: string; isMuted: boolean }): void {
    if (!data?.userId) return;
    useArrangeUserStateStore.getState().setVoiceState(data.userId, data.isMuted);
  }

  private handleFullStateUpdate(data: {
    userId: string;
    state: {
      tracks: Track[];
      regions: Region[];
      markers: TimeMarker[];
      bpm: number;
      timeSignature: TimeSignature;
    };
  }): void {
    if (this.shouldBlockIncoming() || data.userId === this.userId) return;
    
    console.log('🔄 Received full state update from undo/redo', {
      userId: data.userId,
      tracks: data.state.tracks.length,
      regions: data.state.regions.length,
      markers: data.state.markers.length,
    });
    
    this.isSyncing = true;
    try {
      // Update tracks
      useTrackStore.getState().syncSetTracks(data.state.tracks);
      
      // Update regions
      useRegionStore.getState().syncSetRegions(data.state.regions);
      
      // Update markers
      useMarkerStore.getState().syncSetMarkers(data.state.markers);
      
      // Update project settings
      useProjectStore.getState().setBpm(data.state.bpm);
      useProjectStore.getState().setTimeSignature(data.state.timeSignature);
    } finally {
      this.isSyncing = false;
    }
  }
}

// Singleton instance
export const dawSyncService = new DAWSyncService();
