import * as Tone from 'tone';
import { getOrCreateGlobalMixer } from '@/features/audio/utils/effectsArchitecture';
import type { AudioRegion, Track } from '../types/daw';

const scheduledAudioSources = new Map<string, AudioBufferSourceNode[]>();

export const scheduleAudioRegionPlayback = async (region: AudioRegion, track: Track, tracks: Track[]): Promise<void> => {
  if (!region.audioBuffer) {
    return;
  }

  const audioContext = Tone.getContext().rawContext as AudioContext;
  if (!audioContext || audioContext.state === 'closed') {
    console.warn('Skipping audio playback scheduling because AudioContext is closed', {
      regionId: region.id,
    });
    return;
  }
  const bpm = Tone.Transport.bpm.value;
  const secondsPerBeat = 60 / bpm;
  const trimStartSeconds = (region.trimStart ?? 0) * secondsPerBeat;

  // Get current playhead position in beats
  const currentPlayheadBeats = Tone.Transport.seconds / secondsPerBeat;
  
  // Calculate effective volume based on solo/mute
  const hasSolo = tracks.some((t) => t.solo);
  let effectiveVolume = track.volume;
  
  if (hasSolo && !track.solo) {
    effectiveVolume = 0;
  }
  
  if (track.mute) {
    effectiveVolume = 0;
  }
  
  const totalLoops = region.loopEnabled ? region.loopIterations : 1;
  const regionDurationSeconds = region.length * secondsPerBeat;
  const sources: AudioBufferSourceNode[] = [];

  // Schedule each loop iteration
  for (let i = 0; i < totalLoops; i++) {
    const loopStartBeat = region.start + (i * region.length);
    const loopEndBeat = loopStartBeat + region.length;
    
    // Check if this loop iteration overlaps with current/future playhead
    if (loopEndBeat <= currentPlayheadBeats) {
      continue; // This loop is in the past, skip it
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = region.audioBuffer;
    
    // Create gain and pan nodes for volume/pan control
    const gainNode = audioContext.createGain();
    const panNode = audioContext.createStereoPanner();
    
    // Apply track volume (with solo/mute), region gain, and pan
    const regionGainDb = region.gain || 0;
    const regionGainMultiplier = Math.pow(10, regionGainDb / 20); // Convert dB to linear
    const baseGain = effectiveVolume * regionGainMultiplier;
    
    // Pan node (not automated)
    panNode.pan.value = track.pan;
    
    // Connect: source -> gain -> pan -> mixer channel (or destination fallback)
    source.connect(gainNode);
    gainNode.connect(panNode);
    let routedThroughMixer = false;
    try {
      const mixer = await getOrCreateGlobalMixer();
      if (!mixer.getChannel(track.id)) {
        mixer.createUserChannel(track.id, track.name ?? track.id);
      }
      mixer.routeInstrumentToChannel(panNode, track.id);
      routedThroughMixer = true;
    } catch (error) {
      console.warn('Failed to route audio track through mixer, using direct output', {
        trackId: track.id,
        error,
      });
    }

    if (!routedThroughMixer) {
      panNode.connect(audioContext.destination);
    }
    
    let bufferOffset = trimStartSeconds;
    let playDuration = regionDurationSeconds;
    
    // Calculate when this loop should start relative to current time
    const loopStartTimeInTransport = loopStartBeat * secondsPerBeat;
    const currentTransportTime = Tone.Transport.seconds;
    const timeUntilLoopStart = loopStartTimeInTransport - currentTransportTime;
    let scheduleTime = audioContext.currentTime + timeUntilLoopStart;
    
    // Determine which part of the region is playing
    const offsetBeats = currentPlayheadBeats > loopStartBeat ? currentPlayheadBeats - loopStartBeat : 0;
    const offsetSeconds = offsetBeats * secondsPerBeat;
    
    // If playhead is in the middle of this loop iteration or the schedule time is in the past
    // (which can happen for regions at beat 0 when transport just started)
    const isInPast = scheduleTime < audioContext.currentTime - 0.001;
    const isInMiddle = currentPlayheadBeats > loopStartBeat && currentPlayheadBeats < loopEndBeat;
    
    if (isInMiddle || isInPast) {
      // Calculate how far into the region we should start playing
      const actualOffsetBeats = Math.max(0, currentPlayheadBeats - loopStartBeat);
      const actualOffsetSeconds = actualOffsetBeats * secondsPerBeat;
      
      bufferOffset = trimStartSeconds + actualOffsetSeconds;
      playDuration = Math.max(0, regionDurationSeconds - actualOffsetSeconds);
      scheduleTime = audioContext.currentTime;
    }
    
    // Apply fade in/out envelopes using linear ramps (smoother and more reliable)
    const fadeInDuration = region.fadeInDuration || 0;
    const fadeOutDuration = region.fadeOutDuration || 0;
    const fadeInSeconds = fadeInDuration * secondsPerBeat;
    const fadeOutSeconds = fadeOutDuration * secondsPerBeat;
    
    // Cancel any existing automation and set up gain envelope
    gainNode.gain.cancelScheduledValues(scheduleTime);
    
    if (fadeInDuration > 0 && offsetSeconds < fadeInSeconds) {
      // Playback starts within or before fade in period
      const fadeInProgress = Math.max(0, offsetSeconds / fadeInSeconds);
      const startGain = baseGain * fadeInProgress;
      
      gainNode.gain.setValueAtTime(startGain, scheduleTime);
      
      // Continue fade in to full volume
      const remainingFadeTime = fadeInSeconds - offsetSeconds;
      gainNode.gain.linearRampToValueAtTime(baseGain, scheduleTime + remainingFadeTime);
      
      // Handle fade out if present
      if (fadeOutDuration > 0 && playDuration > remainingFadeTime + fadeOutSeconds) {
        const fadeOutStartTime = scheduleTime + playDuration - fadeOutSeconds;
        gainNode.gain.setValueAtTime(baseGain, fadeOutStartTime);
        gainNode.gain.linearRampToValueAtTime(0, scheduleTime + playDuration);
      }
    } else if (fadeOutDuration > 0 && offsetSeconds < regionDurationSeconds - fadeOutSeconds) {
      // Playback starts after fade in, before fade out
      gainNode.gain.setValueAtTime(baseGain, scheduleTime);
      
      // Apply fade out
      const fadeOutStartTime = scheduleTime + playDuration - fadeOutSeconds;
      if (fadeOutStartTime > scheduleTime) {
        gainNode.gain.setValueAtTime(baseGain, fadeOutStartTime);
        gainNode.gain.linearRampToValueAtTime(0, scheduleTime + playDuration);
      }
    } else if (fadeOutDuration > 0) {
      // Playback starts within fade out period
      const fadeOutProgress = (offsetSeconds - (regionDurationSeconds - fadeOutSeconds)) / fadeOutSeconds;
      const startGain = baseGain * (1 - fadeOutProgress);
      
      gainNode.gain.setValueAtTime(startGain, scheduleTime);
      gainNode.gain.linearRampToValueAtTime(0, scheduleTime + playDuration);
    } else {
      // No fades or after all fades: maintain baseGain
      gainNode.gain.setValueAtTime(baseGain, scheduleTime);
    }
    
    // Only schedule if we have duration to play
    if (playDuration > 0) {
      // Ensure schedule time is not in the past (with small tolerance for timing precision)
      const safeScheduleTime = Math.max(scheduleTime, audioContext.currentTime);
      
      // Add a small buffer (10ms) for regions starting immediately to ensure they play
      const finalScheduleTime = safeScheduleTime === audioContext.currentTime 
        ? audioContext.currentTime + 0.01 
        : safeScheduleTime;
      
      source.start(finalScheduleTime, bufferOffset, playDuration);
      sources.push(source);
    }
  }

  scheduledAudioSources.set(region.id, sources);
};

export const stopAudioRegionPlayback = (regionId: string): void => {
  const sources = scheduledAudioSources.get(regionId);
  if (sources) {
    sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Already stopped, ignore
      }
    });
    scheduledAudioSources.delete(regionId);
  }
};

export const stopAllAudioPlayback = (): void => {
  scheduledAudioSources.forEach((_, regionId) => {
    stopAudioRegionPlayback(regionId);
  });
  scheduledAudioSources.clear();
};

