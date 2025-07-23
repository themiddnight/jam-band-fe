import { useRef, useCallback, useEffect } from 'react';
import { Soundfont, DrumMachine } from 'smplr';
import { InstrumentCategory } from '../constants/instruments';

interface UserInstrument {
  instrument: any;
  instrumentName: string;
  category: InstrumentCategory;
  userId: string;
  username: string;
}

export const useMultiUserAudio = (audioContext: AudioContext | null) => {
  const userInstruments = useRef<Map<string, UserInstrument>>(new Map());
  const loadingInstruments = useRef<Set<string>>(new Set());
  const preloadedInstruments = useRef<Set<string>>(new Set());

  // Load an instrument for a specific user
  const loadUserInstrument = useCallback(async (
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory
  ) => {
    if (!audioContext || audioContext.state !== 'running') {
      console.warn('AudioContext not ready for loading user instrument');
      return null;
    }

    const instrumentKey = `${userId}-${instrumentName}-${category}`;
    
    // Check if already loading
    if (loadingInstruments.current.has(instrumentKey)) {
      console.log('Instrument already loading:', instrumentKey);
      return null;
    }

    // Check if already loaded
    if (userInstruments.current.has(instrumentKey)) {
      return userInstruments.current.get(instrumentKey)!.instrument;
    }

    loadingInstruments.current.add(instrumentKey);

    try {
      let newInstrument: any;

      if (category === InstrumentCategory.Synthesizer) {
        // For synthesizer, we'll use a simplified approach
        // In a full implementation, you'd want to create separate Tone.js instances
        console.log('Synthesizer instruments for other users not fully implemented');
        return null;
      } else if (category === InstrumentCategory.DrumBeat) {
        newInstrument = new DrumMachine(audioContext, {
          instrument: instrumentName,
          volume: 80, // Slightly lower volume for other users
        });
      } else {
        // Default to Soundfont for melodic instruments
        newInstrument = new Soundfont(audioContext, {
          instrument: instrumentName,
          volume: 80, // Slightly lower volume for other users
        });
      }

      await newInstrument.load;

      const userInstrument: UserInstrument = {
        instrument: newInstrument,
        instrumentName,
        category,
        userId,
        username,
      };

      userInstruments.current.set(instrumentKey, userInstrument);
      console.log(`Loaded instrument for user ${username}: ${instrumentName}`);

      return newInstrument;
    } catch (error) {
      console.error(`Failed to load instrument ${instrumentName} for user ${username}:`, error);
      return null;
    } finally {
      loadingInstruments.current.delete(instrumentKey);
    }
  }, [audioContext]);

  // Play notes from another user
  const playUserNote = useCallback(async (
    userId: string,
    username: string,
    notes: string[],
    velocity: number,
    instrumentName: string,
    category: InstrumentCategory
  ) => {
    // Try to find any instrument instance for this instrument/category combination
    let userInstrument: UserInstrument | undefined;
    
    // First, try to find the specific user's instrument
    const userSpecificKey = `${userId}-${instrumentName}-${category}`;
    userInstrument = userInstruments.current.get(userSpecificKey);
    
    // If not found, try to find any instance of this instrument
    if (!userInstrument) {
      for (const [, instrument] of userInstruments.current.entries()) {
        if (instrument.instrumentName === instrumentName && instrument.category === category) {
          userInstrument = instrument;
          break;
        }
      }
    }

    // Load instrument if not found at all
    if (!userInstrument) {
      console.log(`Loading instrument ${instrumentName} for user ${username}`);
      const instrument = await loadUserInstrument(userId, username, instrumentName, category);
      if (!instrument) return;
      userInstrument = userInstruments.current.get(userSpecificKey);
    }

    if (userInstrument && userInstrument.instrument) {
      try {
        // Play the notes
        if (category === InstrumentCategory.DrumBeat && userInstrument.instrument.start) {
          // For drum machines, play samples
          notes.forEach(note => {
            userInstrument!.instrument.start({ note, velocity });
          });
        } else if (userInstrument.instrument.start) {
          // For soundfont instruments
          notes.forEach(note => {
            userInstrument!.instrument.start({ note, velocity });
          });
        }
      } catch (error) {
        console.error(`Error playing note for user ${username}:`, error);
      }
    } else {
      console.warn(`Could not find or load instrument ${instrumentName} for user ${username}`);
    }
  }, [loadUserInstrument]);

  // Stop notes from another user
  const stopUserNote = useCallback((
    userId: string,
    notes: string[],
    instrumentName: string,
    category: InstrumentCategory
  ) => {
    // Try to find any instrument instance for this instrument/category combination
    let userInstrument: UserInstrument | undefined;
    
    // First, try to find the specific user's instrument
    const userSpecificKey = `${userId}-${instrumentName}-${category}`;
    userInstrument = userInstruments.current.get(userSpecificKey);
    
    // If not found, try to find any instance of this instrument
    if (!userInstrument) {
      for (const [, instrument] of userInstruments.current.entries()) {
        if (instrument.instrumentName === instrumentName && instrument.category === category) {
          userInstrument = instrument;
          break;
        }
      }
    }

    if (userInstrument && userInstrument.instrument && userInstrument.instrument.stop) {
      try {
        notes.forEach(note => {
          userInstrument!.instrument.stop({ note });
        });
      } catch (error) {
        console.error(`Error stopping note for user ${userId}:`, error);
      }
    }
  }, []);

  // Clean up instruments for a user (when they leave)
  const cleanupUserInstruments = useCallback((userId: string) => {
    const keysToDelete: string[] = [];
    
    userInstruments.current.forEach((userInstrument, key) => {
      if (userInstrument.userId === userId) {
        if (userInstrument.instrument && userInstrument.instrument.disconnect) {
          try {
            userInstrument.instrument.disconnect();
          } catch (error) {
            console.error('Error disconnecting instrument:', error);
          }
        }
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      userInstruments.current.delete(key);
    });
  }, []);

  // Preload instruments for all users in the room
  const preloadRoomInstruments = useCallback(async (roomUsers: Array<{
    id: string;
    username: string;
    currentInstrument?: string;
    currentCategory?: string;
  }>) => {
    if (!audioContext || audioContext.state !== 'running') {
      console.warn('AudioContext not ready for preloading instruments');
      return;
    }

    console.log('Preloading instruments for room users:', roomUsers);

    for (const user of roomUsers) {
      if (user.currentInstrument && user.currentCategory) {
        const instrumentKey = `${user.currentInstrument}-${user.currentCategory}`;
        
        // Skip if already preloaded
        if (preloadedInstruments.current.has(instrumentKey)) {
          continue;
        }

        try {
          console.log(`Preloading ${user.currentInstrument} for ${user.username}`);
          await loadUserInstrument(
            user.id,
            user.username,
            user.currentInstrument,
            user.currentCategory as InstrumentCategory
          );
          preloadedInstruments.current.add(instrumentKey);
        } catch (error) {
          console.error(`Failed to preload instrument for ${user.username}:`, error);
        }
      }
    }
  }, [audioContext, loadUserInstrument]);

  // Preload a single instrument when a user changes
  const preloadUserInstrument = useCallback(async (
    userId: string,
    username: string,
    instrumentName: string,
    category: InstrumentCategory
  ) => {
    const instrumentKey = `${instrumentName}-${category}`;
    
    // Skip if already preloaded
    if (preloadedInstruments.current.has(instrumentKey)) {
      console.log(`Instrument ${instrumentName} already preloaded`);
      return;
    }

    try {
      console.log(`Preloading ${instrumentName} for ${username}`);
      await loadUserInstrument(userId, username, instrumentName, category);
      preloadedInstruments.current.add(instrumentKey);
    } catch (error) {
      console.error(`Failed to preload instrument ${instrumentName} for ${username}:`, error);
    }
  }, [loadUserInstrument]);

  // Clean up all instruments
  const cleanupAllInstruments = useCallback(() => {
    userInstruments.current.forEach((userInstrument) => {
      if (userInstrument.instrument && userInstrument.instrument.disconnect) {
        try {
          userInstrument.instrument.disconnect();
        } catch (error) {
          console.error('Error disconnecting instrument:', error);
        }
      }
    });
    userInstruments.current.clear();
    preloadedInstruments.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllInstruments();
    };
  }, [cleanupAllInstruments]);

  return {
    playUserNote,
    stopUserNote,
    cleanupUserInstruments,
    cleanupAllInstruments,
    loadUserInstrument,
    preloadRoomInstruments,
    preloadUserInstrument,
  };
}; 