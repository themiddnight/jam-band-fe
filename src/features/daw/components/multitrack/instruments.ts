// Complete list of General MIDI melodic instruments (smplr soundfont)
// Based on General MIDI standard - all soundfont instruments
export const INSTRUMENT_OPTIONS = [
  // Piano (1-8)
  { id: 'acoustic_grand_piano', label: 'Acoustic Grand Piano', category: 'Piano' },
  { id: 'bright_acoustic_piano', label: 'Bright Acoustic Piano', category: 'Piano' },
  { id: 'electric_grand_piano', label: 'Electric Grand Piano', category: 'Piano' },
  { id: 'honkytonk_piano', label: 'Honky-tonk Piano', category: 'Piano' },
  { id: 'electric_piano_1', label: 'Electric Piano 1', category: 'Piano' },
  { id: 'electric_piano_2', label: 'Electric Piano 2', category: 'Piano' },
  { id: 'harpsichord', label: 'Harpsichord', category: 'Piano' },
  { id: 'clavinet', label: 'Clavinet', category: 'Piano' },
  
  // Chromatic Percussion (9-16)
  { id: 'celesta', label: 'Celesta', category: 'Chromatic Percussion' },
  { id: 'glockenspiel', label: 'Glockenspiel', category: 'Chromatic Percussion' },
  { id: 'music_box', label: 'Music Box', category: 'Chromatic Percussion' },
  { id: 'vibraphone', label: 'Vibraphone', category: 'Chromatic Percussion' },
  { id: 'marimba', label: 'Marimba', category: 'Chromatic Percussion' },
  { id: 'xylophone', label: 'Xylophone', category: 'Chromatic Percussion' },
  { id: 'tubular_bells', label: 'Tubular Bells', category: 'Chromatic Percussion' },
  { id: 'dulcimer', label: 'Dulcimer', category: 'Chromatic Percussion' },
  
  // Organ (17-24)
  { id: 'drawbar_organ', label: 'Drawbar Organ', category: 'Organ' },
  { id: 'percussive_organ', label: 'Percussive Organ', category: 'Organ' },
  { id: 'rock_organ', label: 'Rock Organ', category: 'Organ' },
  { id: 'church_organ', label: 'Church Organ', category: 'Organ' },
  { id: 'reed_organ', label: 'Reed Organ', category: 'Organ' },
  { id: 'accordion', label: 'Accordion', category: 'Organ' },
  { id: 'harmonica', label: 'Harmonica', category: 'Organ' },
  { id: 'tango_accordion', label: 'Tango Accordion', category: 'Organ' },
  
  // Guitar (25-32)
  { id: 'acoustic_guitar_nylon', label: 'Acoustic Guitar (nylon)', category: 'Guitar' },
  { id: 'acoustic_guitar_steel', label: 'Acoustic Guitar (steel)', category: 'Guitar' },
  { id: 'electric_guitar_jazz', label: 'Electric Guitar (jazz)', category: 'Guitar' },
  { id: 'electric_guitar_clean', label: 'Electric Guitar (clean)', category: 'Guitar' },
  { id: 'electric_guitar_muted', label: 'Electric Guitar (muted)', category: 'Guitar' },
  { id: 'overdriven_guitar', label: 'Overdriven Guitar', category: 'Guitar' },
  { id: 'distortion_guitar', label: 'Distortion Guitar', category: 'Guitar' },
  { id: 'guitar_harmonics', label: 'Guitar Harmonics', category: 'Guitar' },
  
  // Bass (33-40)
  { id: 'acoustic_bass', label: 'Acoustic Bass', category: 'Bass' },
  { id: 'electric_bass_finger', label: 'Electric Bass (finger)', category: 'Bass' },
  { id: 'electric_bass_pick', label: 'Electric Bass (pick)', category: 'Bass' },
  { id: 'fretless_bass', label: 'Fretless Bass', category: 'Bass' },
  { id: 'slap_bass_1', label: 'Slap Bass 1', category: 'Bass' },
  { id: 'slap_bass_2', label: 'Slap Bass 2', category: 'Bass' },
  { id: 'synth_bass_1', label: 'Synth Bass 1', category: 'Bass' },
  { id: 'synth_bass_2', label: 'Synth Bass 2', category: 'Bass' },
  
  // Strings (41-48)
  { id: 'violin', label: 'Violin', category: 'Strings' },
  { id: 'viola', label: 'Viola', category: 'Strings' },
  { id: 'cello', label: 'Cello', category: 'Strings' },
  { id: 'contrabass', label: 'Contrabass', category: 'Strings' },
  { id: 'tremolo_strings', label: 'Tremolo Strings', category: 'Strings' },
  { id: 'pizzicato_strings', label: 'Pizzicato Strings', category: 'Strings' },
  { id: 'orchestral_harp', label: 'Orchestral Harp', category: 'Strings' },
  { id: 'timpani', label: 'Timpani', category: 'Strings' },
  
  // Ensemble (49-56)
  { id: 'string_ensemble_1', label: 'String Ensemble 1', category: 'Ensemble' },
  { id: 'string_ensemble_2', label: 'String Ensemble 2', category: 'Ensemble' },
  { id: 'synth_strings_1', label: 'Synth Strings 1', category: 'Ensemble' },
  { id: 'synth_strings_2', label: 'Synth Strings 2', category: 'Ensemble' },
  { id: 'choir_aahs', label: 'Choir Aahs', category: 'Ensemble' },
  { id: 'voice_oohs', label: 'Voice Oohs', category: 'Ensemble' },
  { id: 'synth_choir', label: 'Synth Choir', category: 'Ensemble' },
  { id: 'orchestra_hit', label: 'Orchestra Hit', category: 'Ensemble' },
  
  // Brass (57-64)
  { id: 'trumpet', label: 'Trumpet', category: 'Brass' },
  { id: 'trombone', label: 'Trombone', category: 'Brass' },
  { id: 'tuba', label: 'Tuba', category: 'Brass' },
  { id: 'muted_trumpet', label: 'Muted Trumpet', category: 'Brass' },
  { id: 'french_horn', label: 'French Horn', category: 'Brass' },
  { id: 'brass_section', label: 'Brass Section', category: 'Brass' },
  { id: 'synth_brass_1', label: 'Synth Brass 1', category: 'Brass' },
  { id: 'synth_brass_2', label: 'Synth Brass 2', category: 'Brass' },
  
  // Reed (65-72)
  { id: 'soprano_sax', label: 'Soprano Sax', category: 'Reed' },
  { id: 'alto_sax', label: 'Alto Sax', category: 'Reed' },
  { id: 'tenor_sax', label: 'Tenor Sax', category: 'Reed' },
  { id: 'baritone_sax', label: 'Baritone Sax', category: 'Reed' },
  { id: 'oboe', label: 'Oboe', category: 'Reed' },
  { id: 'english_horn', label: 'English Horn', category: 'Reed' },
  { id: 'bassoon', label: 'Bassoon', category: 'Reed' },
  { id: 'clarinet', label: 'Clarinet', category: 'Reed' },
  
  // Pipe (73-80)
  { id: 'piccolo', label: 'Piccolo', category: 'Pipe' },
  { id: 'flute', label: 'Flute', category: 'Pipe' },
  { id: 'recorder', label: 'Recorder', category: 'Pipe' },
  { id: 'pan_flute', label: 'Pan Flute', category: 'Pipe' },
  { id: 'blown_bottle', label: 'Blown Bottle', category: 'Pipe' },
  { id: 'shakuhachi', label: 'Shakuhachi', category: 'Pipe' },
  { id: 'whistle', label: 'Whistle', category: 'Pipe' },
  { id: 'ocarina', label: 'Ocarina', category: 'Pipe' },
  
  // Synth Lead (81-88)
  { id: 'lead_1_square', label: 'Square Lead', category: 'Synth Lead' },
  { id: 'lead_2_sawtooth', label: 'Sawtooth Lead', category: 'Synth Lead' },
  { id: 'lead_3_calliope', label: 'Calliope Lead', category: 'Synth Lead' },
  { id: 'lead_4_chiff', label: 'Chiff Lead', category: 'Synth Lead' },
  { id: 'lead_5_charang', label: 'Charang Lead', category: 'Synth Lead' },
  { id: 'lead_6_voice', label: 'Voice Lead', category: 'Synth Lead' },
  { id: 'lead_7_fifths', label: 'Fifths Lead', category: 'Synth Lead' },
  { id: 'lead_8_bass__lead', label: 'Bass Lead', category: 'Synth Lead' },
  
  // Synth Pad (89-96)
  { id: 'pad_1_new_age', label: 'New Age Pad', category: 'Synth Pad' },
  { id: 'pad_2_warm', label: 'Warm Pad', category: 'Synth Pad' },
  { id: 'pad_3_polysynth', label: 'Polysynth Pad', category: 'Synth Pad' },
  { id: 'pad_4_choir', label: 'Choir Pad', category: 'Synth Pad' },
  { id: 'pad_5_bowed', label: 'Bowed Pad', category: 'Synth Pad' },
  { id: 'pad_6_metallic', label: 'Metallic Pad', category: 'Synth Pad' },
  { id: 'pad_7_halo', label: 'Halo Pad', category: 'Synth Pad' },
  { id: 'pad_8_sweep', label: 'Sweep Pad', category: 'Synth Pad' },
  
  // Synth Effects (97-104)
  { id: 'fx_1_rain', label: 'FX Rain', category: 'Synth Effects' },
  { id: 'fx_2_soundtrack', label: 'FX Soundtrack', category: 'Synth Effects' },
  { id: 'fx_3_crystal', label: 'FX Crystal', category: 'Synth Effects' },
  { id: 'fx_4_atmosphere', label: 'FX Atmosphere', category: 'Synth Effects' },
  { id: 'fx_5_brightness', label: 'FX Brightness', category: 'Synth Effects' },
  { id: 'fx_6_goblins', label: 'FX Goblins', category: 'Synth Effects' },
  { id: 'fx_7_echoes', label: 'FX Echoes', category: 'Synth Effects' },
  { id: 'fx_8_scifi', label: 'FX Sci-fi', category: 'Synth Effects' },
  
  // Ethnic (105-112)
  { id: 'sitar', label: 'Sitar', category: 'Ethnic' },
  { id: 'banjo', label: 'Banjo', category: 'Ethnic' },
  { id: 'shamisen', label: 'Shamisen', category: 'Ethnic' },
  { id: 'koto', label: 'Koto', category: 'Ethnic' },
  { id: 'kalimba', label: 'Kalimba', category: 'Ethnic' },
  { id: 'bagpipe', label: 'Bagpipe', category: 'Ethnic' },
  { id: 'fiddle', label: 'Fiddle', category: 'Ethnic' },
  { id: 'shanai', label: 'Shanai', category: 'Ethnic' },
  
  // Percussive (113-120)
  { id: 'tinkle_bell', label: 'Tinkle Bell', category: 'Percussive' },
  { id: 'agogo', label: 'Agogo', category: 'Percussive' },
  { id: 'steel_drums', label: 'Steel Drums', category: 'Percussive' },
  { id: 'woodblock', label: 'Woodblock', category: 'Percussive' },
  { id: 'taiko_drum', label: 'Taiko Drum', category: 'Percussive' },
  { id: 'melodic_tom', label: 'Melodic Tom', category: 'Percussive' },
  { id: 'synth_drum', label: 'Synth Drum', category: 'Percussive' },
  { id: 'reverse_cymbal', label: 'Reverse Cymbal', category: 'Percussive' },
  
  // Sound Effects (121-128)
  { id: 'guitar_fret_noise', label: 'Guitar Fret Noise', category: 'Sound Effects' },
  { id: 'breath_noise', label: 'Breath Noise', category: 'Sound Effects' },
  { id: 'seashore', label: 'Seashore', category: 'Sound Effects' },
  { id: 'bird_tweet', label: 'Bird Tweet', category: 'Sound Effects' },
  { id: 'telephone_ring', label: 'Telephone Ring', category: 'Sound Effects' },
  { id: 'helicopter', label: 'Helicopter', category: 'Sound Effects' },
  { id: 'applause', label: 'Applause', category: 'Sound Effects' },
  { id: 'gunshot', label: 'Gunshot', category: 'Sound Effects' },
];

