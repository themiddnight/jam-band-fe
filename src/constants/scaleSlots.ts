import type { Scale } from "../hooks/useScaleState";

export interface ScaleSlot {
  id: number;
  rootNote: string;
  scale: Scale;
  shortcut: string;
}

export const SCALE_SLOT_COUNT = 5;

export const DEFAULT_SCALE_SLOTS: ScaleSlot[] = [
  {
    id: 1,
    rootNote: "C",
    scale: "major",
    shortcut: "1",
  },
  {
    id: 2,
    rootNote: "G",
    scale: "major",
    shortcut: "2",
  },
  {
    id: 3,
    rootNote: "D",
    scale: "major",
    shortcut: "3",
  },
  {
    id: 4,
    rootNote: "A",
    scale: "major",
    shortcut: "4",
  },
  {
    id: 5,
    rootNote: "E",
    scale: "major",
    shortcut: "5",
  },
];

export const SCALE_SLOT_SHORTCUTS = DEFAULT_SCALE_SLOTS.map(
  (slot) => slot.shortcut,
);

export const getScaleSlotLabel = (rootNote: string, scale: Scale): string => {
  const scaleAbbreviation = scale === "major" ? "Maj" : "min";
  return `${rootNote} ${scaleAbbreviation}`;
};

export const getScaleSlotByShortcut = (
  shortcut: string,
): ScaleSlot | undefined => {
  return DEFAULT_SCALE_SLOTS.find((slot) => slot.shortcut === shortcut);
};
