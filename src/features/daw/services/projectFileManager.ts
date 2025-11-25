import JSZip from 'jszip';
import {
  serializeProject,
  deserializeProject,
  deserializeRegions,
  extractAudioFiles,
  type SerializedProject,
} from './projectSerializer';
import { useRegionStore } from '../stores/regionStore';
import { useTrackStore } from '../stores/trackStore';
import { trackInstrumentRegistry } from '../utils/trackInstrumentRegistry';
import { InstrumentCategory } from '@/shared/constants/instruments';

/**
 * Save the current project as a .collab (zip) file
 */
export async function saveProjectAsZip(projectName: string): Promise<void> {
  try {
    console.log('🔄 Starting project save...');
    
    // 1. Serialize project data
    console.log('📝 Serializing project data...');
    const projectData = serializeProject(projectName);
    console.log('✅ Project data serialized:', {
      tracks: projectData.tracks.length,
      regions: projectData.regions.length,
      effectChains: Object.keys(projectData.effectChains).length,
      synthStates: Object.keys(projectData.synthStates || {}).length,
      markers: projectData.markers?.length || 0,
    });

    // Validate serialized data
    if (!projectData.tracks || !projectData.regions) {
      throw new Error('Invalid project data: missing tracks or regions');
    }

    // 2. Extract audio files from regions
    console.log('🎵 Extracting audio files...');
    const audioFiles = await extractAudioFiles(useRegionStore.getState().regions);
    console.log('✅ Audio files extracted:', audioFiles.length);

    // 3. Create ZIP file
    console.log('📦 Creating ZIP file...');
    const zip = new JSZip();

    // Add project.json with validation
    console.log('📄 Adding project.json to ZIP...');
    let projectJson: string;
    try {
      projectJson = JSON.stringify(projectData, null, 2);
      // Validate it can be parsed back
      JSON.parse(projectJson);
      console.log('✅ Project JSON validated, size:', (projectJson.length / 1024).toFixed(2), 'KB');
    } catch (jsonError) {
      console.error('❌ Failed to serialize project to JSON:', jsonError);
      throw new Error(`Invalid project data - cannot serialize to JSON: ${jsonError}`);
    }
    
    zip.file('project.json', projectJson);

    // Add audio files
    if (audioFiles.length > 0) {
      console.log('🎵 Adding audio files to ZIP...');
      const audioFolder = zip.folder('audio');
      if (audioFolder) {
        for (const audioFile of audioFiles) {
          console.log(`  Adding ${audioFile.fileName} (${(audioFile.blob.size / 1024).toFixed(2)} KB)...`);
          audioFolder.file(audioFile.fileName, audioFile.blob);
        }
      }
    }

    // 4. Generate ZIP blob with progress tracking
    console.log('🗜️ Compressing ZIP file...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }, (metadata) => {
      console.log(`  Compression progress: ${metadata.percent.toFixed(1)}%`);
    });
    console.log('✅ ZIP generated:', (zipBlob.size / 1024).toFixed(2), 'KB');

    // Validate ZIP size
    if (zipBlob.size === 0) {
      throw new Error('Generated ZIP file is empty');
    }

    // 5. Download the file
    const fileName = `${sanitizeFileName(projectName)}.collab`;
    console.log('💾 Downloading file:', fileName);
    downloadBlob(zipBlob, fileName);

    console.log(`✅ Project "${projectName}" saved successfully`);
  } catch (error) {
    console.error('❌ Failed to save project:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Failed to save project: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Load a project from a .collab (zip) file
 */
export async function loadProjectFromZip(file: File): Promise<void> {
  try {
    // 1. Read ZIP file
    const zip = await JSZip.loadAsync(file);

    // 2. Read project.json
    const projectJsonFile = zip.file('project.json');
    if (!projectJsonFile) {
      throw new Error('Invalid project file: project.json not found');
    }

    const projectJsonText = await projectJsonFile.async('text');
    const projectData: SerializedProject = JSON.parse(projectJsonText);

    // 3. Load audio files
    const audioBuffers = new Map<string, AudioBuffer>();
    const audioFolder = zip.folder('audio');

    if (audioFolder) {
      const audioContext = new AudioContext();
      const audioFiles = Object.keys(zip.files).filter((path) =>
        path.startsWith('audio/')
      );

      for (const audioPath of audioFiles) {
        const audioFile = zip.file(audioPath);
        if (audioFile) {
          const arrayBuffer = await audioFile.async('arraybuffer');
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Extract region ID from filename (supports both .webm and .wav for backward compatibility)
          const fileName = audioPath.split('/').pop()?.replace(/\.(webm|wav)$/, '');
          if (fileName) {
            audioBuffers.set(fileName, audioBuffer);
          }
        }
      }
    }

    // 4. Initialize audio context before restoring project
    try {
      const { AudioContextManager } = await import('@/features/audio/constants/audioConfig');
      const Tone = await import('tone');
      
      // Get and ensure audio context is ready
      const context = await AudioContextManager.getInstrumentContext();
      
      // Try to start audio context (may fail if no user interaction yet)
      if (context.state !== 'running') {
        try {
          await context.resume();
          await Tone.start();
        } catch (err) {
          console.warn('AudioContext not ready yet (requires user interaction):', err);
          // Continue anyway - instruments will show error and user can retry
        }
      }
    } catch (err) {
      console.warn('Failed to initialize audio context:', err);
    }

    // 5. Restore project state
    deserializeProject(projectData);

    // 6. Restore regions with audio buffers
    deserializeRegions(projectData.regions, audioBuffers);

    // 7. Apply synth states to instrument engines
    await applySynthStatesToEngines(projectData);

    console.log(`Project "${projectData.metadata.name}" loaded successfully`);
  } catch (error) {
    console.error('Failed to load project:', error);
    throw new Error(`Failed to load project: ${error}`);
  }
}

/**
 * Save project using File System Access API (modern browsers)
 * Falls back to download if not supported
 */
export async function saveProjectWithPicker(projectName: string): Promise<void> {
  if ('showSaveFilePicker' in window) {
    try {
      // Use File System Access API
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${sanitizeFileName(projectName)}.collab`,
        types: [
          {
            description: 'Collaborative DAW Project',
            accept: { 'application/zip': ['.collab'] },
          },
        ],
      });

      console.log('🔄 Starting project save with file picker...');

      // Serialize and create ZIP
      console.log('📝 Serializing project data...');
      const projectData = serializeProject(projectName);
      
      // Validate serialized data
      if (!projectData.tracks || !projectData.regions) {
        throw new Error('Invalid project data: missing tracks or regions');
      }
      
      console.log('✅ Project data serialized:', {
        tracks: projectData.tracks.length,
        regions: projectData.regions.length,
        effectChains: Object.keys(projectData.effectChains).length,
        synthStates: Object.keys(projectData.synthStates || {}).length,
        markers: projectData.markers?.length || 0,
      });

      console.log('🎵 Extracting audio files...');
      const audioFiles = await extractAudioFiles(useRegionStore.getState().regions);
      console.log('✅ Audio files extracted:', audioFiles.length);

      console.log('📦 Creating ZIP file...');
      const zip = new JSZip();
      
      // Validate JSON before adding to ZIP
      let projectJson: string;
      try {
        projectJson = JSON.stringify(projectData, null, 2);
        JSON.parse(projectJson); // Validate
        console.log('✅ Project JSON validated, size:', (projectJson.length / 1024).toFixed(2), 'KB');
      } catch (jsonError) {
        console.error('❌ Failed to serialize project to JSON:', jsonError);
        throw new Error(`Invalid project data - cannot serialize to JSON: ${jsonError}`);
      }
      
      zip.file('project.json', projectJson);

      if (audioFiles.length > 0) {
        console.log('🎵 Adding audio files to ZIP...');
        const audioFolder = zip.folder('audio');
        if (audioFolder) {
          for (const audioFile of audioFiles) {
            console.log(`  Adding ${audioFile.fileName} (${(audioFile.blob.size / 1024).toFixed(2)} KB)...`);
            audioFolder.file(audioFile.fileName, audioFile.blob);
          }
        }
      }

      console.log('🗜️ Compressing ZIP file...');
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      }, (metadata) => {
        console.log(`  Compression progress: ${metadata.percent.toFixed(1)}%`);
      });
      console.log('✅ ZIP generated:', (zipBlob.size / 1024).toFixed(2), 'KB');

      // Validate ZIP size
      if (zipBlob.size === 0) {
        throw new Error('Generated ZIP file is empty');
      }

      // Write to file
      console.log('💾 Writing to file...');
      const writable = await handle.createWritable();
      await writable.write(zipBlob);
      await writable.close();

      console.log(`✅ Project "${projectName}" saved successfully`);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Save cancelled by user');
        return;
      }
      console.error('❌ Failed to save project:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  } else {
    // Fallback to download
    await saveProjectAsZip(projectName);
  }
}

/**
 * Load project using File System Access API (modern browsers)
 * Falls back to file input if not supported
 */
export async function loadProjectWithPicker(): Promise<void> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Collaborative DAW Project',
            accept: { 'application/zip': ['.collab'] },
          },
        ],
        multiple: false,
      });

      const file = await handle.getFile();
      await loadProjectFromZip(file);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Load cancelled by user');
        return;
      }
      throw error;
    }
  } else {
    // Fallback: trigger file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.collab';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await loadProjectFromZip(file);
      }
    };
    input.click();
  }
}

/**
 * Helper: Download a blob as a file
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

/**
 * Helper: Apply synth states to instrument engines after project load
 * Note: This only applies the states to the engines, not to the store.
 * The store is already updated by deserializeProject().
 */
async function applySynthStatesToEngines(projectData: SerializedProject): Promise<void> {
  if (!projectData.synthStates || Object.keys(projectData.synthStates).length === 0) {
    return;
  }

  const tracks = useTrackStore.getState().tracks;

  for (const track of tracks) {
    // Only apply to synth tracks
    if (track.type !== 'midi' || track.instrumentCategory !== InstrumentCategory.Synthesizer) {
      continue;
    }

    const synthState = projectData.synthStates[track.id];
    if (!synthState) {
      continue;
    }

    try {
      // Ensure the engine is loaded
      const { engine } = await trackInstrumentRegistry.ensureEngine(track, {
        instrumentId: track.instrumentId,
        instrumentCategory: track.instrumentCategory,
        // Don't trigger synth param change callbacks during project load
        onSynthParamsChange: undefined,
      });

      // Apply the saved synth parameters (without triggering sync)
      await engine.updateSynthParams(synthState);
      
      console.log(`Applied synth state to track ${track.name}`, synthState);
    } catch (error) {
      console.warn(`Failed to apply synth state to track ${track.id}:`, error);
    }
  }
}

/**
 * Helper: Sanitize file name
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

/**
 * Auto-save to IndexedDB (for recovery)
 */
export async function autoSaveToIndexedDB(projectName: string): Promise<void> {
  try {
    const projectData = serializeProject(projectName);
    const audioFiles = await extractAudioFiles(useRegionStore.getState().regions);

    // Store in IndexedDB
    const db = await openProjectDatabase();
    const tx = db.transaction('autosave', 'readwrite');
    const store = tx.objectStore('autosave');

    await store.put({
      id: 'current',
      projectData,
      audioFiles: await Promise.all(
        audioFiles.map(async (af) => ({
          regionId: af.regionId,
          fileName: af.fileName,
          arrayBuffer: await af.blob.arrayBuffer(),
        }))
      ),
      timestamp: Date.now(),
    });

    console.log('Auto-save completed');
  } catch (error) {
    console.error('Auto-save failed:', error);
  }
}

/**
 * Recover from auto-save
 */
export async function recoverFromAutoSave(): Promise<boolean> {
  try {
    const db = await openProjectDatabase();
    const tx = db.transaction('autosave', 'readonly');
    const store = tx.objectStore('autosave');
    const request = store.get('current');

    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const saved = request.result;
        
        if (!saved) {
          resolve(false);
          return;
        }

        try {
          // Restore project
          deserializeProject(saved.projectData);

          // Restore audio buffers
          const audioContext = new AudioContext();
          const audioBuffers = new Map<string, AudioBuffer>();

          for (const audioFile of saved.audioFiles) {
            const audioBuffer = await audioContext.decodeAudioData(
              audioFile.arrayBuffer
            );
            audioBuffers.set(audioFile.regionId, audioBuffer);
          }

          deserializeRegions(saved.projectData.regions, audioBuffers);

          console.log('Project recovered from auto-save');
          resolve(true);
        } catch (error) {
          console.error('Failed to restore project:', error);
          reject(error);
        }
      };

      request.onerror = () => {
        console.error('Failed to read auto-save:', request.error);
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Failed to recover from auto-save:', error);
    return false;
  }
}

/**
 * Open IndexedDB for auto-save
 */
function openProjectDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('JamBandProjects', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('autosave')) {
        db.createObjectStore('autosave', { keyPath: 'id' });
      }
    };
  });
}
