import React from 'react';
import type { ReactNode } from 'react';
import type { Socket } from 'socket.io-client';

import { useDAWCollaboration } from '../hooks/useDAWCollaboration';

import {
  DAWCollaborationContext,
  type DAWCollaborationContextValue,
} from './DAWCollaborationContext.shared';

interface DAWCollaborationProviderProps {
  children: ReactNode;
  socket: Socket | null;
  roomId: string | null;
  enabled?: boolean;
  value?: DAWCollaborationContextValue;
}

export const DAWCollaborationProvider: React.FC<DAWCollaborationProviderProps> = ({
  children,
  socket,
  roomId,
  enabled = true,
  value,
}) => {
  const defaultCollaboration = useDAWCollaboration({ socket, roomId, enabled });
  const collaboration = value ?? defaultCollaboration;

  return (
    <DAWCollaborationContext.Provider value={collaboration}>
      {children}
    </DAWCollaborationContext.Provider>
  );
};

