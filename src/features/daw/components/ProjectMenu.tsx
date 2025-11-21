import React, { useState } from 'react';
import { useProjectManager } from '../hooks/useProjectManager';
import { useRoom } from '@/features/rooms';

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
      <div className="menu-bar flex items-center gap-2 p-2 bg-base-200">
        <button 
          className="btn btn-xs btn-secondary" 
          onClick={handleSave} 
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Project'}
        </button>
        
        {canLoadProject && (
          <button 
            className="btn btn-xs btn-accent" 
            onClick={handleLoad} 
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load Project'}
          </button>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <span className="text-sm text-info ml-2">
            Uploading: {Math.round(uploadProgress)}%
          </span>
        )}

        {hasUnsavedChanges && (
          <span className="text-warning ml-2" title="Unsaved changes">●</span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error m-2">
          <span>{error}</span>
        </div>
      )}

      {/* Recover Dialog */}
      {showRecoverDialog && (
        <RecoverDialog
          onRecover={handleRecover}
          onCancel={() => setShowRecoverDialog(false)}
        />
      )}
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
      <div className="modal-box">
        <h2 className="font-bold text-lg mb-4">Recover Project</h2>
        <p className="mb-4">
          An auto-saved version of your project was found. Would you like to recover it?
        </p>
        <div className="modal-action">
          <button className="btn btn-primary" onClick={onRecover}>
            Recover
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
