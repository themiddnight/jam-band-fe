import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { InstrumentCategory } from "../../../shared/constants/instruments";
import { SEQUENCER_CONSTANTS } from "../../../shared/constants";

describe("Sequencer Store category isolation", () => {
  let useSequencerStore!: typeof import("../stores/sequencerStore").useSequencerStore;

  beforeAll(async () => {
    if (typeof window !== "undefined" && typeof window.localStorage === "undefined") {
      const storage = new Map<string, string>();
      const localStorageMock = {
        get length() {
          return storage.size;
        },
        clear: () => storage.clear(),
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        key: (index: number) => Array.from(storage.keys())[index] ?? null,
      } as Storage;

      Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
        configurable: true,
      });
    }

    ({ useSequencerStore } = await import("../stores/sequencerStore"));

  });

  afterEach(() => {
    const store = useSequencerStore.getState();
    store.reset();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("sequencer-store");
    }
  });

  it("keeps drum steps isolated from melodic category", () => {
    const store = useSequencerStore.getState();

    store.setActiveCategory(InstrumentCategory.DrumBeat);
    store.addStep("A", 0, "C1");

    let currentState = useSequencerStore.getState();
    expect(currentState.banks["A"].steps).toHaveLength(1);
    expect(currentState.banks["A"].steps[0].note).toBe("C1");

    store.setActiveCategory(InstrumentCategory.Melodic);
    currentState = useSequencerStore.getState();
    expect(currentState.banks["A"].steps).toHaveLength(0);

    store.addStep("A", 0, "C4");
    currentState = useSequencerStore.getState();
    expect(currentState.banks["A"].steps).toHaveLength(1);
    expect(currentState.banks["A"].steps[0].note).toBe("C4");

    store.setActiveCategory(InstrumentCategory.DrumBeat);
    currentState = useSequencerStore.getState();
    expect(currentState.banks["A"].steps).toHaveLength(1);
    expect(currentState.banks["A"].steps[0].note).toBe("C1");
  });

  it("maintains independent settings per category", () => {
    const store = useSequencerStore.getState();

    store.setActiveCategory(InstrumentCategory.DrumBeat);
    store.setLength(8);
    store.setSpeed(2);

    store.setActiveCategory(InstrumentCategory.Melodic);
    let melodicState = useSequencerStore.getState();
    expect(melodicState.settings.length).toBe(SEQUENCER_CONSTANTS.DEFAULT_LENGTH);
    expect(melodicState.settings.speed).toBe(SEQUENCER_CONSTANTS.DEFAULT_SPEED);

    store.setSpeed(4);

    store.setActiveCategory(InstrumentCategory.DrumBeat);
    const drumState = useSequencerStore.getState();
    expect(drumState.settings.length).toBe(8);
    expect(drumState.settings.speed).toBe(2);

    store.setActiveCategory(InstrumentCategory.Melodic);
    melodicState = useSequencerStore.getState();
    expect(melodicState.settings.speed).toBe(4);
  });
});