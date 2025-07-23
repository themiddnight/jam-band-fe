import { UserInstrument } from './UserInstrument';
import type { UserInstrumentData } from './UserInstrument';
import { AudioEngine } from './AudioEngine';
import { InstrumentCategory } from '../constants/instruments';

export class InstrumentManager {
  private instruments = new Map<string, UserInstrument>();
  private audioEngine: AudioEngine;

  constructor() {
    this.audioEngine = new AudioEngine();
  }

  async initialize(): Promise<void> {
    await this.audioEngine.initialize();
  }

  isReady(): boolean {
    return this.audioEngine.isReady();
  }

  async ensureReady(): Promise<void> {
    await this.audioEngine.ensureReady();
  }

  // Create or update a user's instrument
  async createUserInstrument(
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory
  ): Promise<UserInstrument> {
    const audioContext = await this.audioEngine.ensureReady();
    
    const data: UserInstrumentData = {
      userId,
      username,
      instrumentName,
      category
    };

    const userInstrument = new UserInstrument(data, audioContext);
    const key = userInstrument.getKey();
    
    // Dispose of existing instrument if it exists
    const existing = this.instruments.get(key);
    if (existing) {
      existing.dispose();
    }

    this.instruments.set(key, userInstrument);
    console.log(`Created instrument for user ${username}: ${instrumentName}`);
    
    // Preload the instrument immediately
    try {
      await userInstrument.load();
      console.log(`Preloaded instrument for user ${username}: ${instrumentName}`);
    } catch (error) {
      console.error(`Failed to preload instrument for user ${username}:`, error);
    }
    
    return userInstrument;
  }

  // Update a user's instrument
  async updateUserInstrument(
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory
  ): Promise<UserInstrument> {
    const key = `${userId}-${instrumentName}-${category}`;
    let userInstrument = this.instruments.get(key);

    if (userInstrument) {
      // Update existing instrument
      userInstrument.updateInstrument(instrumentName, category);
      console.log(`Updated instrument for user ${username}: ${instrumentName}`);
      
      // Load the updated instrument
      try {
        await userInstrument.load();
        console.log(`Loaded updated instrument for user ${username}: ${instrumentName}`);
      } catch (error) {
        console.error(`Failed to load updated instrument for user ${username}:`, error);
      }
    } else {
      // Create new instrument (this will also load it)
      userInstrument = await this.createUserInstrument(userId, username, instrumentName, category);
    }

    return userInstrument;
  }

  // Get a user's instrument
  getUserInstrument(userId: string, instrumentName: string, category: InstrumentCategory): UserInstrument | undefined {
    const key = `${userId}-${instrumentName}-${category}`;
    return this.instruments.get(key);
  }

  // Find any instrument of the same type
  findInstrumentOfType(instrumentName: string, category: InstrumentCategory): UserInstrument | undefined {
    for (const instrument of this.instruments.values()) {
      if (instrument.getInstrumentName() === instrumentName && instrument.getCategory() === category) {
        return instrument;
      }
    }
    return undefined;
  }

  // Play notes from a user
  async playUserNotes(
    userId: string,
    username: string,
    notes: string[],
    velocity: number,
    instrumentName: string,
    category: InstrumentCategory,
    isKeyHeld: boolean = false
  ): Promise<void> {
    console.log(`🎵 InstrumentManager: Playing notes for ${username} with ${instrumentName}`);
    
    // First try to find the specific user's instrument
    let userInstrument = this.getUserInstrument(userId, instrumentName, category);
    console.log(`🔍 Found specific user instrument:`, !!userInstrument);
    
    // If not found, try to find any instrument of the same type
    if (!userInstrument) {
      userInstrument = this.findInstrumentOfType(instrumentName, category);
      console.log(`🔍 Found any instrument of type ${instrumentName}:`, !!userInstrument);
    }

    // If still not found, create a new one
    if (!userInstrument) {
      console.log(`🏗️ Creating instrument ${instrumentName} for user ${username}`);
      userInstrument = await this.createUserInstrument(userId, username, instrumentName, category);
      console.log(`✅ Created instrument for ${username}:`, !!userInstrument);
    }

    console.log(`🎹 About to play notes:`, notes, `with instrument ready:`, userInstrument?.isReady());
    await userInstrument.playNotes(notes, velocity, isKeyHeld);
    console.log(`✅ Finished playing notes for ${username}`);
  }

  // Stop notes from a user
  async stopUserNotes(
    userId: string,
    notes: string[],
    instrumentName: string,
    category: InstrumentCategory
  ): Promise<void> {
    const userInstrument = this.getUserInstrument(userId, instrumentName, category);
    if (userInstrument) {
      await userInstrument.stopNotes(notes);
    }
  }

  // Set sustain state for a user's instrument
  setUserSustain(
    userId: string,
    sustain: boolean,
    instrumentName: string,
    category: InstrumentCategory
  ): void {
    const userInstrument = this.getUserInstrument(userId, instrumentName, category);
    if (userInstrument) {
      userInstrument.setSustain(sustain);
    }
  }

  // Preload instruments for all users in a room
  async preloadRoomInstruments(roomUsers: Array<{
    id: string;
    username: string;
    currentInstrument?: string;
    currentCategory?: string;
  }>): Promise<void> {
    if (!this.isReady()) {
      console.warn('AudioEngine not ready for preloading instruments');
      return;
    }

    console.log('Preloading instruments for room users:', roomUsers);

    for (const user of roomUsers) {
      if (user.currentInstrument && user.currentCategory) {
        try {
          await this.createUserInstrument(
            user.id,
            user.username,
            user.currentInstrument,
            user.currentCategory as InstrumentCategory
          );
        } catch (error) {
          console.error(`Failed to preload instrument for ${user.username}:`, error);
        }
      }
    }
  }

  // Clean up instruments for a specific user
  cleanupUserInstruments(userId: string): void {
    const keysToDelete: string[] = [];
    
    this.instruments.forEach((instrument, key) => {
      if (instrument.getUserId() === userId) {
        instrument.dispose();
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.instruments.delete(key);
    });

    console.log(`Cleaned up instruments for user ${userId}`);
  }

  // Clean up all instruments
  cleanupAllInstruments(): void {
    this.instruments.forEach(instrument => {
      instrument.dispose();
    });
    this.instruments.clear();
    console.log('Cleaned up all instruments');
  }

  // Get audio context for other components
  getAudioContext(): AudioContext | null {
    return this.audioEngine.getAudioContext();
  }

  // Dispose of the entire manager
  dispose(): void {
    this.cleanupAllInstruments();
    this.audioEngine.dispose();
  }
} 