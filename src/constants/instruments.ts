import { ControlType } from "../types";

// Instrument categories
export enum InstrumentCategory {
  Melodic = "melodic",
  DrumBeat = "drum_beat", 
  Synthesizer = "synthesizer"
}

// Available drum machines from smplr
export const DRUM_MACHINES = [
  { value: "TR-808", label: "Roland TR-808", controlType: ControlType.Drumpad },
  { value: "LM-2", label: "LinnDrum LM-2", controlType: ControlType.Drumpad },
  { value: "Casio-RZ1", label: "Casio RZ-1", controlType: ControlType.Drumpad },
  { value: "MFB-512", label: "Fricke MFB-512", controlType: ControlType.Drumpad },
  { value: "Roland CR-8000", label: "Roland CR-8000", controlType: ControlType.Drumpad },
];

// Available synthesizer instruments using Tone.js
export const SYNTHESIZER_INSTRUMENTS = [
  // Analog Synthesizers
  { value: "analog_mono", label: "Analog Mono Synth", controlType: ControlType.Keyboard, type: "analog", polyphony: "mono" },
  { value: "analog_poly", label: "Analog Poly Synth", controlType: ControlType.Keyboard, type: "analog", polyphony: "poly" },
  
  // FM Synthesizers
  { value: "fm_mono", label: "FM Mono Synth", controlType: ControlType.Keyboard, type: "fm", polyphony: "mono" },
  { value: "fm_poly", label: "FM Poly Synth", controlType: ControlType.Keyboard, type: "fm", polyphony: "poly" },
];

// List of available soundfont instruments
export const SOUNDFONT_INSTRUMENTS = [
  // Piano
  { value: "acoustic_grand_piano", label: "Acoustic Grand Piano", controlType: ControlType.Keyboard },
  { value: "bright_acoustic_piano", label: "Bright Acoustic Piano", controlType: ControlType.Keyboard },
  { value: "electric_grand_piano", label: "Electric Grand Piano", controlType: ControlType.Keyboard },
  { value: "honkytonk_piano", label: "Honky-tonk Piano", controlType: ControlType.Keyboard },
  { value: "electric_piano_1", label: "Electric Piano 1", controlType: ControlType.Keyboard },
  { value: "electric_piano_2", label: "Electric Piano 2", controlType: ControlType.Keyboard },
  { value: "harpsichord", label: "Harpsichord", controlType: ControlType.Keyboard },
  { value: "clavinet", label: "Clavinet", controlType: ControlType.Keyboard },
  
  // Chromatic Percussion
  { value: "celesta", label: "Celesta", controlType: ControlType.Keyboard },
  { value: "glockenspiel", label: "Glockenspiel", controlType: ControlType.Keyboard },
  { value: "music_box", label: "Music Box", controlType: ControlType.Keyboard },
  { value: "vibraphone", label: "Vibraphone", controlType: ControlType.Keyboard },
  { value: "marimba", label: "Marimba", controlType: ControlType.Keyboard },
  { value: "xylophone", label: "Xylophone", controlType: ControlType.Keyboard },
  { value: "tubular_bells", label: "Tubular Bells", controlType: ControlType.Keyboard },
  { value: "dulcimer", label: "Dulcimer", controlType: ControlType.Keyboard },
  
  // Organ
  { value: "drawbar_organ", label: "Drawbar Organ", controlType: ControlType.Keyboard },
  { value: "percussive_organ", label: "Percussive Organ", controlType: ControlType.Keyboard },
  { value: "rock_organ", label: "Rock Organ", controlType: ControlType.Keyboard },
  { value: "church_organ", label: "Church Organ", controlType: ControlType.Keyboard },
  { value: "reed_organ", label: "Reed Organ", controlType: ControlType.Keyboard },
  { value: "accordion", label: "Accordion", controlType: ControlType.Keyboard },
  { value: "harmonica", label: "Harmonica", controlType: ControlType.Keyboard },
  { value: "tango_accordion", label: "Tango Accordion", controlType: ControlType.Keyboard },
  
  // Guitar
  { value: "acoustic_guitar_nylon", label: "Acoustic Guitar (Nylon)", controlType: ControlType.Guitar },
  { value: "acoustic_guitar_steel", label: "Acoustic Guitar (Steel)", controlType: ControlType.Guitar },
  { value: "electric_guitar_jazz", label: "Electric Guitar (Jazz)", controlType: ControlType.Guitar },
  { value: "electric_guitar_clean", label: "Electric Guitar (Clean)", controlType: ControlType.Guitar },
  { value: "electric_guitar_muted", label: "Electric Guitar (Muted)", controlType: ControlType.Guitar },
  { value: "overdriven_guitar", label: "Overdriven Guitar", controlType: ControlType.Guitar },
  { value: "distortion_guitar", label: "Distortion Guitar", controlType: ControlType.Guitar },
  { value: "guitar_harmonics", label: "Guitar Harmonics", controlType: ControlType.Guitar },
  
  // Bass
  { value: "acoustic_bass", label: "Acoustic Bass", controlType: ControlType.Bass },
  { value: "electric_bass_finger", label: "Electric Bass (Finger)", controlType: ControlType.Bass },
  { value: "electric_bass_pick", label: "Electric Bass (Pick)", controlType: ControlType.Bass },
  { value: "fretless_bass", label: "Fretless Bass", controlType: ControlType.Bass },
  { value: "slap_bass_1", label: "Slap Bass 1", controlType: ControlType.Bass },
  { value: "slap_bass_2", label: "Slap Bass 2", controlType: ControlType.Bass },
  { value: "synth_bass_1", label: "Synth Bass 1", controlType: ControlType.Bass },
  { value: "synth_bass_2", label: "Synth Bass 2", controlType: ControlType.Bass },
  
  // Strings
  { value: "violin", label: "Violin", controlType: ControlType.Keyboard },
  { value: "viola", label: "Viola", controlType: ControlType.Keyboard },
  { value: "cello", label: "Cello", controlType: ControlType.Keyboard },
  { value: "contrabass", label: "Contrabass", controlType: ControlType.Keyboard },
  { value: "tremolo_strings", label: "Tremolo Strings", controlType: ControlType.Keyboard },
  { value: "pizzicato_strings", label: "Pizzicato Strings", controlType: ControlType.Keyboard },
  { value: "orchestral_harp", label: "Orchestral Harp", controlType: ControlType.Keyboard },
  { value: "timpani", label: "Timpani", controlType: ControlType.Keyboard },
  
  // Ensemble
  { value: "string_ensemble_1", label: "String Ensemble 1", controlType: ControlType.Keyboard },
  { value: "string_ensemble_2", label: "String Ensemble 2", controlType: ControlType.Keyboard },
  { value: "synth_strings_1", label: "Synth Strings 1", controlType: ControlType.Keyboard },
  { value: "synth_strings_2", label: "Synth Strings 2", controlType: ControlType.Keyboard },
  { value: "choir_aahs", label: "Choir Aahs", controlType: ControlType.Keyboard },
  { value: "voice_oohs", label: "Voice Oohs", controlType: ControlType.Keyboard },
  { value: "synth_choir", label: "Synth Choir", controlType: ControlType.Keyboard },
  { value: "orchestra_hit", label: "Orchestra Hit", controlType: ControlType.Keyboard },
  
  // Brass
  { value: "trumpet", label: "Trumpet", controlType: ControlType.Keyboard },
  { value: "trombone", label: "Trombone", controlType: ControlType.Keyboard },
  { value: "tuba", label: "Tuba", controlType: ControlType.Keyboard },
  { value: "muted_trumpet", label: "Muted Trumpet", controlType: ControlType.Keyboard },
  { value: "french_horn", label: "French Horn", controlType: ControlType.Keyboard },
  { value: "brass_section", label: "Brass Section", controlType: ControlType.Keyboard },
  { value: "synth_brass_1", label: "Synth Brass 1", controlType: ControlType.Keyboard },
  { value: "synth_brass_2", label: "Synth Brass 2", controlType: ControlType.Keyboard },
  
  // Reed
  { value: "soprano_sax", label: "Soprano Sax", controlType: ControlType.Keyboard },
  { value: "alto_sax", label: "Alto Sax", controlType: ControlType.Keyboard },
  { value: "tenor_sax", label: "Tenor Sax", controlType: ControlType.Keyboard },
  { value: "baritone_sax", label: "Baritone Sax", controlType: ControlType.Keyboard },
  { value: "oboe", label: "Oboe", controlType: ControlType.Keyboard },
  { value: "english_horn", label: "English Horn", controlType: ControlType.Keyboard },
  { value: "bassoon", label: "Bassoon", controlType: ControlType.Keyboard },
  { value: "clarinet", label: "Clarinet", controlType: ControlType.Keyboard },
  
  // Pipe
  { value: "piccolo", label: "Piccolo", controlType: ControlType.Keyboard },
  { value: "flute", label: "Flute", controlType: ControlType.Keyboard },
  { value: "recorder", label: "Recorder", controlType: ControlType.Keyboard },
  { value: "pan_flute", label: "Pan Flute", controlType: ControlType.Keyboard },
  { value: "blown_bottle", label: "Blown Bottle", controlType: ControlType.Keyboard },
  { value: "shakuhachi", label: "Shakuhachi", controlType: ControlType.Keyboard },
  { value: "whistle", label: "Whistle", controlType: ControlType.Keyboard },
  { value: "ocarina", label: "Ocarina", controlType: ControlType.Keyboard },
  
  // Synth Lead
  { value: "lead_1_square", label: "Lead 1 (Square)", controlType: ControlType.Keyboard },
  { value: "lead_2_sawtooth", label: "Lead 2 (Sawtooth)", controlType: ControlType.Keyboard },
  { value: "lead_3_calliope", label: "Lead 3 (Calliope)", controlType: ControlType.Keyboard },
  { value: "lead_4_chiff", label: "Lead 4 (Chiff)", controlType: ControlType.Keyboard },
  { value: "lead_5_charang", label: "Lead 5 (Charang)", controlType: ControlType.Keyboard },
  { value: "lead_6_voice", label: "Lead 6 (Voice)", controlType: ControlType.Keyboard },
  { value: "lead_7_fifths", label: "Lead 7 (Fifths)", controlType: ControlType.Keyboard },
  { value: "lead_8_bass__lead", label: "Lead 8 (Bass + Lead)", controlType: ControlType.Keyboard },
  
  // Synth Pad
  { value: "pad_1_new_age", label: "Pad 1 (New Age)", controlType: ControlType.Keyboard },
  { value: "pad_2_warm", label: "Pad 2 (Warm)", controlType: ControlType.Keyboard },
  { value: "pad_3_polysynth", label: "Pad 3 (Polysynth)", controlType: ControlType.Keyboard },
  { value: "pad_4_choir", label: "Pad 4 (Choir)", controlType: ControlType.Keyboard },
  { value: "pad_5_bowed", label: "Pad 5 (Bowed)", controlType: ControlType.Keyboard },
  { value: "pad_6_metallic", label: "Pad 6 (Metallic)", controlType: ControlType.Keyboard },
  { value: "pad_7_halo", label: "Pad 7 (Halo)", controlType: ControlType.Keyboard },
  { value: "pad_8_sweep", label: "Pad 8 (Sweep)", controlType: ControlType.Keyboard },
  
  // Synth Effects
  { value: "fx_1_rain", label: "FX 1 (Rain)", controlType: ControlType.Keyboard },
  { value: "fx_2_soundtrack", label: "FX 2 (Soundtrack)", controlType: ControlType.Keyboard },
  { value: "fx_3_crystal", label: "FX 3 (Crystal)", controlType: ControlType.Keyboard },
  { value: "fx_4_atmosphere", label: "FX 4 (Atmosphere)", controlType: ControlType.Keyboard },
  { value: "fx_5_brightness", label: "FX 5 (Brightness)", controlType: ControlType.Keyboard },
  { value: "fx_6_goblins", label: "FX 6 (Goblins)", controlType: ControlType.Keyboard },
  { value: "fx_7_echoes", label: "FX 7 (Echoes)", controlType: ControlType.Keyboard },
  { value: "fx_8_scifi", label: "FX 8 (Sci-Fi)", controlType: ControlType.Keyboard },
  
  // Ethnic
  { value: "sitar", label: "Sitar", controlType: ControlType.Keyboard },
  { value: "banjo", label: "Banjo", controlType: ControlType.Keyboard },
  { value: "shamisen", label: "Shamisen", controlType: ControlType.Keyboard },
  { value: "koto", label: "Koto", controlType: ControlType.Keyboard },
  { value: "kalimba", label: "Kalimba", controlType: ControlType.Keyboard },
  { value: "bagpipe", label: "Bagpipe", controlType: ControlType.Keyboard },
  { value: "fiddle", label: "Fiddle", controlType: ControlType.Keyboard },
  { value: "shanai", label: "Shanai", controlType: ControlType.Keyboard },
  
  // Percussive
  { value: "tinkle_bell", label: "Tinkle Bell", controlType: ControlType.Drumpad },
  { value: "agogo", label: "Agogo", controlType: ControlType.Drumpad },
  { value: "steel_drums", label: "Steel Drums", controlType: ControlType.Drumpad },
  { value: "woodblock", label: "Woodblock", controlType: ControlType.Drumpad },
  { value: "taiko_drum", label: "Taiko Drum", controlType: ControlType.Drumpad },
  { value: "melodic_tom", label: "Melodic Tom", controlType: ControlType.Drumpad },
  { value: "synth_drum", label: "Synth Drum", controlType: ControlType.Drumpad },
  { value: "reverse_cymbal", label: "Reverse Cymbal", controlType: ControlType.Drumpad },
  
  // Sound Effects
  { value: "guitar_fret_noise", label: "Guitar Fret Noise", controlType: ControlType.Drumpad },
  { value: "breath_noise", label: "Breath Noise", controlType: ControlType.Drumpad },
  { value: "seashore", label: "Seashore", controlType: ControlType.Drumpad },
  { value: "bird_tweet", label: "Bird Tweet", controlType: ControlType.Drumpad },
  { value: "telephone_ring", label: "Telephone Ring", controlType: ControlType.Drumpad },
  { value: "helicopter", label: "Helicopter", controlType: ControlType.Drumpad },
  { value: "applause", label: "Applause", controlType: ControlType.Drumpad },
  { value: "gunshot", label: "Gunshot", controlType: ControlType.Drumpad },
]; 