import {
  BRUSHING_TIME_STEPS,
  BRUSHING_TIME_LABELS,
} from "../../../instruments";
import { getKeyDisplayName } from "@/shared/utils/displayUtils";
import { useEffect } from "react";
import type { ReactNode } from "react";

interface ControlConfig {
  velocity?: boolean;
  octave?: boolean;
  sustain?: boolean;
  chordVoicing?: boolean;
  brushingSpeed?: boolean;
}

export interface BaseInstrumentProps {
  // Common props for both instruments
  title: string;
  shortcuts: Record<string, { key: string }> | any;

  // Mode controls
  modeControls?: ReactNode;

  // Main content
  children: ReactNode;

  // Control configuration
  controlConfig: ControlConfig;

  // Control values and setters
  velocity?: number;
  setVelocity?: (velocity: number) => void;
  currentOctave?: number;
  setCurrentOctave?: (octave: number) => void;
  sustain?: boolean;
  setSustain?: (sustain: boolean) => void;
  sustainToggle?: boolean;
  setSustainToggle?: (toggle: boolean) => void;
  onStopSustainedNotes?: () => void;
  hasSustainedNotes?: boolean;
  chordVoicing?: number;
  setChordVoicing?: (voicing: number) => void;
  brushingSpeed?: number;
  setBrushingSpeed?: (speed: number) => void;

  // Additional controls
  additionalControls?: ReactNode;

  // Keyboard event handlers
  handleKeyDown?: (event: KeyboardEvent) => void;
  handleKeyUp?: (event: KeyboardEvent) => void;
}

export default function BaseInstrument({
  title,
  shortcuts,
  modeControls,
  children,
  controlConfig,
  velocity,
  setVelocity,
  currentOctave,
  setCurrentOctave,
  sustain,
  setSustain,
  sustainToggle,
  setSustainToggle,
  onStopSustainedNotes,
  hasSustainedNotes,
  chordVoicing,
  setChordVoicing,
  brushingSpeed,
  setBrushingSpeed,
  additionalControls,
  handleKeyDown,
  handleKeyUp,
}: BaseInstrumentProps) {
  // Set up keyboard event listeners if provided
  useEffect(() => {
    if (handleKeyDown && handleKeyUp) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }
  }, [handleKeyDown, handleKeyUp]);

  return (
    <div className="card bg-base-100 shadow-lg w-full ">
      <div className="card-body p-2 sm:p-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-1">
          <div className="flex items-center gap-2">
            <h3 className="card-title text-sm sm:text-base">{title}</h3>
          </div>

          <div className="flex gap-2 sm:gap-3 flex-wrap justify-start sm:justify-end w-full sm:w-auto">{modeControls}</div>
        </div>

        <div className="bg-neutral p-2 sm:p-4 rounded-lg overflow-auto touch-none">
          {children}
        </div>

        <div className="flex justify-center items-center gap-2 sm:gap-3 flex-wrap mt-1">
          {/* Sustain Controls */}
          {controlConfig.sustain && sustain !== undefined && setSustain && (
            <div className="join">
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (sustainToggle) {
                    // In toggle mode: pressing stops sustaining and stops sounds
                    setSustain(false);
                    onStopSustainedNotes?.();
                  } else {
                    // Normal mode: pressing starts sustaining
                    setSustain(true);
                  }
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  if (sustainToggle) {
                    // In toggle mode: releasing resumes sustaining
                    setSustain(true);
                  } else {
                    // Normal mode: releasing stops sustaining
                    setSustain(false);
                    onStopSustainedNotes?.();
                  }
                }}
                onMouseLeave={() => {
                  if (sustainToggle) {
                    // In toggle mode: mouse leave resumes sustaining
                    setSustain(true);
                  } else {
                    // Normal mode: mouse leave stops sustaining
                    setSustain(false);
                    onStopSustainedNotes?.();
                  }
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (sustainToggle) {
                    // In toggle mode: touch start stops sustaining and stops sounds
                    setSustain(false);
                    onStopSustainedNotes?.();
                  } else {
                    // Normal mode: touch start starts sustaining
                    setSustain(true);
                  }
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  if (sustainToggle) {
                    // In toggle mode: touch end resumes sustaining
                    setSustain(true);
                  } else {
                    // Normal mode: touch end stops sustaining
                    setSustain(false);
                    onStopSustainedNotes?.();
                  }
                }}
                onTouchCancel={(e) => {
                  e.preventDefault();
                  if (sustainToggle) {
                    // In toggle mode: touch cancel resumes sustaining
                    setSustain(true);
                  } else {
                    // Normal mode: touch cancel stops sustaining
                    setSustain(false);
                    onStopSustainedNotes?.();
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                }}
                className={`btn btn-xs sm:btn-sm join-item touch-manipulation select-none ${
                  (sustain && !sustainToggle) ||
                  (sustainToggle && hasSustainedNotes)
                    ? "btn-warning"
                    : "btn-outline"
                }`}
                style={{
                  WebkitTapHighlightColor: "transparent",
                  WebkitTouchCallout: "none",
                  WebkitUserSelect: "none",
                  touchAction: "manipulation",
                }}
              >
                <span className="hidden sm:inline">Sustain</span>
                <span className="sm:hidden">Sus</span>{" "}
                <kbd className="kbd kbd-xs hidden sm:inline">
                  {getKeyDisplayName(shortcuts.sustain?.key || "")}
                </kbd>
              </button>
              {setSustainToggle && (
                <button
                  onClick={() => {
                    setSustainToggle(!sustainToggle);
                  }}
                  className={`btn btn-xs sm:btn-sm join-item touch-manipulation ${
                    sustainToggle ? "btn-success" : "btn-outline"
                  }`}
                >
                  {sustainToggle ? "🔒" : "🔓"}
                  <kbd className="kbd kbd-xs hidden sm:inline">
                    {getKeyDisplayName(shortcuts.sustainToggle?.key || "")}
                  </kbd>
                </button>
              )}
            </div>
          )}

          {/* Velocity Control */}
          {controlConfig.velocity && velocity !== undefined && setVelocity && (
            <div className="flex items-center gap-1 sm:gap-2">
              <label className="label py-1">
                <span className="label-text text-xs sm:text-sm">
                  <span className="hidden sm:inline">Velocity: </span>
                  <span className="sm:hidden">Vel: </span>
                  {Math.round(velocity * 9)}
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="9"
                value={Math.round(velocity * 9)}
                onChange={(e) => setVelocity(parseInt(e.target.value) / 9)}
                className="range range-xs sm:range-sm range-primary w-16 sm:w-20"
              />
            </div>
          )}

          {/* Octave Control */}
          {controlConfig.octave &&
            currentOctave !== undefined &&
            setCurrentOctave && (
              <div className="flex items-center gap-1 sm:gap-2">
                <label className="label py-1">
                  <span className="label-text text-xs sm:text-sm">
                    <span className="hidden sm:inline">Octave: </span>
                    <span className="sm:hidden">Oct: </span>
                    {currentOctave}
                  </span>
                </label>
                <div className="join">
                  <button
                    onClick={() =>
                      setCurrentOctave(Math.max(0, currentOctave - 1))
                    }
                    className="btn btn-xs sm:btn-sm btn-outline join-item touch-manipulation"
                  >
                    -{" "}
                    <kbd className="kbd kbd-xs hidden sm:inline">
                      {getKeyDisplayName(shortcuts.octaveDown?.key || "")}
                    </kbd>
                  </button>
                  <button
                    onClick={() =>
                      setCurrentOctave(Math.min(8, currentOctave + 1))
                    }
                    className="btn btn-xs sm:btn-sm btn-outline join-item touch-manipulation"
                  >
                    +{" "}
                    <kbd className="kbd kbd-xs hidden sm:inline">
                      {getKeyDisplayName(shortcuts.octaveUp?.key || "")}
                    </kbd>
                  </button>
                </div>
              </div>
            )}

          {/* Chord Voicing Control */}
          {controlConfig.chordVoicing &&
            chordVoicing !== undefined &&
            setChordVoicing && (
              <div className="flex items-center gap-1 sm:gap-2">
                <label className="label py-1">
                  <span className="label-text text-xs sm:text-sm">
                    <span className="hidden sm:inline">Voicing: </span>
                    <span className="sm:hidden">Voi: </span>
                    {chordVoicing}
                  </span>
                </label>
                <div className="join">
                  <button
                    onClick={() =>
                      setChordVoicing(Math.max(-2, chordVoicing - 1))
                    }
                    className="btn btn-xs sm:btn-sm btn-outline join-item touch-manipulation"
                  >
                    -{" "}
                    <kbd className="kbd kbd-xs hidden sm:inline">
                      {getKeyDisplayName(shortcuts.voicingDown?.key || "")}
                    </kbd>
                  </button>
                  <button
                    onClick={() =>
                      setChordVoicing(Math.min(4, chordVoicing + 1))
                    }
                    className="btn btn-xs sm:btn-sm btn-outline join-item touch-manipulation"
                  >
                    +{" "}
                    <kbd className="kbd kbd-xs hidden sm:inline">
                      {getKeyDisplayName(shortcuts.voicingUp?.key || "")}
                    </kbd>
                  </button>
                </div>
              </div>
            )}

          {/* Brushing Speed Control */}
          {controlConfig.brushingSpeed &&
            brushingSpeed !== undefined &&
            setBrushingSpeed && (
              <div className="flex items-center gap-1 sm:gap-2">
                <label className="label py-1">
                  <span className="label-text text-xs sm:text-sm">
                    <span className="hidden sm:inline">
                      Brushing:{" "}
                      {
                        BRUSHING_TIME_LABELS[
                          brushingSpeed as keyof typeof BRUSHING_TIME_LABELS
                        ]
                      }{" "}
                      ({brushingSpeed}ms)
                    </span>
                    <span className="sm:hidden">
                      Brush: {brushingSpeed}ms
                    </span>
                  </span>
                </label>
                <div className="join">
                  <button
                    onClick={() => {
                      const currentStep = BRUSHING_TIME_STEPS.indexOf(
                        brushingSpeed as any,
                      );
                      if (currentStep > 0) {
                        const newSpeed = BRUSHING_TIME_STEPS[currentStep - 1];
                        setBrushingSpeed(newSpeed);
                      }
                    }}
                    className="btn btn-xs sm:btn-sm btn-outline join-item touch-manipulation"
                  >
                    -{" "}
                    <kbd className="kbd kbd-xs hidden sm:inline">
                      {getKeyDisplayName(
                        shortcuts.brushingSpeedDown?.key || "N",
                      )}
                    </kbd>
                  </button>
                  <button
                    onClick={() => {
                      const currentStep = BRUSHING_TIME_STEPS.indexOf(
                        brushingSpeed as any,
                      );
                      if (currentStep < BRUSHING_TIME_STEPS.length - 1) {
                        const newSpeed = BRUSHING_TIME_STEPS[currentStep + 1];
                        setBrushingSpeed(newSpeed);
                      }
                    }}
                    className="btn btn-xs sm:btn-sm btn-outline join-item touch-manipulation"
                  >
                    +{" "}
                    <kbd className="kbd kbd-xs hidden sm:inline">
                      {getKeyDisplayName(shortcuts.brushingSpeedUp?.key || "M")}
                    </kbd>
                  </button>
                </div>
              </div>
            )}

          {/* Additional Controls */}
          {additionalControls}
        </div>
      </div>
    </div>
  );
}
