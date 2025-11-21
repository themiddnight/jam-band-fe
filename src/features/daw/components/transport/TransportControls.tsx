import { useCallback, useEffect } from 'react';
import * as Tone from 'tone';

import { initializeAudioEngine } from '../../utils/audioEngine';
import { useProjectStore } from '../../stores/projectStore';

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

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? '⌘' : 'Ctrl';

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = isMac ? e.metaKey : e.ctrlKey;

      if (isMod && e.key === ',') {
        e.preventDefault();
        handleBackToStart();
      } else if (isMod && e.key === 'p') {
        e.preventDefault();
        handlePlayPause();
      } else if (isMod && e.key === 'r') {
        e.preventDefault();
        handleRecordToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBackToStart, handlePlayPause, handleRecordToggle, isMac]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg bg-base-200 px-2 py-1 shadow-inner">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={handleBackToStart}
            className="btn btn-outline btn-xs"
            title='Return to start'
            aria-label="Return to start"
          >
            <kbd className="kbd kbd-xs">{`${modifierKey}+,`}</kbd>
            ⏮
          </button>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={handlePlayPause}
            className={`btn btn-xs ${isPlaying ? 'btn-primary' : 'btn-success'}`}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <kbd className="kbd kbd-xs">{`${modifierKey}+P`}</kbd>
            <PlayIcon isPlaying={isPlaying} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleStop}
          className="btn btn-outline btn-xs btn-ghost"
          title='Stop'
          aria-label="Stop"
        >
          ■
        </button>
      </div>
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={handleRecordToggle}
          className={`btn btn-outline btn-xs ${isRecording ? 'btn-error text-white' : 'btn-ghost'}`}
          title='Record'
          aria-label="Record"
        >
          <kbd className="kbd kbd-xs">{`${modifierKey}+R`}</kbd>
          <p className="text-red-500">
            {isRecording ? '●' : '○'}
          </p>
        </button>
      </div>
    </div>
  );
};

