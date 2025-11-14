import { useCallback } from 'react';
import * as Tone from 'tone';

import { initializeAudioEngine } from '../utils/audioEngine';
import { useProjectStore } from '../stores/projectStore';

const PlayIcon = ({ isPlaying }: { isPlaying: boolean }) => (
  <span className="text-lg leading-none">
    {isPlaying ? '⏸' : '▶'}
  </span>
);

export const TransportControls = () => {
  const transportState = useProjectStore((state) => state.transportState);
  const isRecording = useProjectStore((state) => state.isRecording);
  const setTransportState = useProjectStore((state) => state.setTransportState);
  const setPlayhead = useProjectStore((state) => state.setPlayhead);
  const toggleRecording = useProjectStore((state) => state.toggleRecording);

  const handlePlayPause = useCallback(async () => {
    await initializeAudioEngine();
    if (transportState === 'playing' || transportState === 'recording') {
      Tone.Transport.pause();
      setTransportState('paused');
    } else {
      setTransportState(isRecording ? 'recording' : 'playing');
    }
  }, [isRecording, setTransportState, transportState]);

  const handleStop = useCallback(async () => {
    await initializeAudioEngine();
    Tone.Transport.stop(0);
    Tone.Transport.position = '0:0:0';
    setTransportState('stopped');
    setPlayhead(0);
    if (isRecording) {
      toggleRecording(false);
    }
  }, [isRecording, setPlayhead, setTransportState, toggleRecording]);

  const handleBackToStart = useCallback(async () => {
    await initializeAudioEngine();
    Tone.Transport.position = '0:0:0';
    setPlayhead(0);
  }, [setPlayhead]);

  const handleRecordToggle = useCallback(async () => {
    await initializeAudioEngine();
    toggleRecording();
    if (transportState !== 'playing' && transportState !== 'recording') {
      setTransportState('recording');
    }
  }, [setTransportState, toggleRecording, transportState]);

  const isPlaying = transportState === 'playing' || transportState === 'recording';

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg bg-base-200 px-2 py-1 shadow-inner">
        <button
          type="button"
          onClick={handleBackToStart}
          className="btn btn-xs btn-ghost"
          aria-label="Return to start"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={handlePlayPause}
          className={`btn btn-xs ${isPlaying ? 'btn-primary' : 'btn-success'}`}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <PlayIcon isPlaying={isPlaying} />
        </button>
        <button
          type="button"
          onClick={handleStop}
          className="btn btn-xs btn-ghost"
          aria-label="Stop"
        >
          ■
        </button>
      </div>
      <button
        type="button"
        onClick={handleRecordToggle}
        className={`btn btn-xs ${isRecording ? 'btn-error text-white' : 'btn-ghost'}`}
        aria-label="Record"
      >
        ●
      </button>
    </div>
  );
};

