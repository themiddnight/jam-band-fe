import React, { useState } from 'react';
import { useProjectManager } from '../hooks/useProjectManager';

export function ProjectMenu() {
  const {
    isSaving,
    isLoading,
    error,
    // lastSaved,
    hasUnsavedChanges,
    // saveProject,
    saveProjectAs,
    loadProject,
    recoverProject,
  } = useProjectManager({
    enableAutoSave: true,
    autoSaveInterval: 60000, // 1 minute
  });

  const [projectName, setProjectName] = useState('Untitled Project');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showRecoverDialog, setShowRecoverDialog] = useState(false);

  // const handleSave = async () => {
  //   try {
  //     await saveProject(projectName);
  //   } catch (err) {
  //     console.error('Save failed:', err);
  //   }
  // };

  const handleSaveAs = async () => {
    setShowSaveDialog(true);
  };

  const handleSaveWithName = async (name: string) => {
    try {
      await saveProjectAs(name);
      setProjectName(name);
      setShowSaveDialog(false);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleLoad = async () => {
    try {
      await loadProject();
    } catch (err) {
      console.error('Load failed:', err);
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
        {/* <button 
          className="btn btn-xs btn-primary" 
          onClick={handleSave} 
          disabled={isSaving || !hasUnsavedChanges}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button> */}
        
        <button 
          className="btn btn-xs btn-secondary" 
          onClick={handleSaveAs} 
          disabled={isSaving}
        >
          Save As...
        </button>
        
        <button 
          className="btn btn-xs btn-accent" 
          onClick={handleLoad} 
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Load Project'}
        </button>

        {/* {lastSaved && (
          <span className="text-sm text-base-content/70 ml-4">
            Last saved: {lastSaved.toLocaleTimeString()}
          </span>
        )} */}

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

      {/* Save Dialog */}
      {showSaveDialog && (
        <SaveDialog
          defaultName={projectName}
          onSave={handleSaveWithName}
          onCancel={() => setShowSaveDialog(false)}
        />
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

// Save Dialog Component
function SaveDialog({
  defaultName,
  onSave,
  onCancel,
}: {
  defaultName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h2 className="font-bold text-lg mb-4">Save Project</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="input input-bordered w-full"
          autoFocus
        />
        <div className="modal-action">
          <button className="btn btn-primary" onClick={() => onSave(name)}>
            Save
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
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
