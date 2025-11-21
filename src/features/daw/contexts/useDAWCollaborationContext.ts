import { useContext } from 'react';

import {
  DAWCollaborationContext,
  createNoopDAWCollaborationValue,
} from './DAWCollaborationContext.shared';

export const useDAWCollaborationContext = () => {
  const context = useContext(DAWCollaborationContext);
  if (!context) {
    return createNoopDAWCollaborationValue();
  }
  return context;
};

export type { DAWCollaborationContextValue } from './DAWCollaborationContext.shared';
