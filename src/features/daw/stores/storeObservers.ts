import { useHistoryStore } from './historyStore';
import { usePianoRollStore } from './pianoRollStore';
import { useRegionStore } from './regionStore';
import { useTrackStore } from './trackStore';

let initialized = false;
let timeoutId: number | undefined;

const scheduleHistoryRecord = (delay = 120) => {
  if (typeof window === 'undefined') {
    useHistoryStore.getState().recordSnapshot();
    return;
  }
  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }
  timeoutId = window.setTimeout(() => {
    useHistoryStore.getState().recordSnapshot();
  }, delay);
};

export const initializeStoreObservers = () => {
  if (initialized) {
    return;
  }
  initialized = true;

  const trackUnsubscribe = useTrackStore.subscribe(
    () => scheduleHistoryRecord()
  );

  const regionUnsubscribe = useRegionStore.subscribe(
    () => scheduleHistoryRecord()
  );

  const pianoRollUnsubscribe = usePianoRollStore.subscribe(
    () => scheduleHistoryRecord()
  );

  scheduleHistoryRecord(0);

  return () => {
    trackUnsubscribe();
    regionUnsubscribe();
    pianoRollUnsubscribe();
    if (timeoutId && typeof window !== 'undefined') {
      window.clearTimeout(timeoutId);
    }
    initialized = false;
  };
};

