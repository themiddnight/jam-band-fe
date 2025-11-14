import {
  DRUM_MACHINES,
  InstrumentCategory,
  SOUNDFONT_INSTRUMENTS,
  SYNTHESIZER_INSTRUMENTS,
} from "@/shared/constants/instruments";

type DrumMachine = (typeof DRUM_MACHINES)[number];
type InstrumentOption = {
  value: string;
  label: string;
};

const findInstruments = (id: string) => ({
  soundfont: SOUNDFONT_INSTRUMENTS.find((inst) => inst.value === id) || null,
  synthesizer:
    SYNTHESIZER_INSTRUMENTS.find((inst) => inst.value === id) || null,
});

export const getInstrumentCategoryById = (
  instrumentId: string,
  dynamicDrumMachines: DrumMachine[] = DRUM_MACHINES,
): InstrumentCategory => {
  if (
    dynamicDrumMachines.some((instrument) => instrument.value === instrumentId)
  ) {
    return InstrumentCategory.DrumBeat;
  }

  const { synthesizer } = findInstruments(instrumentId);
  if (synthesizer) {
    return InstrumentCategory.Synthesizer;
  }

  return InstrumentCategory.Melodic;
};

const getLabelFromOptions = (
  id: string,
  options: InstrumentOption[],
): string | null => {
  const match = options.find((option) => option.value === id);
  return match?.label ?? null;
};

export const getInstrumentLabelById = (
  instrumentId: string,
  dynamicDrumMachines: DrumMachine[] = DRUM_MACHINES,
): string => {
  const drumLabel = getLabelFromOptions(instrumentId, dynamicDrumMachines);
  if (drumLabel) {
    return drumLabel;
  }

  const { synthesizer, soundfont } = findInstruments(instrumentId);
  return synthesizer?.label || soundfont?.label || "Select Instrument";
};

export const getDefaultInstrumentForCategory = (
  category: InstrumentCategory,
  dynamicDrumMachines: DrumMachine[] = DRUM_MACHINES,
): string => {
  switch (category) {
    case InstrumentCategory.DrumBeat:
      return dynamicDrumMachines[0]?.value || "TR-808";
    case InstrumentCategory.Synthesizer:
      return SYNTHESIZER_INSTRUMENTS[0]?.value || "analog_mono";
    default:
      return SOUNDFONT_INSTRUMENTS[0]?.value || "acoustic_grand_piano";
  }
};

