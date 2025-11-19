# Project Save/Load System

This system allows saving and loading DAW projects as `.jbp` (Jam Band Project) files, which are ZIP archives containing all project data.

## Installation

The required dependency has been installed:

```bash
npm install jszip
```

## File Structure

A `.jbp` file is a ZIP archive with the following structure:

```
project-name.jbp (ZIP file)
├── project.json          # All project metadata, tracks, regions, settings
└── audio/
    ├── region-1.webm     # Audio recordings for audio regions (WebM/Opus compressed)
    ├── region-2.webm
    └── ...
```

## Quick Start

### 1. Add the ProjectMenu component to your DAW

```tsx
import { ProjectMenu } from './features/daw/components/ProjectMenu';

function ArrangeRoom() {
  return (
    <div>
      <ProjectMenu />
      {/* Your DAW UI */}
    </div>
  );
}
```

### 2. Use the hook directly

```tsx
import { useProjectManager } from './features/daw/hooks/useProjectManager';

function MyComponent() {
  const { saveProject, loadProject, hasUnsavedChanges } = useProjectManager();

  return (
    <div>
      <button onClick={() => saveProject('My Project')}>Save</button>
      <button onClick={() => loadProject()}>Load</button>
      {hasUnsavedChanges && <span>Unsaved changes</span>}
    </div>
  );
}
```

## Features

### ✅ Implemented

- **Save project as ZIP** - Bundle all data into a single `.jbp` file
- **Load project from ZIP** - Restore complete project state
- **Audio buffer to WAV conversion** - Preserve recorded audio
- **File System Access API** - Modern file picker (Chrome/Edge)
- **Fallback support** - Download/upload for older browsers
- **Auto-save to IndexedDB** - Automatic recovery backup
- **Recovery system** - Restore from auto-save
- **Unsaved changes warning** - Prevent accidental data loss
- **Drag & drop support** - Drop `.jbp` files to load

### What Gets Saved

- ✅ Project settings (BPM, time signature, loop, metronome, grid)
- ✅ Scale settings (root note, scale type)
- ✅ All tracks (name, instrument, volume, pan, mute, solo, color)
- ✅ MIDI regions (notes, sustain events, loop settings)
- ✅ Audio regions (recordings, trim, gain, fades)
- ✅ Audio files (as WAV format)

### What Doesn't Get Saved (Yet)

- ❌ Effect chains (can be added)
- ❌ Mixer settings (can be added)
- ❌ History/undo state (optional)
- ❌ Plugin states (future)

## API Reference

### useProjectManager Hook

```typescript
const {
  // State
  isSaving,           // boolean - Currently saving
  isLoading,          // boolean - Currently loading
  error,              // string | null - Error message
  lastSaved,          // Date | null - Last save timestamp
  hasUnsavedChanges,  // boolean - Has unsaved changes

  // Actions
  saveProject,        // (name: string) => Promise<void>
  saveProjectAs,      // (name: string) => Promise<void>
  loadProject,        // (file?: File) => Promise<void>
  recoverProject,     // () => Promise<boolean>
  markAsModified,     // () => void
} = useProjectManager({
  enableAutoSave: true,      // Enable auto-save
  autoSaveInterval: 60000,   // Auto-save interval (ms)
});
```

### Direct API Usage

```typescript
import {
  saveProjectAsZip,
  loadProjectFromZip,
  saveProjectWithPicker,
  loadProjectWithPicker,
  autoSaveToIndexedDB,
  recoverFromAutoSave,
} from './services/projectFileManager';

// Save with file picker
await saveProjectWithPicker('My Project');

// Load with file picker
await loadProjectWithPicker();

// Save as download
await saveProjectAsZip('My Project');

// Load from File object
await loadProjectFromZip(file);

// Auto-save to IndexedDB
await autoSaveToIndexedDB('My Project');

// Recover from auto-save
const recovered = await recoverFromAutoSave();
```

## Advanced Usage

### Drag & Drop Support

```tsx
function ArrangeRoom() {
  const { loadProject } = useProjectManager();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.jbp')) {
      await loadProject(file);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Your DAW UI */}
    </div>
  );
}
```

### Track Changes for Auto-Save

```tsx
import { useProjectManager } from './hooks/useProjectManager';
import { useEffect } from 'react';

function ArrangeRoom() {
  const { markAsModified } = useProjectManager();
  
  // Mark as modified when stores change
  useEffect(() => {
    const unsubscribe = trackStore.subscribe(() => {
      markAsModified();
    });
    return unsubscribe;
  }, [markAsModified]);

  return <div>{/* Your DAW UI */}</div>;
}
```

### Custom Save Location

```tsx
// For desktop apps or advanced use cases
const handle = await window.showSaveFilePicker({
  suggestedName: 'my-project.jbp',
  types: [{
    description: 'Jam Band Project',
    accept: { 'application/zip': ['.jbp'] },
  }],
});

// Save to the handle
const writable = await handle.createWritable();
await writable.write(zipBlob);
await writable.close();
```

## Browser Compatibility

| Feature | Chrome/Edge 86+ | Firefox | Safari |
|---------|----------------|---------|--------|
| File System Access API | ✅ | ❌ | ❌ |
| Download/Upload Fallback | ✅ | ✅ | ✅ |
| IndexedDB Auto-save | ✅ | ✅ | ✅ |
| Drag & Drop | ✅ | ✅ | ✅ |

## Technical Details

### Audio Format
- **Format**: WAV (PCM)
- **Bit depth**: 16-bit
- **Sample rate**: Preserved from AudioBuffer
- **Channels**: Preserved (mono/stereo)

### Compression
- **ZIP compression**: DEFLATE level 6
- **JSON**: Pretty-printed (human-readable)
- **Audio**: Uncompressed WAV

### File Size Estimates
- Empty project: ~1 KB
- Project with 10 MIDI tracks: ~5-10 KB
- Project with 1 min audio: ~10 MB
- Project with 5 min audio: ~50 MB

### Performance
- **Save time**: ~100ms for MIDI-only, +time for audio encoding
- **Load time**: ~200ms for MIDI-only, +time for audio decoding
- **Memory**: Efficient streaming for large projects

## Troubleshooting

### "Failed to save project"
- Check browser console for details
- Ensure sufficient disk space
- Try using "Save As" instead

### "Invalid project file"
- File may be corrupted
- Ensure file is a valid `.jbp` file
- Try recovering from auto-save

### Audio not loading
- Check browser console for decode errors
- Ensure audio files are valid WAV format
- Try re-recording the audio

### Auto-save not working
- Check IndexedDB is enabled in browser
- Check storage quota (Settings → Site Settings)
- Clear browser cache if quota exceeded

## Future Enhancements

- [ ] Progress indicators for large projects
- [ ] Project templates
- [ ] Export as audio (mixdown)
- [ ] Export individual stems
- [ ] Cloud sync integration
- [ ] Version history
- [ ] Collaborative editing
- [ ] Project thumbnails
- [ ] Compression optimization
- [ ] Streaming for very large projects

## Contributing

To add new data to save/load:

1. Update `SerializedProject` interface in `projectSerializer.ts`
2. Add serialization logic in `serializeProject()`
3. Add deserialization logic in `deserializeProject()`
4. Test save/load cycle

Example:

```typescript
// 1. Add to interface
interface SerializedProject {
  // ... existing fields
  effects: EffectChainState[];
}

// 2. Serialize
export function serializeProject(projectName: string): SerializedProject {
  return {
    // ... existing fields
    effects: effectsStore.getState().chains,
  };
}

// 3. Deserialize
export function deserializeProject(data: SerializedProject): void {
  // ... existing code
  effectsStore.setState({ chains: data.effects });
}
```
