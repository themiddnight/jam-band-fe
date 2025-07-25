// Safari/WebKit compatibility utilities

export const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export const isWebKit = (): boolean => {
  return /webkit/i.test(navigator.userAgent);
};

export const isMobile = (): boolean => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

export const isSafariMobile = (): boolean => {
  return isSafari() && isMobile();
};

export const getSafariVersion = (): number | null => {
  const match = navigator.userAgent.match(/Version\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

// WebKit/Safari specific audio context helpers
export const createWebKitCompatibleAudioContext = async (): Promise<AudioContext> => {
  // Use webkitAudioContext for older Safari versions
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  
  if (!AudioContextClass) {
    throw new Error("AudioContext not supported in this browser");
  }
  
  const context = new AudioContextClass();
  
  // Safari requires explicit resume after user gesture
  if (context.state === "suspended") {
    try {
      await context.resume();
      
      // Extra wait for Safari to properly initialize
      if (isSafari()) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn("Failed to resume AudioContext:", error);
      throw error;
    }
  }
  
  return context;
};

// Safari-specific audio decoding error handling
export const handleSafariAudioError = (error: any, instrumentName: string): Error => {
  if (isSafari() && error.name === "EncodingError") {
    return new Error(
      `Safari audio decoding failed for ${instrumentName}. ` +
      `This may be due to Safari's audio format restrictions or codec compatibility issues.`
    );
  }
  
  if (isSafari() && error.message?.includes("decoding")) {
    return new Error(
      `Safari audio decoding error: ${error.message}. ` +
      `Try refreshing the page or switching to a different instrument.`
    );
  }
  
  return error;
};

// Safari-specific touch event helpers
export const getSafariTouchDelay = (): number => {
  return isSafariMobile() ? 10 : 0;
};

export const getSafariReleaseDelay = (): number => {
  return isSafariMobile() ? 20 : 0;
};

// WebKit-specific CSS properties for touch optimization
export const getWebKitTouchStyles = (): React.CSSProperties => {
  return {
    WebkitTapHighlightColor: 'transparent',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'manipulation'
  };
};

// Safari-specific instrument loading timeouts
export const getSafariLoadTimeout = (baseTimeout: number = 10000): number => {
  return isSafari() ? baseTimeout * 1.5 : baseTimeout;
};

// Check if current Safari version has known audio issues
export const hasSafariAudioIssues = (): boolean => {
  if (!isSafari()) return false;
  
  const version = getSafariVersion();
  if (!version) return true; // Assume issues if version is unknown
  
  // Safari versions with known Web Audio issues
  // Based on the bug reports we found
  return version >= 14 && version <= 15;
};

// Get user-friendly error messages for Safari users
export const getSafariUserMessage = (error: string): string => {
  if (!isSafari()) return error;
  
  if (error.includes("decoding") || error.includes("EncodingError")) {
    return "Safari is having trouble loading this audio sample. The app will automatically try Safari-compatible instruments.";
  }
  
  if (error.includes("AudioContext")) {
    return "Safari requires user interaction before audio can play. Make sure you've clicked the \"Initialize Audio\" button and allowed audio permissions.";
  }
  
  if (error.includes("timeout")) {
    return "Safari is taking longer than usual to load the audio. This is normal - Safari sometimes needs extra time to process audio samples.";
  }
  
  if (error.includes("Switching to synthesizer mode")) {
    return "Safari cannot load audio samples. Using built-in synthesizer instead for best compatibility.";
  }
  
  return error;
};

// Safari-specific best practices
export const applySafariBestPractices = () => {
  if (!isSafari()) return;
  
  // Disable iOS Safari bounce scroll
  if (isSafariMobile()) {
    document.body.style.overscrollBehavior = 'none';
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
  }
  
  // Add Safari-specific meta tags for better audio performance
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && isSafariMobile()) {
    viewport.setAttribute('content', 
      viewport.getAttribute('content') + ', user-scalable=no'
    );
  }
};

// Initialize Safari compatibility on app start
export const initSafariCompatibility = () => {
  if (isSafari()) {
    applySafariBestPractices();
    
    if (hasSafariAudioIssues()) {
      console.warn(
        'This Safari version has known Web Audio API issues. ' +
        'Some instruments may not load properly.'
      );
    }
  }
};

// Safari-compatible instrument fallback utilities
export const findNextCompatibleInstrument = async (
  currentInstrument: string,
  category: string,
  failedInstruments: Set<string> = new Set()
): Promise<string | null> => {
  // Import instruments dynamically to avoid circular dependencies
  const instrumentsModule = await import('../constants/instruments');
  const { SOUNDFONT_INSTRUMENTS, SYNTHESIZER_INSTRUMENTS, DRUM_MACHINES } = instrumentsModule;
  
  let instruments: Array<{ value: string; label: string; controlType: any }> = [];
  
  switch (category) {
    case 'melodic':
      instruments = SOUNDFONT_INSTRUMENTS;
      break;
    case 'synthesizer':
      instruments = SYNTHESIZER_INSTRUMENTS;
      break;
    case 'drum_beat':
      instruments = DRUM_MACHINES;
      break;
    default:
      return null;
  }
  
  // Find the current instrument index
  const currentIndex = instruments.findIndex(instr => instr.value === currentInstrument);
  if (currentIndex === -1) {
    // If current instrument not found, start from the beginning
    for (let i = 0; i < instruments.length; i++) {
      if (!failedInstruments.has(instruments[i].value)) {
        return instruments[i].value;
      }
    }
    return null;
  }
  
  // Try instruments after the current one
  for (let i = currentIndex + 1; i < instruments.length; i++) {
    if (!failedInstruments.has(instruments[i].value)) {
      return instruments[i].value;
    }
  }
  
  // If we reach the end, try instruments before the current one
  for (let i = 0; i < currentIndex; i++) {
    if (!failedInstruments.has(instruments[i].value)) {
      return instruments[i].value;
    }
  }
  
  return null;
};

// Check if an instrument is likely to work in Safari
export const isSafariCompatibleInstrument = (instrumentName: string, category: string): boolean => {
  if (!isSafari()) return true;
  
  // Synthesizers are always compatible (they use Tone.js, not audio samples)
  if (category === 'synthesizer') return true;
  
  // Drum machines are generally compatible
  if (category === 'drum_beat') return true;
  
  // For soundfont instruments, some are known to have issues in Safari
  if (category === 'melodic') {
    // Instruments that are known to work well in Safari
    const safariCompatibleInstruments = [
      'acoustic_grand_piano',
      'bright_acoustic_piano',
      'electric_grand_piano',
      'honkytonk_piano',
      'electric_piano_1',
      'electric_piano_2',
      'harpsichord',
      'clavinet',
      'celesta',
      'glockenspiel',
      'music_box',
      'vibraphone',
      'marimba',
      'xylophone',
      'tubular_bells',
      'dulcimer',
      'drawbar_organ',
      'percussive_organ',
      'rock_organ',
      'church_organ',
      'reed_organ',
      'accordion',
      'harmonica',
      'tango_accordion',
      'acoustic_guitar_nylon',
      'acoustic_guitar_steel',
      'electric_guitar_jazz',
      'electric_guitar_clean',
      'electric_guitar_muted',
      'overdriven_guitar',
      'distortion_guitar',
      'guitar_harmonics',
      'acoustic_bass',
      'electric_bass_finger',
      'electric_bass_pick',
      'fretless_bass',
      'slap_bass_1',
      'slap_bass_2',
      'synth_bass_1',
      'synth_bass_2',
      'violin',
      'viola',
      'cello',
      'contrabass',
      'tremolo_strings',
      'pizzicato_strings',
      'orchestral_harp',
      'timpani',
      'string_ensemble_1',
      'string_ensemble_2',
      'synth_strings_1',
      'synth_strings_2',
      'choir_aahs',
      'voice_oohs',
      'synth_choir',
      'orchestra_hit',
      'trumpet',
      'trombone',
      'tuba',
      'muted_trumpet',
      'french_horn',
      'brass_section',
      'synth_brass_1',
      'synth_brass_2',
      'soprano_sax',
      'alto_sax',
      'tenor_sax',
      'baritone_sax',
      'oboe',
      'english_horn',
      'bassoon',
      'clarinet',
      'piccolo',
      'flute',
      'recorder',
      'pan_flute',
      'blown_bottle',
      'shakuhachi',
      'whistle',
      'ocarina',
      'lead_1_square',
      'lead_2_sawtooth',
      'lead_3_calliope',
      'lead_4_chiff',
      'lead_5_charang',
      'lead_6_voice',
      'lead_7_fifths',
      'lead_8_bass__lead',
      'pad_1_new_age',
      'pad_2_warm',
      'pad_3_polysynth',
      'pad_4_choir',
      'pad_5_bowed',
      'pad_6_metallic',
      'pad_7_halo',
      'pad_8_sweep',
      'fx_1_rain',
      'fx_2_soundtrack',
      'fx_3_crystal',
      'fx_4_atmosphere',
      'fx_5_brightness',
      'fx_6_goblins',
      'fx_7_echoes',
      'fx_8_scifi',
      'sitar',
      'banjo',
      'shamisen',
      'koto',
      'kalimba',
      'bagpipe',
      'fiddle',
      'shanai',
      'tinkle_bell',
      'agogo',
      'steel_drums',
      'woodblock',
      'taiko_drum',
      'melodic_tom',
      'synth_drum',
      'reverse_cymbal',
      'guitar_fret_noise',
      'breath_noise',
      'seashore',
      'bird_tweet',
      'telephone_ring',
      'helicopter',
      'applause',
      'gunshot'
    ];
    
    return safariCompatibleInstruments.includes(instrumentName);
  }
  
  return true;
};

// Get a list of instruments that are known to work well in Safari
export const getSafariCompatibleInstruments = async (category: string): Promise<string[]> => {
  if (!isSafari()) {
    // If not Safari, return all instruments
    const instrumentsModule = await import('../constants/instruments');
    const { SOUNDFONT_INSTRUMENTS, SYNTHESIZER_INSTRUMENTS, DRUM_MACHINES } = instrumentsModule;
    
    switch (category) {
      case 'melodic':
        return SOUNDFONT_INSTRUMENTS.map((instr: { value: string }) => instr.value);
      case 'synthesizer':
        return SYNTHESIZER_INSTRUMENTS.map((instr: { value: string }) => instr.value);
      case 'drum_beat':
        return DRUM_MACHINES.map((instr: { value: string }) => instr.value);
      default:
        return [];
    }
  }
  
  // For Safari, return only compatible instruments
  switch (category) {
    case 'melodic':
      return [
        'acoustic_grand_piano',
        'bright_acoustic_piano',
        'electric_grand_piano',
        'honkytonk_piano',
        'electric_piano_1',
        'electric_piano_2',
        'harpsichord',
        'clavinet',
        'celesta',
        'glockenspiel',
        'music_box',
        'vibraphone',
        'marimba',
        'xylophone',
        'tubular_bells',
        'dulcimer',
        'drawbar_organ',
        'percussive_organ',
        'rock_organ',
        'church_organ',
        'reed_organ',
        'accordion',
        'harmonica',
        'tango_accordion',
        'acoustic_guitar_nylon',
        'acoustic_guitar_steel',
        'electric_guitar_jazz',
        'electric_guitar_clean',
        'electric_guitar_muted',
        'overdriven_guitar',
        'distortion_guitar',
        'guitar_harmonics',
        'acoustic_bass',
        'electric_bass_finger',
        'electric_bass_pick',
        'fretless_bass',
        'slap_bass_1',
        'slap_bass_2',
        'synth_bass_1',
        'synth_bass_2',
        'violin',
        'viola',
        'cello',
        'contrabass',
        'tremolo_strings',
        'pizzicato_strings',
        'orchestral_harp',
        'timpani',
        'string_ensemble_1',
        'string_ensemble_2',
        'synth_strings_1',
        'synth_strings_2',
        'choir_aahs',
        'voice_oohs',
        'synth_choir',
        'orchestra_hit',
        'trumpet',
        'trombone',
        'tuba',
        'muted_trumpet',
        'french_horn',
        'brass_section',
        'synth_brass_1',
        'synth_brass_2',
        'soprano_sax',
        'alto_sax',
        'tenor_sax',
        'baritone_sax',
        'oboe',
        'english_horn',
        'bassoon',
        'clarinet',
        'piccolo',
        'flute',
        'recorder',
        'pan_flute',
        'blown_bottle',
        'shakuhachi',
        'whistle',
        'ocarina',
        'lead_1_square',
        'lead_2_sawtooth',
        'lead_3_calliope',
        'lead_4_chiff',
        'lead_5_charang',
        'lead_6_voice',
        'lead_7_fifths',
        'lead_8_bass__lead',
        'pad_1_new_age',
        'pad_2_warm',
        'pad_3_polysynth',
        'pad_4_choir',
        'pad_5_bowed',
        'pad_6_metallic',
        'pad_7_halo',
        'pad_8_sweep',
        'fx_1_rain',
        'fx_2_soundtrack',
        'fx_3_crystal',
        'fx_4_atmosphere',
        'fx_5_brightness',
        'fx_6_goblins',
        'fx_7_echoes',
        'fx_8_scifi',
        'sitar',
        'banjo',
        'shamisen',
        'koto',
        'kalimba',
        'bagpipe',
        'fiddle',
        'shanai',
        'tinkle_bell',
        'agogo',
        'steel_drums',
        'woodblock',
        'taiko_drum',
        'melodic_tom',
        'synth_drum',
        'reverse_cymbal',
        'guitar_fret_noise',
        'breath_noise',
        'seashore',
        'bird_tweet',
        'telephone_ring',
        'helicopter',
        'applause',
        'gunshot'
      ];
    case 'synthesizer':
      return [
        'analog_mono',
        'analog_poly',
        'fm_mono',
        'fm_poly'
      ];
    case 'drum_beat':
      return [
        'TR-808',
        'LM-2',
        'Casio-RZ1',
        'MFB-512',
        'Roland CR-8000'
      ];
    default:
      return [];
  }
}; 