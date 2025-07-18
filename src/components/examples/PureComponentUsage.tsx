import React, { useState, useCallback, useMemo } from 'react';
import { FretboardBase, type FretboardConfig } from '../shared/FretboardBase';
import { DrumPadBase } from '../shared/DrumPadBase';
import { VirtualKeyboardBase } from '../shared/VirtualKeyboardBase';
import { 
  generateFretPositions, 
  generateDrumPads, 
  generateVirtualKeys,
  getScaleNotes,
  type Scale
} from '../../utils/musicUtils';

// Example: Pure Guitar Component
export const PureGuitar: React.FC<{
  onPlayNote: (note: string, velocity: number) => void;
  onReleaseNote: (note: string) => void;
}> = ({ onPlayNote, onReleaseNote }) => {
  const [velocity, setVelocity] = useState(0.7);
  const [pressedFrets, setPressedFrets] = useState<Set<string>>(new Set());
  const [rootNote] = useState('C');
  const [scale] = useState<Scale>('major');

  const config: FretboardConfig = {
    strings: ['E', 'A', 'D', 'G', 'B', 'E'],
    frets: 12,
    openNotes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    mode: 'melody',
    showNoteNames: true,
    showFretNumbers: true,
    highlightScaleNotes: true,
  };

  // Pure calculation - no side effects
  const scaleNotes = useMemo(() => 
    getScaleNotes(rootNote, scale, 3).map(note => note.slice(0, -1)),
    [rootNote, scale]
  );

  const positions = useMemo(() => 
    generateFretPositions(
      config.strings, 
      config.openNotes, 
      config.frets, 
      pressedFrets, 
      scaleNotes
    ),
    [config.strings, config.openNotes, config.frets, pressedFrets, scaleNotes]
  );

  const handleFretPress = useCallback((stringIndex: number, fret: number, note: string) => {
    const fretKey = `${stringIndex}-${fret}`;
    setPressedFrets(prev => new Set(prev).add(fretKey));
    onPlayNote(note, velocity);
  }, [onPlayNote, velocity]);

  const handleFretRelease = useCallback((stringIndex: number, fret: number, note: string) => {
    const fretKey = `${stringIndex}-${fret}`;
    setPressedFrets(prev => {
      const newSet = new Set(prev);
      newSet.delete(fretKey);
      return newSet;
    });
    onReleaseNote(note);
  }, [onReleaseNote]);

  return (
    <FretboardBase
      config={config}
      positions={positions}
      onFretPress={handleFretPress}
      onFretRelease={handleFretRelease}
      velocity={velocity}
      onVelocityChange={setVelocity}
    />
  );
};

// Example: Pure Drum Pad Component
export const PureDrumPad: React.FC<{
  availableSamples: string[];
  onPlaySample: (sample: string, velocity: number) => void;
  onReleaseSample: (sample: string) => void;
}> = ({ availableSamples, onPlaySample }) => {
  const [velocity, setVelocity] = useState(0.7);
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set());
  const [padAssignments, setPadAssignments] = useState<Record<string, string>>({});

  const pads = useMemo(() => 
    generateDrumPads(availableSamples, 16, pressedPads, padAssignments),
    [availableSamples, pressedPads, padAssignments]
  );

  const handlePadPress = useCallback((padId: string, sound?: string) => {
    setPressedPads(prev => new Set(prev).add(padId));
    if (sound) {
      onPlaySample(sound, velocity);
    }
  }, [onPlaySample, velocity]);

  const handlePadRelease = useCallback((padId: string) => {
    setPressedPads(prev => {
      const newSet = new Set(prev);
      newSet.delete(padId);
      return newSet;
    });
    // For drums, we typically don't need to release samples
  }, []);

  const handlePadAssign = useCallback((padId: string, sound: string) => {
    setPadAssignments(prev => ({
      ...prev,
      [padId]: sound
    }));
  }, []);

  return (
    <DrumPadBase
      pads={pads}
      onPadPress={handlePadPress}
      onPadRelease={handlePadRelease}
      onPadAssign={handlePadAssign}
      velocity={velocity}
      onVelocityChange={setVelocity}
      allowAssignment={true}
      availableSounds={availableSamples}
    />
  );
};

// Example: Pure Virtual Keyboard Component
export const PureVirtualKeyboard: React.FC<{
  rootNote: string;
  scale: Scale;
  octave: number;
  onPlayNote: (note: string, velocity: number) => void;
  onReleaseNote: (note: string) => void;
}> = ({ rootNote, scale, octave, onPlayNote, onReleaseNote }) => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [velocity] = useState(0.7);

  const config = {
    layout: 'scale' as const,
    showKeyLabels: true,
    showNoteNames: true,
    highlightScaleNotes: true,
  };

  const keyMappings = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"];

  const keys = useMemo(() => 
    generateVirtualKeys('scale', rootNote, scale, octave, pressedKeys, keyMappings),
    [rootNote, scale, octave, pressedKeys, keyMappings]
  );

  const handleKeyPress = useCallback((key: any) => {
    setPressedKeys(prev => new Set(prev).add(key.note));
    onPlayNote(key.note, velocity);
  }, [onPlayNote, velocity]);

  const handleKeyRelease = useCallback((key: any) => {
    setPressedKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(key.note);
      return newSet;
    });
    onReleaseNote(key.note);
  }, [onReleaseNote]);

  return (
    <VirtualKeyboardBase
      config={config}
      keys={keys}
      onKeyPress={handleKeyPress}
      onKeyRelease={handleKeyRelease}
    />
  );
};

// Example: Container Component that uses pure components
export const InstrumentContainer: React.FC = () => {
  const [currentInstrument, setCurrentInstrument] = useState<'guitar' | 'drums' | 'keyboard'>('guitar');
  const [rootNote] = useState('C');
  const [scale] = useState<Scale>('major');
  const [octave] = useState(3);
  const availableSamples = ['kick', 'snare', 'hihat', 'crash'];

  // These would typically come from your audio engine
  const handlePlayNote = useCallback((note: string, velocity: number) => {
    console.log(`Playing note: ${note} at velocity: ${velocity}`);
  }, []);

  const handleReleaseNote = useCallback((note: string) => {
    console.log(`Releasing note: ${note}`);
  }, []);

  const handlePlaySample = useCallback((sample: string, velocity: number) => {
    console.log(`Playing sample: ${sample} at velocity: ${velocity}`);
  }, []);

  const handleReleaseSample = useCallback((sample: string) => {
    console.log(`Releasing sample: ${sample}`);
  }, []);

  const renderInstrument = () => {
    switch (currentInstrument) {
      case 'guitar':
        return (
          <PureGuitar
            onPlayNote={handlePlayNote}
            onReleaseNote={handleReleaseNote}
          />
        );
      case 'drums':
        return (
          <PureDrumPad
            availableSamples={availableSamples}
            onPlaySample={handlePlaySample}
            onReleaseSample={handleReleaseSample}
          />
        );
      case 'keyboard':
        return (
          <PureVirtualKeyboard
            rootNote={rootNote}
            scale={scale}
            octave={octave}
            onPlayNote={handlePlayNote}
            onReleaseNote={handleReleaseNote}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">Pure Component Examples</h2>
        <div className="flex gap-2">
          {(['guitar', 'drums', 'keyboard'] as const).map(instrument => (
            <button
              key={instrument}
              onClick={() => setCurrentInstrument(instrument)}
              className={`px-4 py-2 rounded ${
                currentInstrument === instrument
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {instrument.charAt(0).toUpperCase() + instrument.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      <div className="border rounded-lg p-4">
        {renderInstrument()}
      </div>
    </div>
  );
}; 