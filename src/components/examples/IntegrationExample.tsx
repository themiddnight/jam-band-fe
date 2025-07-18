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

// Example integration with existing hooks
import { useScaleState } from '../../hooks/useScaleState';
import { useInstrument } from '../../hooks/useInstrument';

// Integration Example: Shows how to use pure components with existing system
export const IntegratedInstrumentExample: React.FC = () => {
  const [currentInstrument, setCurrentInstrument] = useState<'guitar' | 'bass' | 'drums' | 'keyboard'>('guitar');
  
  // Use existing hooks for state management
  const scaleState = useScaleState();
  const {
    playNotes,
    releaseKeyHeldNote,
    availableSamples,
  } = useInstrument();

  // Component-specific state
  const [velocity, setVelocity] = useState(0.7);
  const [pressedFrets, setPressedFrets] = useState<Set<string>>(new Set());
  const [pressedPads, setPressedPads] = useState<Set<string>>(new Set());
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [padAssignments, setPadAssignments] = useState<Record<string, string>>({});

  // Guitar Configuration
  const guitarConfig: FretboardConfig = useMemo(() => ({
    strings: ['E', 'A', 'D', 'G', 'B', 'E'],
    frets: 12,
    openNotes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    mode: 'melody',
    showNoteNames: true,
    showFretNumbers: true,
    highlightScaleNotes: true,
  }), []);

  // Bass Configuration
  const bassConfig: FretboardConfig = useMemo(() => ({
    strings: ['E', 'A', 'D', 'G'],
    frets: 12,
    openNotes: ['E1', 'A1', 'D2', 'G2'],
    mode: 'octave',
    showNoteNames: true,
    showFretNumbers: true,
    highlightScaleNotes: true,
  }), []);

  // Keyboard Configuration
  const keyboardConfig = useMemo(() => ({
    layout: 'scale' as const,
    showKeyLabels: true,
    showNoteNames: true,
    highlightScaleNotes: true,
  }), []);

  // Generate data for each instrument
  const scaleNotes = useMemo(() => 
    getScaleNotes(scaleState.rootNote, scaleState.scale, 3)
      .map(note => note.slice(0, -1)),
    [scaleState.rootNote, scaleState.scale]
  );

  const guitarPositions = useMemo(() => 
    generateFretPositions(
      guitarConfig.strings,
      guitarConfig.openNotes,
      guitarConfig.frets,
      pressedFrets,
      scaleNotes
    ),
    [guitarConfig, pressedFrets, scaleNotes]
  );

  const bassPositions = useMemo(() => 
    generateFretPositions(
      bassConfig.strings,
      bassConfig.openNotes,
      bassConfig.frets,
      pressedFrets,
      scaleNotes
    ),
    [bassConfig, pressedFrets, scaleNotes]
  );

  const drumPads = useMemo(() => 
    generateDrumPads(availableSamples, 16, pressedPads, padAssignments),
    [availableSamples, pressedPads, padAssignments]
  );

  const keyboardKeys = useMemo(() => 
    generateVirtualKeys(
      'scale',
      scaleState.rootNote,
      scaleState.scale,
      3,
      pressedKeys,
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"]
    ),
    [scaleState.rootNote, scaleState.scale, pressedKeys]
  );

  // Event handlers that integrate with existing audio system
  const handleFretPress = useCallback(async (stringIndex: number, fret: number, note: string) => {
    const fretKey = `${stringIndex}-${fret}`;
    setPressedFrets(prev => new Set(prev).add(fretKey));
    
    // Integration with existing audio system
    await playNotes([note], velocity, true);
  }, [playNotes, velocity]);

  const handleFretRelease = useCallback((stringIndex: number, fret: number, note: string) => {
    const fretKey = `${stringIndex}-${fret}`;
    setPressedFrets(prev => {
      const newSet = new Set(prev);
      newSet.delete(fretKey);
      return newSet;
    });
    
    // Integration with existing audio system
    releaseKeyHeldNote(note);
  }, [releaseKeyHeldNote]);

  const handlePadPress = useCallback(async (padId: string, sound?: string) => {
    setPressedPads(prev => new Set(prev).add(padId));
    
    if (sound) {
      // Integration with existing audio system
      await playNotes([sound], velocity, false);
    }
  }, [playNotes, velocity]);

  const handlePadRelease = useCallback((padId: string) => {
    setPressedPads(prev => {
      const newSet = new Set(prev);
      newSet.delete(padId);
      return newSet;
    });
  }, []);

  const handlePadAssign = useCallback((padId: string, sound: string) => {
    setPadAssignments(prev => ({
      ...prev,
      [padId]: sound
    }));
  }, []);

  const handleKeyPress = useCallback(async (key: any) => {
    setPressedKeys(prev => new Set(prev).add(key.note));
    
    // Integration with existing audio system
    await playNotes([key.note], velocity, true);
  }, [playNotes, velocity]);

  const handleKeyRelease = useCallback((key: any) => {
    setPressedKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(key.note);
      return newSet;
    });
    
    // Integration with existing audio system
    releaseKeyHeldNote(key.note);
  }, [releaseKeyHeldNote]);

  const renderCurrentInstrument = () => {
    switch (currentInstrument) {
      case 'guitar':
        return (
          <FretboardBase
            config={guitarConfig}
            positions={guitarPositions}
            onFretPress={handleFretPress}
            onFretRelease={handleFretRelease}
            velocity={velocity}
            onVelocityChange={setVelocity}
            className="guitar-fretboard"
          />
        );
      
      case 'bass':
        return (
          <FretboardBase
            config={bassConfig}
            positions={bassPositions}
            onFretPress={handleFretPress}
            onFretRelease={handleFretRelease}
            velocity={velocity}
            onVelocityChange={setVelocity}
            className="bass-fretboard"
          />
        );
      
      case 'drums':
        return (
          <DrumPadBase
            pads={drumPads}
            onPadPress={handlePadPress}
            onPadRelease={handlePadRelease}
            onPadAssign={handlePadAssign}
            velocity={velocity}
            onVelocityChange={setVelocity}
            maxPads={16}
            allowAssignment={true}
            availableSounds={availableSamples}
            className="drum-pad-grid"
          />
        );
      
      case 'keyboard':
        return (
          <VirtualKeyboardBase
            config={keyboardConfig}
            keys={keyboardKeys}
            onKeyPress={handleKeyPress}
            onKeyRelease={handleKeyRelease}
            className="virtual-keyboard"
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Integrated Pure Components</h2>
      
      {/* Instrument Selection */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          {(['guitar', 'bass', 'drums', 'keyboard'] as const).map(instrument => (
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
        
        {/* Scale Controls - integrated with existing useScaleState */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Root Note:</label>
            <select
              value={scaleState.rootNote}
              onChange={(e) => scaleState.setRootNote(e.target.value)}
              className="px-2 py-1 border rounded"
            >
              {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(note => (
                <option key={note} value={note}>{note}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Scale:</label>
            <select
              value={scaleState.scale}
              onChange={(e) => scaleState.setScale(e.target.value as Scale)}
              className="px-2 py-1 border rounded"
            >
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Current Instrument Display */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-4">
          {currentInstrument.charAt(0).toUpperCase() + currentInstrument.slice(1)}
        </h3>
        
        <div className="mb-4 text-sm text-gray-600">
          Current Scale: {scaleState.rootNote} {scaleState.scale}
        </div>
        
        {renderCurrentInstrument()}
      </div>

      {/* Integration Benefits */}
      <div className="mt-6 p-4 bg-green-50 rounded-lg">
        <h4 className="font-semibold text-green-800 mb-2">✅ Pure Component Benefits:</h4>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• <strong>Reusable:</strong> Same FretboardBase for guitar and bass</li>
          <li>• <strong>Testable:</strong> Pure functions with predictable outputs</li>
          <li>• <strong>Performant:</strong> Memoized calculations and optimized rendering</li>
          <li>• <strong>Configurable:</strong> Different modes and behaviors via props</li>
          <li>• <strong>Maintainable:</strong> Clear separation of UI and business logic</li>
        </ul>
      </div>

      {/* Implementation Notes */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">🔧 Implementation Notes:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Pure components receive data via props, not hooks</li>
          <li>• Business logic stays in container components</li>
          <li>• Audio integration happens in event handlers</li>
          <li>• State management uses existing hooks</li>
          <li>• Calculations are memoized for performance</li>
        </ul>
      </div>
    </div>
  );
}; 