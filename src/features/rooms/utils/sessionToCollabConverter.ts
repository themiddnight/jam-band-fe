import { v4 as uuidv4 } from 'uuid';
import type { SessionRecordingSnapshot, RecordedMidiEvent } from '../hooks/useSessionToCollab';
import type { SerializedProject, SerializedRegion } from '@/features/daw/services/projectSerializer';
import type { MidiNote, SustainEvent } from '@/features/daw/types/daw';
import { InstrumentCategory } from '@/shared/constants/instruments';

// ============================================================================
// Types
// ============================================================================

interface NoteOnState {
  note: string;
  velocity: number;
  startBeat: number;
}

interface SustainOnState {
  startBeat: number;
}

interface TrackData {
  id: string;
  name: string;
  type: 'midi' | 'audio';
  instrumentId?: string;
  instrumentCategory?: InstrumentCategory;
  color: string;
  regionIds: string[];
}

interface RegionData extends SerializedRegion {
  audioBlob?: Blob;
}

// ============================================================================
// Color Generation
// ============================================================================

const TRACK_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
];

function getColorForIndex(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

// ============================================================================
// MIDI Event Processing
// ============================================================================

/**
 * Convert recorded MIDI events to MidiNote and SustainEvent objects
 * Pairs note_on with note_off events to calculate duration
 * Pairs sustain_on with sustain_off events
 */
function convertEventsToNotesAndSustain(events: RecordedMidiEvent[]): { notes: MidiNote[]; sustainEvents: SustainEvent[] } {
  const notes: MidiNote[] = [];
  const sustainEvents: SustainEvent[] = [];
  const activeNotes = new Map<string, NoteOnState>(); // key: note name
  let activeSustain: SustainOnState | null = null;

  // Sort events by beat position
  const sortedEvents = [...events].sort((a, b) => a.beatPosition - b.beatPosition);

  for (const event of sortedEvents) {
    // Handle sustain events
    if (event.eventType === 'sustain_on') {
      activeSustain = { startBeat: event.beatPosition };
      continue;
    } else if (event.eventType === 'sustain_off') {
      if (activeSustain) {
        sustainEvents.push({
          id: uuidv4(),
          start: activeSustain.startBeat,
          end: event.beatPosition,
        });
        activeSustain = null;
      }
      continue;
    }

    const noteKey = event.note;

    if (event.eventType === 'note_on' && event.velocity > 0) {
      // Start of a note
      activeNotes.set(noteKey, {
        note: event.note,
        velocity: event.velocity,
        startBeat: event.beatPosition,
      });
    } else if (event.eventType === 'note_off' || (event.eventType === 'note_on' && event.velocity === 0)) {
      // End of a note
      const noteOn = activeNotes.get(noteKey);
      if (noteOn) {
        const duration = Math.max(0.0625, event.beatPosition - noteOn.startBeat); // Min 1/16 note
        notes.push({
          id: uuidv4(),
          pitch: noteNameToPitch(noteOn.note),
          velocity: noteOn.velocity,
          start: noteOn.startBeat,
          duration,
        });
        activeNotes.delete(noteKey);
      }
    }
  }

  // Handle any notes that didn't get a note_off (e.g., recording stopped while playing)
  // Give them a default duration of 1 beat
  activeNotes.forEach((noteOn) => {
    notes.push({
      id: uuidv4(),
      pitch: noteNameToPitch(noteOn.note),
      velocity: noteOn.velocity,
      start: noteOn.startBeat,
      duration: 1, // Default 1 beat duration
    });
  });

  // Handle unclosed sustain
  if (activeSustain) {
    // Find the last event's beat position for the end
    const lastBeat = sortedEvents.length > 0 
      ? sortedEvents[sortedEvents.length - 1].beatPosition 
      : activeSustain.startBeat + 1;
    sustainEvents.push({
      id: uuidv4(),
      start: activeSustain.startBeat,
      end: lastBeat,
    });
  }

  return { notes, sustainEvents };
}

/**
 * Convert note name (e.g., "C4", "F#3") to MIDI pitch number
 */
function noteNameToPitch(noteName: string): number {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11,
  };

  // Parse note name - handle both "C4" and "C#4" formats
  const match = noteName.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) {
    console.warn(`Invalid note name: ${noteName}, defaulting to C4`);
    return 60; // Default to middle C
  }

  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const semitone = noteMap[note.toUpperCase()];

  if (semitone === undefined) {
    console.warn(`Unknown note: ${note}, defaulting to C`);
    return 60 + (octave - 4) * 12;
  }

  // MIDI note number: C4 = 60
  return (octave + 1) * 12 + semitone;
}

// ============================================================================
// Main Converter
// ============================================================================

/**
 * Convert a session recording snapshot to a SerializedProject
 */
export function convertSessionToProject(snapshot: SessionRecordingSnapshot): {
  project: SerializedProject;
  audioFiles: { regionId: string; fileName: string; blob: Blob }[];
} {
  const tracks: TrackData[] = [];
  const regions: RegionData[] = [];
  const audioFiles: { regionId: string; fileName: string; blob: Blob }[] = [];
  const effectChains: Record<string, any> = {};

  let trackIndex = 0;

  // Group MIDI events by userId
  const midiByUser = new Map<string, RecordedMidiEvent[]>();
  for (const event of snapshot.midiEvents) {
    const existing = midiByUser.get(event.userId) || [];
    existing.push(event);
    midiByUser.set(event.userId, existing);
  }

  // Process each user with MIDI data
  for (const [odId, events] of midiByUser) {
    const metadata = snapshot.userMetadata.get(odId);
    if (!metadata) continue;

    const trackId = uuidv4();
    const regionId = uuidv4();
    const color = getColorForIndex(trackIndex);

    // Convert events to notes and sustain events
    const { notes, sustainEvents } = convertEventsToNotesAndSustain(events);

    console.log(`🎹 Converting MIDI for ${metadata.username}:`, {
      noteCount: notes.length,
      sustainCount: sustainEvents.length,
      sampleNotes: notes.slice(0, 3).map(n => ({ pitch: n.pitch, velocity: n.velocity, start: n.start, duration: n.duration })),
      sampleSustain: sustainEvents.slice(0, 3),
    });

    if (notes.length === 0 && sustainEvents.length === 0) continue; // Skip empty tracks

    // Region should start at beat 0 to capture from the beginning of recording
    // Notes are already in absolute beat positions from recording start
    const regionStart = 0;
    
    // Calculate region length to encompass all notes
    const allEnds = notes.map(n => n.start + n.duration);
    sustainEvents.forEach(s => allEnds.push(s.end));
    
    const maxEnd = allEnds.length > 0 ? Math.max(...allEnds) : 4;
    const regionLength = Math.max(4, Math.ceil(maxEnd)); // Min 4 beats, from beat 0

    // Notes are already in correct positions (relative to recording start = beat 0)
    // No normalization needed since region starts at 0
    const normalizedNotes = notes.map(n => ({
      ...n,
      // Ensure velocity is in valid range (1-127)
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
    }));

    // Sustain events are also in correct positions
    const normalizedSustainEvents = sustainEvents;

    console.log(`🎹 Region for ${metadata.username}:`, {
      regionStart,
      regionLength,
      noteCount: normalizedNotes.length,
      sustainCount: normalizedSustainEvents.length,
      sampleNormalizedNotes: normalizedNotes.slice(0, 3),
    });

    // Create MIDI track
    tracks.push({
      id: trackId,
      name: `${metadata.username}-midi`,
      type: 'midi',
      instrumentId: metadata.instrument,
      instrumentCategory: metadata.category,
      color,
      regionIds: [regionId],
    });

    // Create MIDI region
    regions.push({
      id: regionId,
      trackId,
      name: `${metadata.username} MIDI`,
      start: regionStart,
      length: regionLength,
      loopEnabled: false,
      loopIterations: 1,
      color,
      type: 'midi',
      notes: normalizedNotes,
      sustainEvents: normalizedSustainEvents,
    });

    // Store effect chain if available
    if (metadata.effectChain) {
      effectChains[`track:${trackId}`] = metadata.effectChain;
    }

    trackIndex++;
  }

  // Process audio recordings
  for (const [odId, audioBlob] of snapshot.audioBlobs) {
    // Find username for this user
    let username = 'Unknown';
    const metadata = snapshot.userMetadata.get(odId);
    if (metadata) {
      username = metadata.username;
    } else {
      // Check if we have any MIDI events from this user to get username
      const userEvents = snapshot.midiEvents.find(e => e.userId === odId);
      if (userEvents) {
        username = userEvents.username;
      }
    }

    const trackId = uuidv4();
    const regionId = uuidv4();
    const color = getColorForIndex(trackIndex);

    // Create audio track
    tracks.push({
      id: trackId,
      name: `${username}-voice`,
      type: 'audio',
      color,
      regionIds: [regionId],
    });

    // Create audio region
    regions.push({
      id: regionId,
      trackId,
      name: `${username} Voice`,
      start: 0, // Audio starts from beginning
      length: snapshot.durationBeats,
      loopEnabled: false,
      loopIterations: 1,
      color,
      type: 'audio',
      audioFileRef: `audio/${regionId}.webm`,
      audioFileId: regionId,
      trimStart: 0,
      originalLength: snapshot.durationBeats,
      gain: 0,
      fadeInDuration: 0,
      fadeOutDuration: 0,
    });

    // Add to audio files list
    audioFiles.push({
      regionId,
      fileName: `${regionId}.webm`,
      blob: audioBlob,
    });

    trackIndex++;
  }

  // Build the serialized project
  const project: SerializedProject = {
    version: '1.0.0',
    metadata: {
      name: generateProjectName(snapshot.roomName),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    },
    project: {
      bpm: snapshot.bpm,
      timeSignature: {
        numerator: 4,
        denominator: 4,
      },
      gridDivision: 16,
      loop: {
        enabled: false,
        start: 0,
        end: Math.ceil(snapshot.durationBeats / 4) * 4, // Round up to nearest 4 beats
      },
      isMetronomeEnabled: false,
      snapToGrid: true,
    },
    scale: {
      rootNote: snapshot.scale.rootNote,
      scale: snapshot.scale.scale,
    },
    tracks: tracks.map(track => ({
      id: track.id,
      name: track.name,
      type: track.type,
      instrumentId: track.instrumentId,
      instrumentCategory: track.instrumentCategory,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: track.color,
      regionIds: track.regionIds,
    })),
    regions: regions.map(region => {
      // Remove audioBlob from serialized region (it's saved separately)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { audioBlob, ...serializedRegion } = region as RegionData;
      return serializedRegion;
    }),
    effectChains,
    synthStates: {}, // TODO: Could capture synth states if needed
    markers: [],
  };

  return { project, audioFiles };
}

/**
 * Generate a project name from room name and timestamp
 */
function generateProjectName(roomName: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = now.toTimeString().slice(0, 5).replace(':', ''); // HHMM
  return `${roomName}-${dateStr}-${timeStr}`;
}

// ============================================================================
// Save to .collab file
// ============================================================================

/**
 * Save a session recording snapshot directly to a .collab file
 */
export async function saveSessionAsCollab(snapshot: SessionRecordingSnapshot): Promise<void> {
  const JSZip = (await import('jszip')).default;
  
  console.log('🔄 Converting session to project...');
  const { project, audioFiles } = convertSessionToProject(snapshot);

  console.log('📦 Creating ZIP file...');
  const zip = new JSZip();

  // Add project.json
  const projectJson = JSON.stringify(project, null, 2);
  zip.file('project.json', projectJson);
  console.log(`📄 Added project.json (${(projectJson.length / 1024).toFixed(2)} KB)`);

  // Add audio files
  if (audioFiles.length > 0) {
    const audioFolder = zip.folder('audio');
    if (audioFolder) {
      for (const audioFile of audioFiles) {
        console.log(`🎵 Adding ${audioFile.fileName} (${(audioFile.blob.size / 1024).toFixed(2)} KB)`);
        audioFolder.file(audioFile.fileName, audioFile.blob);
      }
    }
  }

  // Generate ZIP blob
  console.log('🗜️ Compressing ZIP file...');
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Download the file
  const fileName = `${sanitizeFileName(project.metadata.name)}.collab`;
  console.log(`💾 Downloading: ${fileName} (${(zipBlob.size / 1024).toFixed(2)} KB)`);
  downloadBlob(zipBlob, fileName);

  console.log('✅ Session saved as .collab file');
}

/**
 * Sanitize filename
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
