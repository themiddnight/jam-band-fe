import { ControlType } from "../types";
import type { Instrument } from "../types";

// Instrument categories
export enum InstrumentCategory {
  Melodic = "melodic",
  DrumBeat = "drum_beat",
  Synthesizer = "synthesizer",
}

// Available drum machines from smplr
export const DRUM_MACHINES: Instrument[] = [
  { value: "TR-808", label: "Roland TR-808", controlType: ControlType.Drumpad, icon: "🥁" },
  { value: "LM-2", label: "LinnDrum LM-2", controlType: ControlType.Drumpad, icon: "🥁" },
  { value: "Casio-RZ1", label: "Casio RZ-1", controlType: ControlType.Drumpad, icon: "🥁" },
  {
    value: "MFB-512",
    label: "Fricke MFB-512",
    controlType: ControlType.Drumpad,
    icon: "🥁",
  },
  {
    value: "Roland CR-8000",
    label: "Roland CR-8000",
    controlType: ControlType.Drumpad,
    icon: "🥁",
  },
];

// Available synthesizer instruments using Tone.js
export const SYNTHESIZER_INSTRUMENTS: Instrument[] = [
  // Analog Synthesizers
  {
    value: "analog_mono",
    label: "Analog Mono Synth",
    controlType: ControlType.Keyboard,
    type: "analog",
    polyphony: "mono",
    icon: "🎹",
  },
  {
    value: "analog_poly",
    label: "Analog Poly Synth",
    controlType: ControlType.Keyboard,
    type: "analog",
    polyphony: "poly",
    icon: "🎹",
  },

  // FM Synthesizers
  {
    value: "fm_mono",
    label: "FM Mono Synth",
    controlType: ControlType.Keyboard,
    type: "fm",
    polyphony: "mono",
    icon: "🎹",
  },
  {
    value: "fm_poly",
    label: "FM Poly Synth",
    controlType: ControlType.Keyboard,
    type: "fm",
    polyphony: "poly",
    icon: "🎹",
  },
];

// List of available soundfont instruments
export const SOUNDFONT_INSTRUMENTS: Instrument[] = [
  // Piano
  {
    value: "acoustic_grand_piano",
    label: "Acoustic Grand Piano",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "bright_acoustic_piano",
    label: "Bright Acoustic Piano",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "electric_grand_piano",
    label: "Electric Grand Piano",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "honkytonk_piano",
    label: "Honky-tonk Piano",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "electric_piano_1",
    label: "Electric Piano 1",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "electric_piano_2",
    label: "Electric Piano 2",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "harpsichord",
    label: "Harpsichord",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  { value: "clavinet", label: "Clavinet", controlType: ControlType.Keyboard, icon: "🎹" },

  // Chromatic Percussion
  { value: "celesta", label: "Celesta", controlType: ControlType.Keyboard, icon: "🎹" },
  {
    value: "glockenspiel",
    label: "Glockenspiel",
    controlType: ControlType.Keyboard,
    icon: "🎼",
  },
  { value: "music_box", label: "Music Box", controlType: ControlType.Keyboard, icon: "🎵" },
  {
    value: "vibraphone",
    label: "Vibraphone",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  { value: "marimba", label: "Marimba", controlType: ControlType.Keyboard, icon: "🎹" },
  { value: "xylophone", label: "Xylophone", controlType: ControlType.Keyboard, icon: "🎹" },
  {
    value: "tubular_bells",
    label: "Tubular Bells",
    controlType: ControlType.Keyboard,
    icon: "🔔",
  },
  { value: "dulcimer", label: "Dulcimer", controlType: ControlType.Keyboard, icon: "🎹" },

  // Organ
  {
    value: "drawbar_organ",
    label: "Drawbar Organ",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "percussive_organ",
    label: "Percussive Organ",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "rock_organ",
    label: "Rock Organ",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "church_organ",
    label: "Church Organ",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "reed_organ",
    label: "Reed Organ",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  { value: "accordion", label: "Accordion", controlType: ControlType.Keyboard, icon: "🪗" },
  { value: "harmonica", label: "Harmonica", controlType: ControlType.Keyboard, icon: "🎹" },
  {
    value: "tango_accordion",
    label: "Tango Accordion",
    controlType: ControlType.Keyboard,
    icon: "🪗",
  },

  // Guitar
  {
    value: "acoustic_guitar_nylon",
    label: "Acoustic Guitar (Nylon)",
    controlType: ControlType.Guitar,
    icon: "🎸",
  },
  {
    value: "acoustic_guitar_steel",
    label: "Acoustic Guitar (Steel)",
    controlType: ControlType.Guitar,
    icon: "🎸",
  },
  {
    value: "electric_guitar_jazz",
    label: "Electric Guitar (Jazz)",
    controlType: ControlType.Guitar,
    icon: "🎸",
  },
  {
    value: "electric_guitar_clean",
    label: "Electric Guitar (Clean)",
    controlType: ControlType.Guitar,
    icon: "🎸",
  },
  {
    value: "electric_guitar_muted",
    label: "Electric Guitar (Muted)",
    controlType: ControlType.Guitar,
    icon: "🎸",
  },
  {
    value: "overdriven_guitar",
    label: "Overdriven Guitar",
    controlType: ControlType.Guitar,
    icon: "🎸",
  },
  {
    value: "distortion_guitar",
    label: "Distortion Guitar",
    controlType: ControlType.Guitar,
    icon: "🎸",
  },
  {
    value: "guitar_harmonics",
    label: "Guitar Harmonics",
    controlType: ControlType.Guitar,
    icon: "🎸",
  },

  // Bass
  {
    value: "acoustic_bass",
    label: "Acoustic Bass",
    controlType: ControlType.Bass,
    icon: "🎸",
  },
  {
    value: "electric_bass_finger",
    label: "Electric Bass (Finger)",
    controlType: ControlType.Bass,
    icon: "🎸",
  },
  {
    value: "electric_bass_pick",
    label: "Electric Bass (Pick)",
    controlType: ControlType.Bass,
    icon: "🎸",
  },
  {
    value: "fretless_bass",
    label: "Fretless Bass",
    controlType: ControlType.Bass,
    icon: "🎸",
  },
  { value: "slap_bass_1", label: "Slap Bass 1", controlType: ControlType.Bass, icon: "🎸" },
  { value: "slap_bass_2", label: "Slap Bass 2", controlType: ControlType.Bass, icon: "🎸" },
  {
    value: "synth_bass_1",
    label: "Synth Bass 1",
    controlType: ControlType.Bass,
    icon: "🎸",
  },
  {
    value: "synth_bass_2",
    label: "Synth Bass 2",
    controlType: ControlType.Bass,
    icon: "🎸",
  },

  // Strings
  { value: "violin", label: "Violin", controlType: ControlType.Keyboard, icon: "🎻" },
  { value: "viola", label: "Viola", controlType: ControlType.Keyboard, icon: "🎻" },
  { value: "cello", label: "Cello", controlType: ControlType.Keyboard, icon: "🎻" },
  {
    value: "contrabass",
    label: "Contrabass",
    controlType: ControlType.Keyboard,
    icon: "🎻",
  },
  {
    value: "tremolo_strings",
    label: "Tremolo Strings",
    controlType: ControlType.Keyboard,
    icon: "🎻",
  },
  {
    value: "pizzicato_strings",
    label: "Pizzicato Strings",
    controlType: ControlType.Keyboard,
    icon: "🎻",
  },
  {
    value: "orchestral_harp",
    label: "Orchestral Harp",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  { value: "timpani", label: "Timpani", controlType: ControlType.Keyboard, icon: "🥁" },

  // Ensemble
  {
    value: "string_ensemble_1",
    label: "String Ensemble 1",
    controlType: ControlType.Keyboard,
    icon: "🎻",
  },
  {
    value: "string_ensemble_2",
    label: "String Ensemble 2",
    controlType: ControlType.Keyboard,
    icon: "🎻",
  },
  {
    value: "synth_strings_1",
    label: "Synth Strings 1",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "synth_strings_2",
    label: "Synth Strings 2",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "choir_aahs",
    label: "Choir Aahs",
    controlType: ControlType.Keyboard,
    icon: "🎤",
  },
  {
    value: "voice_oohs",
    label: "Voice Oohs",
    controlType: ControlType.Keyboard,
    icon: "🎤",
  },
  {
    value: "synth_choir",
    label: "Synth Choir",
    controlType: ControlType.Keyboard,
    icon: "🎤",
  },
  {
    value: "orchestra_hit",
    label: "Orchestra Hit",
    controlType: ControlType.Keyboard,
    icon: "🎼",
  },

  // Brass
  { value: "trumpet", label: "Trumpet", controlType: ControlType.Keyboard, icon: "🎺" },
  { value: "trombone", label: "Trombone", controlType: ControlType.Keyboard, icon: "🎺" },
  { value: "tuba", label: "Tuba", controlType: ControlType.Keyboard, icon: "🎺" },
  {
    value: "muted_trumpet",
    label: "Muted Trumpet",
    controlType: ControlType.Keyboard,
    icon: "🎺",
  },
  {
    value: "french_horn",
    label: "French Horn",
    controlType: ControlType.Keyboard,
    icon: "🎺",
  },
  {
    value: "brass_section",
    label: "Brass Section",
    controlType: ControlType.Keyboard,
    icon: "🎺",
  },
  {
    value: "synth_brass_1",
    label: "Synth Brass 1",
    controlType: ControlType.Keyboard,
    icon: "🎺",
  },
  {
    value: "synth_brass_2",
    label: "Synth Brass 2",
    controlType: ControlType.Keyboard,
    icon: "🎺",
  },

  // Reed
  {
    value: "soprano_sax",
    label: "Soprano Sax",
    controlType: ControlType.Keyboard,
    icon: "🎷",
  },
  { value: "alto_sax", label: "Alto Sax", controlType: ControlType.Keyboard, icon: "🎷" },
  { value: "tenor_sax", label: "Tenor Sax", controlType: ControlType.Keyboard, icon: "🎷" },
  {
    value: "baritone_sax",
    label: "Baritone Sax",
    controlType: ControlType.Keyboard,
    icon: "🎷",
  },
  { value: "oboe", label: "Oboe", controlType: ControlType.Keyboard, icon: "🎹" },
  {
    value: "english_horn",
    label: "English Horn",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  { value: "bassoon", label: "Bassoon", controlType: ControlType.Keyboard, icon: "🎹" },
  { value: "clarinet", label: "Clarinet", controlType: ControlType.Keyboard, icon: "🎹" },

  // Pipe
  { value: "piccolo", label: "Piccolo", controlType: ControlType.Keyboard, icon: "🎶" },
  { value: "flute", label: "Flute", controlType: ControlType.Keyboard, icon: "🎶" },
  { value: "recorder", label: "Recorder", controlType: ControlType.Keyboard, icon: "🎶" },
  { value: "pan_flute", label: "Pan Flute", controlType: ControlType.Keyboard, icon: "🎶" },
  {
    value: "blown_bottle",
    label: "Blown Bottle",
    controlType: ControlType.Keyboard,
    icon: "🎶",
  },
  {
    value: "shakuhachi",
    label: "Shakuhachi",
    controlType: ControlType.Keyboard,
    icon: "🎶",
  },
  { value: "whistle", label: "Whistle", controlType: ControlType.Keyboard, icon: "🎶" },
  { value: "ocarina", label: "Ocarina", controlType: ControlType.Keyboard, icon: "🎶" },

  // Synth Lead
  {
    value: "lead_1_square",
    label: "Lead 1 (Square)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "lead_2_sawtooth",
    label: "Lead 2 (Sawtooth)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "lead_3_calliope",
    label: "Lead 3 (Calliope)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "lead_4_chiff",
    label: "Lead 4 (Chiff)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "lead_5_charang",
    label: "Lead 5 (Charang)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "lead_6_voice",
    label: "Lead 6 (Voice)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "lead_7_fifths",
    label: "Lead 7 (Fifths)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "lead_8_bass__lead",
    label: "Lead 8 (Bass + Lead)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },

  // Synth Pad
  {
    value: "pad_1_new_age",
    label: "Pad 1 (New Age)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "pad_2_warm",
    label: "Pad 2 (Warm)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "pad_3_polysynth",
    label: "Pad 3 (Polysynth)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "pad_4_choir",
    label: "Pad 4 (Choir)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "pad_5_bowed",
    label: "Pad 5 (Bowed)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "pad_6_metallic",
    label: "Pad 6 (Metallic)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "pad_7_halo",
    label: "Pad 7 (Halo)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "pad_8_sweep",
    label: "Pad 8 (Sweep)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },

  // Synth Effects
  {
    value: "fx_1_rain",
    label: "FX 1 (Rain)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "fx_2_soundtrack",
    label: "FX 2 (Soundtrack)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "fx_3_crystal",
    label: "FX 3 (Crystal)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "fx_4_atmosphere",
    label: "FX 4 (Atmosphere)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "fx_5_brightness",
    label: "FX 5 (Brightness)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "fx_6_goblins",
    label: "FX 6 (Goblins)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "fx_7_echoes",
    label: "FX 7 (Echoes)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "fx_8_scifi",
    label: "FX 8 (Sci-Fi)",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },

  // Ethnic
  { value: "sitar", label: "Sitar", controlType: ControlType.Keyboard, icon: "🎻" },
  { value: "banjo", label: "Banjo", controlType: ControlType.Keyboard, icon: "🪕" },
  { value: "shamisen", label: "Shamisen", controlType: ControlType.Keyboard, icon: "🎻" },
  { value: "koto", label: "Koto", controlType: ControlType.Keyboard, icon: "🎻" },
  { value: "kalimba", label: "Kalimba", controlType: ControlType.Keyboard, icon: "🎹" },
  { value: "bagpipe", label: "Bagpipe", controlType: ControlType.Keyboard, icon: "🎶" },
  { value: "fiddle", label: "Fiddle", controlType: ControlType.Keyboard, icon: "🎻" },
  { value: "shanai", label: "Shanai", controlType: ControlType.Keyboard, icon: "🎶" },

  // Percussive
  {
    value: "tinkle_bell",
    label: "Tinkle Bell",
    controlType: ControlType.Keyboard,
    icon: "🔔",
  },
  { value: "agogo", label: "Agogo", controlType: ControlType.Keyboard, icon: "🥁" },
  {
    value: "steel_drums",
    label: "Steel Drums",
    controlType: ControlType.Keyboard,
    icon: "🥁",
  },
  { value: "woodblock", label: "Woodblock", controlType: ControlType.Keyboard, icon: "🥁" },
  {
    value: "taiko_drum",
    label: "Taiko Drum",
    controlType: ControlType.Keyboard,
    icon: "🥁",
  },
  {
    value: "melodic_tom",
    label: "Melodic Tom",
    controlType: ControlType.Keyboard,
    icon: "🥁",
  },
  {
    value: "synth_drum",
    label: "Synth Drum",
    controlType: ControlType.Keyboard,
    icon: "🥁",
  },
  {
    value: "reverse_cymbal",
    label: "Reverse Cymbal",
    controlType: ControlType.Keyboard,
    icon: "🥁",
  },

  // Sound Effects
  {
    value: "guitar_fret_noise",
    label: "Guitar Fret Noise",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  {
    value: "breath_noise",
    label: "Breath Noise",
    controlType: ControlType.Keyboard,
    icon: "🎹",
  },
  { value: "seashore", label: "Seashore", controlType: ControlType.Keyboard, icon: "🌊" },
  {
    value: "bird_tweet",
    label: "Bird Tweet",
    controlType: ControlType.Keyboard,
    icon: "🐦",
  },
  {
    value: "telephone_ring",
    label: "Telephone Ring",
    controlType: ControlType.Keyboard,
    icon: "☎️",
  },
  {
    value: "helicopter",
    label: "Helicopter",
    controlType: ControlType.Keyboard,
    icon: "🚁",
  },
  { value: "applause", label: "Applause", controlType: ControlType.Keyboard, icon: "👏" },
  { value: "gunshot", label: "Gunshot", controlType: ControlType.Keyboard, icon: "🎹" },
];

// Helper function to get instrument icon
export const getInstrumentIcon = (instrumentValue: string): string => {
  // Check all instrument arrays for the matching value
  const allInstruments = [
    ...DRUM_MACHINES,
    ...SYNTHESIZER_INSTRUMENTS,
    ...SOUNDFONT_INSTRUMENTS,
  ];
  
  const instrument = allInstruments.find(inst => inst.value === instrumentValue);
  return instrument?.icon || "🎹"; // Default to keyboard emoji if not found
};
