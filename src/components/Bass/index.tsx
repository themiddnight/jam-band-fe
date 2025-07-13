import { useState } from "react";
import type { Scale } from "../../hooks/useScaleState";

export interface BassProps {
  scaleState: {
    rootNote: string;
    scale: Scale;
    getScaleNotes: (root: string, scaleType: Scale, octave: number) => string[];
  };
  onPlayNotes: (notes: string[], velocity: number, isKeyHeld: boolean) => void;
  onStopNotes: (notes: string[]) => void;
  onStopSustainedNotes: () => void;
  onReleaseKeyHeldNote: (note: string) => void;
  onSustainChange: (sustain: boolean) => void;
}

export default function Bass({
  onPlayNotes,
  onReleaseKeyHeldNote,
  onSustainChange,
}: BassProps) {
  const [velocity, setVelocity] = useState<number>(0.7);
  const [sustain, setSustain] = useState<boolean>(false);
  const [pressedFrets, setPressedFrets] = useState<Set<string>>(new Set());

  const strings = ["E", "A", "D", "G"];
  const frets = 12;

  const getNoteAtFret = (stringIndex: number, fret: number): string => {
    const openNotes = ["E1", "A1", "D2", "G2"];
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    
    const openNote = openNotes[stringIndex];
    const openNoteName = openNote.replace(/\d/, "");
    const openNoteIndex = noteNames.indexOf(openNoteName);
    const newNoteIndex = (openNoteIndex + fret) % 12;
    const octave = Math.floor((openNoteIndex + fret) / 12) + parseInt(openNote.replace(/\D/g, ""));
    
    return noteNames[newNoteIndex] + octave;
  };

  const handleFretPress = (stringIndex: number, fret: number) => {
    const note = getNoteAtFret(stringIndex, fret);
    const fretKey = `${stringIndex}-${fret}`;
    
    setPressedFrets(new Set([...pressedFrets, fretKey]));
    onPlayNotes([note], velocity, true);
  };

  const handleFretRelease = (stringIndex: number, fret: number) => {
    const note = getNoteAtFret(stringIndex, fret);
    const fretKey = `${stringIndex}-${fret}`;
    
    const newPressedFrets = new Set(pressedFrets);
    newPressedFrets.delete(fretKey);
    setPressedFrets(newPressedFrets);
    
    onReleaseKeyHeldNote(note);
  };

  const handleSustainChange = (newSustain: boolean) => {
    setSustain(newSustain);
    onSustainChange(newSustain);
  };

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg w-full max-w-4xl">
      <div className="flex justify-around gap-3 mb-3 flex-wrap">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700">Bass Controls</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm">Velocity: {Math.round(velocity * 9)}</span>
            <input
              type="range"
              min="1"
              max="9"
              value={Math.round(velocity * 9)}
              onChange={(e) => setVelocity(parseInt(e.target.value) / 9)}
              className="w-20"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Sustain</span>
            <button
              onClick={() => handleSustainChange(!sustain)}
              className={`px-3 py-1 text-sm rounded ${
                sustain ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              {sustain ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {strings.map((stringNote, stringIndex) => (
          <div key={stringIndex} className="flex items-center gap-1">
            <div className="w-12 text-center text-sm font-mono text-gray-600">
              {stringNote}
            </div>
            <div className="flex-1 flex gap-1">
              {Array.from({ length: frets + 1 }, (_, fret) => {
                const fretKey = `${stringIndex}-${fret}`;
                const isPressed = pressedFrets.has(fretKey);
                
                return (
                  <button
                    key={fret}
                    onMouseDown={() => handleFretPress(stringIndex, fret)}
                    onMouseUp={() => handleFretRelease(stringIndex, fret)}
                    onMouseLeave={() => handleFretRelease(stringIndex, fret)}
                    className={`flex-1 h-8 border border-gray-300 rounded ${
                      fret === 0 
                        ? "bg-gray-100 text-gray-500" 
                        : isPressed 
                          ? "bg-blue-500 text-white" 
                          : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    {fret === 0 ? "○" : fret}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-center text-sm text-gray-600">
        <p>Click on frets to play bass notes. Open strings (○) are muted.</p>
      </div>
    </div>
  );
} 