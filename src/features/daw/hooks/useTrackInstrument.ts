import { useCallback, useEffect } from 'react';

import { useInstrument, type SynthState } from '@/features/instruments';
import { InstrumentCategory } from '@/shared/constants/instruments';

interface UseTrackInstrumentOptions {
  instrumentId?: string;
  instrumentCategory?: InstrumentCategory;
  onSynthParamsChange?: (params: Partial<SynthState>) => void;
}

export const useTrackInstrument = ({
  instrumentId,
  instrumentCategory,
  onSynthParamsChange,
}: UseTrackInstrumentOptions) => {
  const instrument = useInstrument({
    initialInstrument: instrumentId,
    initialCategory: instrumentCategory ?? InstrumentCategory.Melodic,
    onSynthParamsChange,
  });

  useEffect(() => {
    if (!instrumentCategory || instrumentCategory === instrument.currentCategory) {
      return;
    }

    void instrument.handleCategoryChange(instrumentCategory).catch((error) => {
      console.error('Failed to update instrument category for track:', error);
    });
  }, [instrumentCategory, instrument]);

  useEffect(() => {
    if (!instrumentId || instrumentId === instrument.currentInstrument) {
      return;
    }

    void instrument.handleInstrumentChange(instrumentId).catch((error) => {
      console.error('Failed to update instrument for track:', error);
    });
  }, [instrumentId, instrument]);

  const setInstrument = useCallback(
    async (nextInstrumentId: string, category?: InstrumentCategory) => {
      if (category && category !== instrument.currentCategory) {
        await instrument.handleCategoryChange(category);
      }

      if (nextInstrumentId !== instrument.currentInstrument) {
        await instrument.handleInstrumentChange(nextInstrumentId);
      }
    },
    [instrument]
  );

  return {
    ...instrument,
    controlType: instrument.getCurrentInstrumentControlType(),
    setInstrument,
    playNotes: instrument.playNote,
    stopNotes: instrument.stopNotes,
    setSustain: instrument.setSustainState,
    stopSustainedNotes: instrument.stopSustainedNotes,
  };
};
