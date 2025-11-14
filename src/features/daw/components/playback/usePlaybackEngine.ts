import { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';

import { initializeAudioEngine, scheduleRegionPlayback } from '../../utils/audioEngine';
import { scheduleAudioRegionPlayback, stopAllAudioPlayback } from '../../utils/audioPlayback';
import { useProjectStore } from '../../stores/projectStore';
import { useRegionStore } from '../../stores/regionStore';
import { useTrackStore } from '../../stores/trackStore';

export const usePlaybackEngine = () => {
  const transportState = useProjectStore((state) => state.transportState);
  const setPlayhead = useProjectStore((state) => state.setPlayhead);
  const tracks = useTrackStore((state) => state.tracks);
  const regions = useRegionStore((state) => state.regions);

  const partsRef = useRef<Map<string, Tone.Part>>(new Map());
  const animationFrameRef = useRef<number | null>(null);

  const clearParts = useCallback(() => {
    partsRef.current.forEach((part) => {
      try {
        // Stop with explicit time 0 to avoid negative time errors
        part.stop(0);
        part.dispose();
      } catch (error) {
        console.warn('Error disposing part:', error);
      }
    });
    partsRef.current.clear();
    stopAllAudioPlayback();
    Tone.Transport.cancel(0);
  }, []);

  const scheduleParts = useCallback(async () => {
    await initializeAudioEngine();
    clearParts();

    const soloTrackIds = tracks.filter((track) => track.solo && !track.mute).map((track) => track.id);
    const shouldPlayTrack = (trackId: string) => {
      const track = tracks.find((item) => item.id === trackId);
      if (!track) {
        return false;
      }
      if (track.mute) {
        return false;
      }
      if (soloTrackIds.length > 0) {
        return track.solo;
      }
      return true;
    };

    await Promise.all(
      regions.map(async (region) => {
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
            return;
          }
          const part = await scheduleRegionPlayback(track, region);
          if (part) {
            partsRef.current.set(region.id, part);
          }
        } else if (region.type === 'audio') {
          // Schedule audio regions
          await scheduleAudioRegionPlayback(region, track, tracks);
        }
      })
    );
  }, [clearParts, regions, tracks]);

  useEffect(() => {
    if (transportState === 'playing' || transportState === 'recording') {
      scheduleParts().then(() => {
        // Ensure Transport starts after scheduling
        if (Tone.Transport.state !== 'started') {
          Tone.Transport.start();
        }
      });
      
      // Start playhead update loop
      const updatePlayhead = () => {
        if (Tone.Transport.state === 'started') {
          const currentBeat = Tone.Transport.ticks / Tone.Transport.PPQ;
          setPlayhead(currentBeat);
          animationFrameRef.current = requestAnimationFrame(updatePlayhead);
        } else {
          // Keep checking if transport starts
          animationFrameRef.current = requestAnimationFrame(updatePlayhead);
        }
      };
      updatePlayhead();
    } else {
      clearParts();
      
      // Stop playhead update loop
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      clearParts();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [clearParts, scheduleParts, setPlayhead, transportState]);

  useEffect(() => {
    if (transportState === 'playing' || transportState === 'recording') {
      scheduleParts();
    }
  }, [regions, scheduleParts, tracks, transportState]);
};

