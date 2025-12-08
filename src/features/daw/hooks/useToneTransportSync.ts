import { useEffect } from 'react';
import * as Tone from 'tone';

import { initializeAudioEngine } from '../utils/audioEngine';
import { useProjectStore } from '../stores/projectStore';

export const useToneTransportSync = () => {
  const bpm = useProjectStore((state) => state.bpm);
  const timeSignature = useProjectStore((state) => state.timeSignature);
  const transportState = useProjectStore((state) => state.transportState);
  const loop = useProjectStore((state) => state.loop);
  const isMixingDown = useProjectStore((state) => state.isMixingDown);
  const playhead = useProjectStore((state) => state.playhead);
  const setTransportState = useProjectStore((state) => state.setTransportState);
  const setPlayhead = useProjectStore((state) => state.setPlayhead);

  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    Tone.Transport.timeSignature = [timeSignature.numerator, timeSignature.denominator];
  }, [timeSignature]);
  
  // Sync loop settings with Tone.Transport
  // Disable looping during mixdown to ensure the export completes
  useEffect(() => {
    // Always disable looping during mixdown
    if (isMixingDown) {
      Tone.Transport.loop = false;
      return;
    }
    
    Tone.Transport.loop = loop.enabled;
    
    if (loop.enabled) {
      // Convert beats to Tone.js time format (bars:beats:sixteenths)
      const beatsInBar = timeSignature.numerator;
      
      const startBars = Math.floor(loop.start / beatsInBar);
      const startBeats = loop.start % beatsInBar;
      Tone.Transport.loopStart = `${startBars}:${startBeats}:0`;
      
      const endBars = Math.floor(loop.end / beatsInBar);
      const endBeats = loop.end % beatsInBar;
      Tone.Transport.loopEnd = `${endBars}:${endBeats}:0`;
    }
  }, [loop.enabled, loop.start, loop.end, timeSignature.numerator, isMixingDown]);

  useEffect(() => {
    const handleStop = () => {
      setTransportState('stopped');
      setPlayhead(0);
    };

    // Only listen to stop event to reset playhead
    // Don't listen to start/pause to avoid overriding recording state
    Tone.Transport.on('stop', handleStop);

    return () => {
      Tone.Transport.off('stop', handleStop);
    };
  }, [setPlayhead, setTransportState]);

  useEffect(() => {
    if ((transportState === 'playing' || transportState === 'recording') && Tone.Transport.state !== 'started') {
      initializeAudioEngine().then(() => {
        if (Tone.Transport.state !== 'started') {
          // Don't snap to loop start during mixdown
          const shouldSnapToLoopStart = loop.enabled && !isMixingDown && (transportState === 'playing' || transportState === 'recording');

          if (shouldSnapToLoopStart) {
            const beatsInBar = timeSignature.numerator || 4;
            const startBars = Math.floor(loop.start / beatsInBar);
            const startBeats = loop.start % beatsInBar;
            Tone.Transport.position = `${startBars}:${startBeats}:0`;

            if (playhead !== loop.start) {
              setPlayhead(loop.start);
            }
          }

          Tone.Transport.start();
        }
      });
    } else if (transportState === 'paused' && Tone.Transport.state === 'started') {
      Tone.Transport.pause();
    } else if (transportState === 'stopped' && Tone.Transport.state !== 'stopped') {
      Tone.Transport.stop(0);
      Tone.Transport.position = 0;
    }
  }, [transportState, loop.enabled, loop.start, playhead, timeSignature.numerator, isMixingDown, setPlayhead]);
};

