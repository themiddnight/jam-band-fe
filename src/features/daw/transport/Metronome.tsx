import { useEffect, useRef } from 'react';

import { useProjectStore } from '../stores/projectStore';

export const Metronome = () => {
  const isMetronomeEnabled = useProjectStore((state) => state.isMetronomeEnabled);
  const toggleMetronome = useProjectStore((state) => state.toggleMetronome);
  const transportState = useProjectStore((state) => state.transportState);
  const timeSignature = useProjectStore((state) => state.timeSignature);
  const bpm = useProjectStore((state) => state.bpm);
  const playhead = useProjectStore((state) => state.playhead);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const nextBeatTimeRef = useRef<number>(0);
  const beatCountRef = useRef<number>(0);
  const latestPlayheadRef = useRef<number>(playhead);

  useEffect(() => {
    latestPlayheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    const shouldPlay = isMetronomeEnabled && (transportState === 'playing' || transportState === 'recording');
    
    if (shouldPlay) {
      // Initialize Web Audio API context
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      const audioContext = audioContextRef.current;
      
      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Calculate beat interval in seconds based on denominator
      // BPM is always in quarter notes per minute, so we adjust based on denominator
      const quarterNoteSeconds = 60 / bpm;
      const safeDenominator = timeSignature.denominator || 4;
      const secondsPerBeat = quarterNoteSeconds * (4 / safeDenominator);
      const beatsPerBar = Math.max(1, timeSignature.numerator);
      
      // Schedule the next beat
      const scheduleMetronomeClick = () => {
        const currentTime = audioContext.currentTime;
        
        // Schedule ahead by 100ms to prevent timing drift
        const scheduleAheadTime = 0.1;
        
        while (nextBeatTimeRef.current < currentTime + scheduleAheadTime) {
          const clickTime = nextBeatTimeRef.current;
          
          // Create sawtooth oscillator
          const oscillator = audioContext.createOscillator();
          oscillator.type = 'sawtooth';
          oscillator.frequency.value = 800; // 800 Hz sawtooth
          
          // Create gain node for envelope
          const gainNode = audioContext.createGain();
          gainNode.gain.setValueAtTime(0, clickTime);
          gainNode.gain.linearRampToValueAtTime(0.3, clickTime + 0.001); // Fast attack
          gainNode.gain.exponentialRampToValueAtTime(0.01, clickTime + 0.05); // Quick decay
          
          // Connect nodes
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Play the click
          oscillator.start(clickTime);
          oscillator.stop(clickTime + 0.05);
          
          // Move to next beat
          nextBeatTimeRef.current += secondsPerBeat;
          beatCountRef.current = (beatCountRef.current + 1) % beatsPerBar;
        }
      };
      
      // Initialize next beat time
      if (nextBeatTimeRef.current === 0) {
        const playheadBeats = latestPlayheadRef.current ?? 0;
        const playheadWithinBar = beatsPerBar ? playheadBeats % beatsPerBar : 0;
        const fractionalBeat = playheadWithinBar - Math.floor(playheadWithinBar);
        const beatsUntilNext = fractionalBeat <= 1e-6 ? 0 : 1 - fractionalBeat;
        nextBeatTimeRef.current = audioContext.currentTime + beatsUntilNext * secondsPerBeat;
        const nextBeatIndex = fractionalBeat <= 1e-6 ? Math.floor(playheadWithinBar) : Math.floor(playheadWithinBar) + 1;
        beatCountRef.current = ((nextBeatIndex % beatsPerBar) + beatsPerBar) % beatsPerBar;
      }
      
      // Schedule clicks in a loop
      scheduleMetronomeClick();
      intervalRef.current = window.setInterval(scheduleMetronomeClick, 25); // Check every 25ms

    } else {
      // Stop metronome
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      nextBeatTimeRef.current = 0;
      beatCountRef.current = 0;
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isMetronomeEnabled, transportState, bpm, timeSignature]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => toggleMetronome()}
      className={`btn btn-xs sm:btn-sm ${isMetronomeEnabled ? 'btn-primary' : 'btn-ghost'}`}
    >
      <span className="hidden sm:inline">{isMetronomeEnabled ? 'Metronome On' : 'Metronome Off'}</span>
      <span className="sm:hidden">{isMetronomeEnabled ? 'Met On' : 'Met Off'}</span>
    </button>
  );
};

