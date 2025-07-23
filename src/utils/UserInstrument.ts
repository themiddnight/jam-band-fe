import { Soundfont, DrumMachine } from 'smplr';
import { InstrumentCategory } from '../constants/instruments';
import { getSafariLoadTimeout, handleSafariAudioError } from './webkitCompat';

export interface UserInstrumentData {
  userId: string;
  username: string;
  instrumentName: string;
  category: InstrumentCategory;
}

export class UserInstrument {
  private instrument: any = null;
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private activeNotes = new Map<string, any>();
  private sustainedNotes = new Set<any>();
  private keyHeldNotes = new Set<string>();
  private sustain = false;

  constructor(
    private data: UserInstrumentData,
    audioContext: AudioContext
  ) {
    this.audioContext = audioContext;
  }

  getUserId(): string {
    return this.data.userId;
  }

  getUsername(): string {
    return this.data.username;
  }

  getInstrumentName(): string {
    return this.data.instrumentName;
  }

  getCategory(): InstrumentCategory {
    return this.data.category;
  }

  getKey(): string {
    return `${this.data.userId}-${this.data.instrumentName}-${this.data.category}`;
  }

  isReady(): boolean {
    return this.isLoaded && this.instrument !== null;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  async load(): Promise<any> {
    if (this.isLoaded && this.instrument) {
      return this.instrument;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this._loadInstrument();
    
    try {
      const result = await this.loadPromise;
      this.isLoaded = true;
      return result;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async _loadInstrument(): Promise<any> {
    if (!this.audioContext || this.audioContext.state !== 'running') {
      throw new Error('AudioContext not ready');
    }

    try {
      let newInstrument: any;

      if (this.data.category === InstrumentCategory.Synthesizer) {
        // For synthesizer, we'll use a simplified approach
        console.log('Synthesizer instruments for other users not fully implemented');
        return null;
      } else if (this.data.category === InstrumentCategory.DrumBeat) {
        newInstrument = new DrumMachine(this.audioContext, {
          instrument: this.data.instrumentName,
          volume: 80, // Slightly lower volume for other users
        });
      } else {
        // Default to Soundfont for melodic instruments
        newInstrument = new Soundfont(this.audioContext, {
          instrument: this.data.instrumentName,
          volume: 80, // Slightly lower volume for other users
        });
      }

      const loadTimeout = getSafariLoadTimeout();
      
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Instrument loading timed out after ${loadTimeout}ms`));
        }, loadTimeout);

        newInstrument.load
          .then(() => {
            clearTimeout(timeoutId);
            resolve();
          })
          .catch((error: any) => {
            clearTimeout(timeoutId);
            reject(handleSafariAudioError(error, this.data.instrumentName));
          });
      });

      await loadPromise;
      this.instrument = newInstrument;
      console.log(`Loaded instrument ${this.data.instrumentName} for user ${this.data.username}`);
      
      return newInstrument;
    } catch (error) {
      console.error(`Failed to load instrument ${this.data.instrumentName} for user ${this.data.username}:`, error);
      throw error;
    }
  }

  async playNotes(notes: string[], velocity: number, isKeyHeld: boolean = false): Promise<void> {
    console.log(`🎵 UserInstrument: Playing notes for ${this.data.username}, ready: ${this.isReady()}`);
    
    if (!this.isReady()) {
      console.log(`📥 Loading instrument for ${this.data.username}`);
      await this.load();
      console.log(`✅ Loaded instrument for ${this.data.username}, ready: ${this.isReady()}`);
    }

    if (!this.instrument) {
      console.warn(`❌ Instrument ${this.data.instrumentName} not available for user ${this.data.username}`);
      return;
    }

    console.log(`🎹 Playing ${notes.length} notes for ${this.data.username} with ${this.data.instrumentName}`);

    try {
      if (this.data.category === InstrumentCategory.DrumBeat && this.instrument.start) {
        // For drum machines, play samples
        console.log(`🥁 Playing drum samples:`, notes);
        notes.forEach(note => {
          console.log(`🥁 Starting drum note:`, note, `with velocity:`, velocity * 127);
          
          // Stop existing note if playing
          const existingNote = this.activeNotes.get(note);
          if (existingNote) {
            existingNote(); // Call the stop function
          }
          
          const playedNote = this.instrument.start({
            note: note,
            velocity: velocity * 127, // smplr expects velocity 0-127
            time: this.audioContext!.currentTime,
          });
          
          // Store the note for later stopping
          this.activeNotes.set(note, playedNote);
          
          // Track key-held notes
          if (isKeyHeld) {
            this.keyHeldNotes.add(note);
          }
          
          // Only add to sustained notes if sustain is on AND note is not key-held
          if (this.sustain && !isKeyHeld) {
            this.sustainedNotes.add(playedNote);
          }
          
          // Auto-stop non-key-held notes after timeout if sustain is off
          if (!isKeyHeld && !this.sustain) {
            setTimeout(() => {
              if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
                if (playedNote) {
                  playedNote();
                }
                this.activeNotes.delete(note);
              }
            }, 300);
          }
        });
      } else if (this.instrument.start) {
        // For soundfont instruments
        console.log(`🎼 Playing soundfont notes:`, notes);
        notes.forEach(note => {
          console.log(`🎼 Starting soundfont note:`, note, `with velocity:`, velocity * 127);
          
          // Stop existing note if playing
          const existingNote = this.activeNotes.get(note);
          if (existingNote) {
            existingNote(); // Call the stop function
          }
          
          const playedNote = this.instrument.start({
            note: note,
            velocity: velocity * 127, // smplr expects velocity 0-127
            time: this.audioContext!.currentTime,
          });
          
          // Store the note for later stopping
          this.activeNotes.set(note, playedNote);
          
          // Track key-held notes
          if (isKeyHeld) {
            this.keyHeldNotes.add(note);
          }
          
          // Only add to sustained notes if sustain is on AND note is not key-held
          if (this.sustain && !isKeyHeld) {
            this.sustainedNotes.add(playedNote);
          }
          
          // Auto-stop non-key-held notes after timeout if sustain is off
          if (!isKeyHeld && !this.sustain) {
            setTimeout(() => {
              if (this.activeNotes.has(note) && !this.keyHeldNotes.has(note)) {
                if (playedNote) {
                  playedNote();
                }
                this.activeNotes.delete(note);
              }
            }, 300);
          }
        });
      } else {
        console.warn(`❌ Instrument doesn't have a start method:`, this.instrument);
      }
      console.log(`✅ Successfully played all notes for ${this.data.username}`);
    } catch (error) {
      console.error(`❌ Error playing note for user ${this.data.username}:`, error);
    }
  }

  setSustain(sustain: boolean): void {
    this.sustain = sustain;
    
    // If sustain is turned off, stop all sustained notes
    if (!sustain) {
      this.stopSustainedNotes();
    }
  }

  private stopSustainedNotes(): void {
    this.sustainedNotes.forEach(note => {
      if (note) {
        note(); // Call the stop function
      }
    });
    this.sustainedNotes.clear();
  }

  async stopNotes(notes: string[]): Promise<void> {
    if (!this.isReady() || !this.instrument) {
      return;
    }

    console.log(`🛑 UserInstrument: Stopping notes for ${this.data.username}:`, notes, `sustain: ${this.sustain}`);

    try {
      notes.forEach(note => {
        const activeNote = this.activeNotes.get(note);
        if (activeNote) {
          const isKeyHeld = this.keyHeldNotes.has(note);
          
          if (isKeyHeld) {
            // Remove from key-held notes
            this.keyHeldNotes.delete(note);
            
            if (this.sustain) {
              // If sustain is on, move key-held note to sustained notes
              console.log(`🎛️ Moving key-held note to sustained:`, note);
              this.sustainedNotes.add(activeNote);
              this.activeNotes.delete(note);
            } else {
              // If sustain is off, stop the key-held note immediately
              console.log(`🛑 Stopping key-held note:`, note);
              activeNote(); // Call the stop function directly
              this.activeNotes.delete(note);
              this.sustainedNotes.delete(activeNote);
            }
          } else {
            // Non-key-held notes should already be handled by sustain logic
            // Just clean up if they're still active
            console.log(`🛑 Stopping non-key-held note:`, note);
            activeNote(); // Call the stop function directly
            this.activeNotes.delete(note);
            this.sustainedNotes.delete(activeNote);
          }
        } else {
          console.log(`⚠️ No active note found for:`, note);
        }
      });
    } catch (error) {
      console.error(`❌ Error stopping note for user ${this.data.username}:`, error);
    }
  }

  updateInstrument(instrumentName: string, category: InstrumentCategory): void {
    // Stop all active notes first
    this.activeNotes.forEach((stopFunction) => {
      try {
        stopFunction();
      } catch (error) {
        console.error('Error stopping active note during update:', error);
      }
    });
    this.activeNotes.clear();
    this.sustainedNotes.clear();
    this.keyHeldNotes.clear();

    // Dispose of old instrument
    if (this.instrument && this.instrument.disconnect) {
      try {
        this.instrument.disconnect();
      } catch (error) {
        console.error('Error disconnecting instrument during update:', error);
      }
    }
    
    // Update data
    this.data.instrumentName = instrumentName;
    this.data.category = category;
    
    // Reset state
    this.instrument = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
  }

  dispose(): void {
    // Stop all active notes
    this.activeNotes.forEach((stopFunction) => {
      try {
        stopFunction();
      } catch (error) {
        console.error('Error stopping active note during dispose:', error);
      }
    });
    this.activeNotes.clear();
    this.sustainedNotes.clear();
    this.keyHeldNotes.clear();

    if (this.instrument && this.instrument.disconnect) {
      try {
        this.instrument.disconnect();
      } catch (error) {
        console.error('Error disconnecting instrument:', error);
      }
    }
    
    this.instrument = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
  }
} 