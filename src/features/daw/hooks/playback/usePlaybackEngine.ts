import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

import {
  scheduleAudioRegionPlayback,
  stopAllAudioPlayback,
  stopAudioRegionPlayback,
} from '../../utils/audioPlayback';
import { scheduleMidiRegionPlayback, type ScheduledMidiPlayback } from '../../utils/midiPlaybackScheduler';
import { useProjectStore } from '../../stores/projectStore';
import { useRegionStore } from '../../stores/regionStore';
import { useTrackStore } from '../../stores/trackStore';
import { usePerformanceStore } from '../../stores/performanceStore';
import type { Track } from '../../types/daw';

const buildSchedulingTrackMeta = (sourceTracks: Track[]) =>
  sourceTracks.map((track) => ({
    id: track.id,
    mute: track.mute,
    solo: track.solo,
    type: track.type,
    instrumentId: track.instrumentId,
    instrumentCategory: track.instrumentCategory,
  }));

const toSchedulingSignature = (
  meta: ReturnType<typeof buildSchedulingTrackMeta>,
) =>
  meta
    .map((item) =>
      `${item.id}:${item.type}:${item.instrumentId ?? ''}:${item.instrumentCategory ?? ''}:${item.mute ? '1' : '0'}:${item.solo ? '1' : '0'}`,
    )
    .join('|');

export const usePlaybackEngine = () => {
  const transportState = useProjectStore((state) => state.transportState);
  const bpm = useProjectStore((state) => state.bpm);
  const timeSignature = useProjectStore((state) => state.timeSignature);
  const loop = useProjectStore((state) => state.loop);
  const isMixingDown = useProjectStore((state) => state.isMixingDown);
  const setPlayhead = useProjectStore((state) => state.setPlayhead);
  const tracks = useTrackStore((state) => state.tracks);
  const regions = useRegionStore((state) => state.regions);

  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const schedulingTrackMetaRef = useRef(buildSchedulingTrackMeta(tracks));
  const schedulingTrackSignatureRef = useRef(
    toSchedulingSignature(schedulingTrackMetaRef.current),
  );
  const [schedulingTrackMetaVersion, setSchedulingTrackMetaVersion] = useState(0);

  useEffect(() => {
    const nextMeta = buildSchedulingTrackMeta(tracks);
    const nextSignature = toSchedulingSignature(nextMeta);
    if (schedulingTrackSignatureRef.current !== nextSignature) {
      schedulingTrackMetaRef.current = nextMeta;
      schedulingTrackSignatureRef.current = nextSignature;
      setSchedulingTrackMetaVersion((version) => version + 1);
    }
  }, [tracks]);

  const midiPlaybackRef = useRef<Map<string, ScheduledMidiPlayback>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const toneConfiguredRef = useRef(false);
  const schedulingVersionRef = useRef(0);

  const clearParts = useCallback(async (skipNoteCleanup = false) => {
    if (!skipNoteCleanup) {
      // Clean up all MIDI playback (including sustain reset and stopping notes)
      const cleanupPromises = Array.from(midiPlaybackRef.current.values()).map(({ cleanup }) =>
        cleanup().catch((error) => {
          console.error('Failed to clean up scheduled MIDI playback', error);
        })
      );
      await Promise.all(cleanupPromises);
    }
    midiPlaybackRef.current.clear();
    
    // Stop all audio playback
    stopAllAudioPlayback();
    
    // Clear all scheduled transport events
    Tone.Transport.cancel(0);
  }, []);

  const cancelAndClearParts = useCallback(async () => {
    schedulingVersionRef.current += 1;
    await clearParts();
  }, [clearParts]);

  const ensureToneReady = useCallback(async () => {
    if (!toneConfiguredRef.current) {
      try {
        // Get lookahead from performance settings
        const audioLookahead = usePerformanceStore.getState().settings.audioLookahead;
        Tone.context.lookAhead = audioLookahead;
        console.log(`🎵 Audio lookahead set to ${audioLookahead}s`);
        toneConfiguredRef.current = true;
      } catch (error) {
        console.warn('Could not configure Tone.js context:', error);
      }
    }

    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
  }, []);

  const scheduleParts = useCallback(async (isLoopReschedule = false) => {
    const scheduleVersion = ++schedulingVersionRef.current;
    await ensureToneReady();
    // When rescheduling for a loop, skip note cleanup to avoid stopping currently playing notes
    await clearParts(isLoopReschedule);

    if (scheduleVersion !== schedulingVersionRef.current) {
      return;
    }

    const tracks = tracksRef.current;
    const trackMeta = schedulingTrackMetaRef.current;
    const soloTrackIds = trackMeta.filter((meta) => meta.solo && !meta.mute).map((meta) => meta.id);

    const effectiveBpm = typeof bpm === 'number' && bpm > 0 ? bpm : Tone.Transport.bpm.value || 120;
    Tone.Transport.bpm.value = effectiveBpm;
    const currentBeat = Tone.Transport.ticks / Tone.Transport.PPQ;
    const isTransportStarted = Tone.Transport.state === 'started';

    const currentPlayhead = useProjectStore.getState().playhead;

    // During mixdown, ignore looping - use current beat or playhead
    const anchorBeat = isTransportStarted
      ? (loop.enabled && !isMixingDown)
        ? loop.start
        : currentBeat
      : currentPlayhead;

    if (timeSignature) {
      const { numerator, denominator } = timeSignature;
      if (numerator && denominator) {
        Tone.Transport.timeSignature = [numerator, denominator];
      }
    }

    const shouldPlayTrack = (trackId: string) => {
      const trackMetaEntry = trackMeta.find((item) => item.id === trackId);
      if (!trackMetaEntry) {
        return false;
      }
      if (trackMetaEntry.mute) {
        return false;
      }
      if (soloTrackIds.length > 0) {
        return trackMetaEntry.solo;
      }
      return true;
    };

    await Promise.all(
      regions.map(async (region) => {
        if (scheduleVersion !== schedulingVersionRef.current) {
          return;
        }
        if (!shouldPlayTrack(region.trackId)) {
          return;
        }
        const track = tracks.find((item) => item.id === region.trackId);
        if (!track) {
          return;
        }

        if (region.type === 'midi') {
          // Schedule MIDI regions
          if (!region.notes.length) {
            console.log('[PlaybackEngine] Skip empty MIDI region', region.id);
            return;
          }
          console.log('[PlaybackEngine] Scheduling MIDI region', {
            regionId: region.id,
            trackId: track.id,
            noteCount: region.notes.length,
            start: region.start,
            length: region.length,
            isLoopReschedule,
          });
          const playback = await scheduleMidiRegionPlayback(track, region, {
            transportBpm: effectiveBpm,
            anchorBeat,
          });
          if (scheduleVersion !== schedulingVersionRef.current) {
            await playback?.cleanup();
            return;
          }
          if (playback) {
            midiPlaybackRef.current.set(region.id, playback);
            console.log('[PlaybackEngine] Scheduled MIDI region', {
              regionId: region.id,
              hasCleanup: typeof playback.cleanup === 'function',
            });
          }
        } else if (region.type === 'audio') {
          // Schedule audio regions
          await scheduleAudioRegionPlayback(region, track);
          if (scheduleVersion !== schedulingVersionRef.current) {
            stopAudioRegionPlayback(region.id);
            return;
          }
        }
      })
    );
  }, [bpm, clearParts, ensureToneReady, isMixingDown, loop.enabled, loop.start, regions, timeSignature]);

  useEffect(() => {
    if (transportState === 'playing' || transportState === 'recording') {
      scheduleParts().then(() => {
        // Ensure Transport starts after scheduling
        const nextState = useProjectStore.getState().transportState;
        if (
          (nextState === 'playing' || nextState === 'recording') &&
          Tone.Transport.state !== 'started'
        ) {
          Tone.Transport.start();
        }
      });

      // Start playhead update loop
      const updatePlayhead = () => {
        // Check if we should still be running based on transportState
        const currentTransportState = useProjectStore.getState().transportState;
        const shouldContinue = currentTransportState === 'playing' || currentTransportState === 'recording';
        
        if (shouldContinue) {
          // Update playhead if transport is actually started
          if (Tone.Transport.state === 'started') {
            const currentBeat = Tone.Transport.ticks / Tone.Transport.PPQ;
            setPlayhead(currentBeat);
          }
          // Continue loop as long as we're in playing/recording state
          animationFrameRef.current = requestAnimationFrame(updatePlayhead);
        } else {
          // Transport stopped, exit loop
          animationFrameRef.current = null;
        }
      };
      updatePlayhead();
    } else {
      // Stop playback - clear parts and reset sustain
      void cancelAndClearParts();

      // Stop playhead update loop
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      void cancelAndClearParts();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [cancelAndClearParts, scheduleParts, setPlayhead, transportState]);

  useEffect(() => {
    if (transportState === 'playing' || transportState === 'recording') {
      scheduleParts();
    }
  }, [regions, scheduleParts, schedulingTrackMetaVersion, transportState]);

  useEffect(() => {
    if (transportState === 'playing' || transportState === 'recording') {
      scheduleParts();
    }
  }, [loop.enabled, loop.end, loop.start, scheduleParts, transportState]);

  useEffect(() => {
    const handleLoop = () => {
      // Ignore looping during mixdown
      if (!loop.enabled || isMixingDown) {
        return;
      }
      // When transport loops back to the start, reschedule all parts
      // Pass true to indicate this is a loop reschedule, which skips stopping currently playing notes
      console.log('[PlaybackEngine] Transport loop event - rescheduling for next iteration');
      
      scheduleParts(true).catch((error) => {
        console.error('Failed to reschedule playback on loop', error);
      });
    };

    Tone.Transport.on('loop', handleLoop);

    return () => {
      Tone.Transport.off('loop', handleLoop);
    };
  }, [loop.enabled, isMixingDown, scheduleParts]);

  // Update audio lookahead when performance settings change
  useEffect(() => {
    const audioLookahead = usePerformanceStore.getState().settings.audioLookahead;
    try {
      Tone.context.lookAhead = audioLookahead;
      console.log(`🎵 Audio lookahead updated to ${audioLookahead}s`);
    } catch (error) {
      console.warn('Could not update Tone.js lookahead:', error);
    }
  }, []);

  // Subscribe to performance settings changes
  useEffect(() => {
    const unsubscribe = usePerformanceStore.subscribe((state) => {
      try {
        Tone.context.lookAhead = state.settings.audioLookahead;
        console.log(`🎵 Audio lookahead updated to ${state.settings.audioLookahead}s`);
      } catch (error) {
        console.warn('Could not update Tone.js lookahead:', error);
      }
    });

    return unsubscribe;
  }, []);
};

