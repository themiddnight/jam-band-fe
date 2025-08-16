import {
  SOUNDFONT_INSTRUMENTS,
  DRUM_MACHINES,
  SYNTHESIZER_INSTRUMENTS,
} from "../../../shared/constants/instruments";
import type { GroupedOption } from "../../ui";

// Group soundfont instruments by category
export const groupSoundfontInstruments = (): GroupedOption[] => {
  const groups: Record<string, GroupedOption[]> = {
    Piano: [],
    "Chromatic Percussion": [],
    Organ: [],
    Guitar: [],
    Bass: [],
    Strings: [],
    Ensemble: [],
    Brass: [],
    Reed: [],
    Pipe: [],
    "Synth Lead": [],
    "Synth Pad": [],
    "Synth Effects": [],
    Ethnic: [],
    Percussive: [],
    "Sound Effects": [],
  };

  SOUNDFONT_INSTRUMENTS.forEach((instrument) => {
    // Determine group based on instrument value
    let group = "Other";

    if (
      instrument.value.includes("piano") ||
      instrument.value.includes("harpsichord") ||
      instrument.value.includes("clavinet")
    ) {
      group = "Piano";
    } else if (
      instrument.value.includes("celesta") ||
      instrument.value.includes("glockenspiel") ||
      instrument.value.includes("music_box") ||
      instrument.value.includes("vibraphone") ||
      instrument.value.includes("marimba") ||
      instrument.value.includes("xylophone") ||
      instrument.value.includes("tubular_bells") ||
      instrument.value.includes("dulcimer")
    ) {
      group = "Chromatic Percussion";
    } else if (
      instrument.value.includes("organ") ||
      instrument.value.includes("accordion") ||
      instrument.value.includes("harmonica")
    ) {
      group = "Organ";
    } else if (instrument.value.includes("guitar")) {
      group = "Guitar";
    } else if (instrument.value.includes("bass")) {
      group = "Bass";
    } else if (
      instrument.value.includes("violin") ||
      instrument.value.includes("viola") ||
      instrument.value.includes("cello") ||
      instrument.value.includes("contrabass") ||
      instrument.value.includes("strings") ||
      instrument.value.includes("harp") ||
      instrument.value.includes("timpani")
    ) {
      group = "Strings";
    } else if (
      instrument.value.includes("ensemble") ||
      instrument.value.includes("choir") ||
      instrument.value.includes("voice") ||
      instrument.value.includes("orchestra")
    ) {
      group = "Ensemble";
    } else if (
      instrument.value.includes("trumpet") ||
      instrument.value.includes("trombone") ||
      instrument.value.includes("tuba") ||
      instrument.value.includes("horn") ||
      instrument.value.includes("brass")
    ) {
      group = "Brass";
    } else if (
      instrument.value.includes("sax") ||
      instrument.value.includes("oboe") ||
      instrument.value.includes("bassoon") ||
      instrument.value.includes("clarinet")
    ) {
      group = "Reed";
    } else if (
      instrument.value.includes("piccolo") ||
      instrument.value.includes("flute") ||
      instrument.value.includes("recorder") ||
      instrument.value.includes("pan_flute") ||
      instrument.value.includes("bottle") ||
      instrument.value.includes("shakuhachi") ||
      instrument.value.includes("whistle") ||
      instrument.value.includes("ocarina")
    ) {
      group = "Pipe";
    } else if (instrument.value.includes("lead_")) {
      group = "Synth Lead";
    } else if (instrument.value.includes("pad_")) {
      group = "Synth Pad";
    } else if (instrument.value.includes("fx_")) {
      group = "Synth Effects";
    } else if (
      instrument.value.includes("sitar") ||
      instrument.value.includes("banjo") ||
      instrument.value.includes("shamisen") ||
      instrument.value.includes("koto") ||
      instrument.value.includes("kalimba") ||
      instrument.value.includes("bagpipe") ||
      instrument.value.includes("fiddle") ||
      instrument.value.includes("shanai")
    ) {
      group = "Ethnic";
    } else if (
      instrument.value.includes("bell") ||
      instrument.value.includes("agogo") ||
      instrument.value.includes("steel_drums") ||
      instrument.value.includes("woodblock") ||
      instrument.value.includes("taiko") ||
      instrument.value.includes("tom") ||
      instrument.value.includes("synth_drum") ||
      instrument.value.includes("cymbal")
    ) {
      group = "Percussive";
    } else if (
      instrument.value.includes("noise") ||
      instrument.value.includes("seashore") ||
      instrument.value.includes("bird") ||
      instrument.value.includes("telephone") ||
      instrument.value.includes("helicopter") ||
      instrument.value.includes("applause") ||
      instrument.value.includes("gunshot")
    ) {
      group = "Sound Effects";
    }

    if (groups[group]) {
      groups[group].push({
        value: instrument.value,
        label: instrument.label,
        group: group,
        controlType: instrument.controlType,
        icon: instrument.icon,
      });
    }
  });

  // Convert to flat array and filter out empty groups
  return Object.entries(groups)
    .filter(([, instruments]) => instruments.length > 0)
    .flatMap(([, instruments]) => instruments);
};

// Group synthesizer instruments by type
export const groupSynthesizerInstruments = (): GroupedOption[] => {
  const groups: Record<string, GroupedOption[]> = {
    Analog: [],
    FM: [],
  };

  SYNTHESIZER_INSTRUMENTS.forEach((instrument) => {
    const group = instrument.type === "analog" ? "Analog" : "FM";
    groups[group].push({
      value: instrument.value,
      label: instrument.label,
      group: group,
      controlType: instrument.controlType,
      type: instrument.type,
      polyphony: instrument.polyphony,
      icon: instrument.icon,
    });
  });

  return Object.entries(groups)
    .filter(([, instruments]) => instruments.length > 0)
    .flatMap(([, instruments]) => instruments);
};

// Group drum machines
export const groupDrumMachines = (
  dynamicDrumMachines = DRUM_MACHINES,
): GroupedOption[] => {
  return dynamicDrumMachines.map((instrument) => ({
    value: instrument.value,
    label: instrument.label,
    group: "Drum Machines",
    controlType: instrument.controlType,
    icon: instrument.icon,
  }));
};

// Get grouped instruments for a specific category
export const getGroupedInstrumentsForCategory = (
  category: string,
  dynamicDrumMachines = DRUM_MACHINES,
): GroupedOption[] => {
  switch (category) {
    case "melodic":
      return groupSoundfontInstruments();
    case "drum_beat":
      return groupDrumMachines(dynamicDrumMachines);
    case "synthesizer":
      return groupSynthesizerInstruments();
    default:
      return groupSoundfontInstruments();
  }
};
