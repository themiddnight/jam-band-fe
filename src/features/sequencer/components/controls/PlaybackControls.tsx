import { memo } from "react";
import { useTouchEvents } from "@/features/ui";
import type { CSSProperties } from "react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  isRecording: boolean;
  softStopRequested: boolean;
  waitingForMetronome: boolean;
  onPlayPause: () => void;
  onHardStop: () => void;
  onToggleRecording: () => void;
}

export const PlaybackControls = memo(({
  isPlaying,
  isPaused,
  isRecording,
  softStopRequested,
  waitingForMetronome,
  onPlayPause,
  onHardStop,
  onToggleRecording,
}: PlaybackControlsProps) => {
  const getPlaybackButtonInfo = () => {
    if (waitingForMetronome) {
      return { text: "⏳", style: "btn-warning loading", disabled: true };
    }
    if (isPlaying) {
      if (softStopRequested) {
        return { text: "⏳", style: "btn-warning", disabled: false };
      }
      return { text: "⏹", style: "btn-secondary", disabled: false };
    }
    if (isPaused) {
      return { text: "▶", style: "btn-primary", disabled: false };
    }
    return { text: "▶", style: "btn-primary", disabled: false };
  };

  const playbackInfo = getPlaybackButtonInfo();

  const playButtonTouchHandlers = useTouchEvents({
    onPress: onPlayPause,
    onRelease: () => {},
    isPlayButton: true,
  });

  const hardStopTouchHandlers = useTouchEvents({
    onPress: onHardStop,
    onRelease: () => {},
    isPlayButton: true,
  });

  const recordTouchHandlers = useTouchEvents({
    onPress: onToggleRecording,
    onRelease: () => {},
    isPlayButton: true,
  });

  const mobileButtonStyle: CSSProperties = {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    WebkitTouchCallout: "none" as const,
    WebkitUserSelect: "none",
    userSelect: "none",
  };

  return (
    <div className="flex items-center gap-1">
      <button
        className={`btn btn-sm ${playbackInfo.style} touch-manipulation`}
        onMouseDown={onPlayPause}
        ref={playButtonTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
        disabled={playbackInfo.disabled}
        style={mobileButtonStyle}
        title={
          waitingForMetronome
            ? "Waiting for metronome..."
            : isPlaying
              ? softStopRequested
                ? "Click to cancel soft-stop"
                : "Soft Stop (wait for sequence end)"
              : "Play"
        }
      >
        {playbackInfo.text}
      </button>

      <button
        className="btn btn-sm btn-outline touch-manipulation"
        onMouseDown={onHardStop}
        ref={hardStopTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
        disabled={!isPlaying && !isPaused}
        style={mobileButtonStyle}
        title="Hard Stop (immediate stop with note-off)"
      >
        ⏹
      </button>

      <button
        className={`btn btn-sm touch-manipulation ${isRecording ? "btn-error" : "btn-outline"}`}
        onMouseDown={onToggleRecording}
        ref={recordTouchHandlers.ref as React.RefObject<HTMLButtonElement>}
        style={mobileButtonStyle}
        title={isRecording ? "Stop Recording" : "Start Recording"}
      >
        {isRecording ? "●" : "○"}
      </button>
    </div>
  );
});

PlaybackControls.displayName = "PlaybackControls";