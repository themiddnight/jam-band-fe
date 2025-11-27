import React, { useState } from 'react';
import { useProjectManager } from '../hooks/useProjectManager';
import { useRoom } from '@/features/rooms';
import { useMixdown } from '../hooks/useMixdown';
import { MixdownSettingsModal } from './MixdownSettingsModal';
import { MixdownProgressModal } from './MixdownProgressModal';
import type { MixdownSettings } from '../hooks/useMixdown';

type ProjectMenuProps = {
  canLoadProject?: boolean;
};

export function ProjectMenu({ canLoadProject = true }: ProjectMenuProps) {
  const {
    isSaving,
    isLoading,
    error,
    hasUnsavedChanges,
    saveProjectAs,
    loadProject,
    loadProjectAndUploadToRoom,
    recoverProject,
  } = useProjectManager({
    enableAutoSave: true,
    autoSaveInterval: 60000, // 1 minute
  });

  const { currentRoom, currentUser } = useRoom();
  const [showRecoverDialog, setShowRecoverDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Mixdown state
  const { isMixingDown, progress, error: mixdownError, startMixdown, abortMixdown } = useMixdown();
  const [showMixdownSettings, setShowMixdownSettings] = useState(false);

  const handleSave = async () => {
    try {
      await saveProjectAs('project');
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleLoad = async () => {
    try {
      // If in a room, upload to server for distribution
      if (currentRoom?.id && currentUser?.id && currentUser?.username) {
        await loadProjectAndUploadToRoom(
          currentRoom.id,
          currentUser.id,
          currentUser.username,
          undefined,
          setUploadProgress
        );
      } else {
        // Otherwise just load locally
        await loadProject();
      }
    } catch (err) {
      console.error('Load failed:', err);
    } finally {
      setUploadProgress(0);
    }
  };

  const handleRecover = async () => {
    const recovered = await recoverProject();
    if (recovered) {
      setShowRecoverDialog(false);
    }
  };

  const handleMixdownClick = () => {
    setShowMixdownSettings(true);
  };

  const handleMixdownExport = async (settings: MixdownSettings) => {
    setShowMixdownSettings(false);
    
    const blob = await startMixdown(settings);
    
    if (blob) {
      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mixdown-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Show notification that project state was reloaded
      console.log('✅ Mixdown complete! Project state reloaded from server.');
      // You could add a toast notification here if you have a toast system
    }
  };

  const handleAbortMixdown = () => {
    abortMixdown();
  };

  // Check for auto-save on mount
  React.useEffect(() => {
    const checkAutoSave = async () => {
      // You could check if there's an auto-save available
      // and show the recover dialog
    };
    checkAutoSave();
  }, []);

  return (
    <div className="project-menu">
      {/* Menu Bar */}
      <div className="menu-bar flex flex-wrap items-center gap-1 sm:gap-2 p-1 sm:p-2 bg-base-200 rounded-lg">
        <button 
          className="btn btn-xs btn-soft btn-secondary" 
          onClick={handleSave} 
          disabled={isSaving || isMixingDown}
        >
          <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Project'}</span>
          <span className="sm:hidden">{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
        
        {canLoadProject && (
          <button 
            className="btn btn-xs btn-soft btn-accent" 
            onClick={handleLoad} 
            disabled={isLoading || isMixingDown}
          >
            <span className="hidden sm:inline">{isLoading ? 'Loading...' : 'Load Project'}</span>
            <span className="sm:hidden">{isLoading ? 'Loading...' : 'Load'}</span>
          </button>
        )}

        <div className='divider divider-horizontal !m-0' />

        <button
          className="btn btn-xs btn-soft btn-info"
          onClick={handleMixdownClick}
          disabled={isMixingDown}
          title="Export project as WAV file"
        >
          Mixdown
        </button>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <span className="text-xs sm:text-sm text-info ml-1 sm:ml-2">
            {Math.round(uploadProgress)}%
          </span>
        )}

        {hasUnsavedChanges && (
          <span className="text-warning ml-1 sm:ml-2 text-sm sm:text-base" title="Unsaved changes">●</span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error m-1 sm:m-2 text-xs sm:text-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Mixdown Error Display */}
      {mixdownError && (
        <div className="alert alert-error m-1 sm:m-2 text-xs sm:text-sm">
          <span>Mixdown error: {mixdownError}</span>
        </div>
      )}

      {/* Recover Dialog */}
      {showRecoverDialog && (
        <RecoverDialog
          onRecover={handleRecover}
          onCancel={() => setShowRecoverDialog(false)}
        />
      )}

      {/* Mixdown Settings Modal */}
      <MixdownSettingsModal
        open={showMixdownSettings}
        onClose={() => setShowMixdownSettings(false)}
        onExport={handleMixdownExport}
      />

      {/* Mixdown Progress Modal */}
      <MixdownProgressModal
        open={isMixingDown}
        progress={progress}
        onAbort={handleAbortMixdown}
      />
    </div>
  );
}

// Recover Dialog Component
function RecoverDialog({
  onRecover,
  onCancel,
}: {
  onRecover: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm sm:max-w-md">
        <h2 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Recover Project</h2>
        <p className="mb-3 sm:mb-4 text-sm sm:text-base">
          An auto-saved version of your project was found. Would you like to recover it?
        </p>
        <div className="modal-action">
          <button className="btn btn-xs btn-soft btn-primary" onClick={onRecover}>
            Recover
          </button>
          <button className="btn btn-xs btn-soft" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
