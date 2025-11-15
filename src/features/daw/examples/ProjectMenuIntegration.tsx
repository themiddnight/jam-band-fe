/**
 * Example: How to integrate the Project Save/Load system into your Arrange Room
 * 
 * This file shows different ways to add save/load functionality to your DAW.
 */

import React from 'react';
import { ProjectMenu } from '../components/ProjectMenu';
import { useProjectManager } from '../hooks/useProjectManager';
import { useTrackStore } from '../stores/trackStore';
import { useRegionStore } from '../stores/regionStore';
import { useProjectStore } from '../stores/projectStore';

// ============================================================================
// Example 1: Simple Integration - Just add the ProjectMenu component
// ============================================================================

export function ArrangeRoomWithProjectMenu() {
  return (
    <div className="arrange-room">
      {/* Add the ProjectMenu at the top */}
      <ProjectMenu />
      
      {/* Your existing DAW UI */}
      <div className="daw-content">
        {/* Timeline, tracks, piano roll, etc. */}
      </div>
    </div>
  );
}

// ============================================================================
// Example 2: Custom Save/Load Buttons
// ============================================================================

export function ArrangeRoomWithCustomButtons() {
  const { saveProject, loadProject, hasUnsavedChanges, isSaving } = useProjectManager();
  const [projectName, setProjectName] = React.useState('My Project');

  return (
    <div className="arrange-room">
      <div className="toolbar">
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Project name"
          className="input input-sm input-bordered"
        />
        
        <button 
          onClick={() => saveProject(projectName)}
          disabled={isSaving}
          className="btn btn-sm btn-primary"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        
        <button 
          onClick={() => loadProject()}
          className="btn btn-sm btn-secondary"
        >
          Load
        </button>

        {hasUnsavedChanges && (
          <span className="badge badge-warning">Unsaved</span>
        )}
      </div>
      
      {/* Your DAW UI */}
    </div>
  );
}

// ============================================================================
// Example 3: With Auto-Save and Change Tracking
// ============================================================================

export function ArrangeRoomWithAutoSave() {
  const { markAsModified, lastSaved } = useProjectManager({
    enableAutoSave: true,
    autoSaveInterval: 60000, // 1 minute
  });

  // Track changes in stores and mark as modified
  React.useEffect(() => {
    const unsubscribeTrack = useTrackStore.subscribe(() => {
      markAsModified();
    });

    const unsubscribeRegion = useRegionStore.subscribe(() => {
      markAsModified();
    });

    const unsubscribeProject = useProjectStore.subscribe(() => {
      markAsModified();
    });

    return () => {
      unsubscribeTrack();
      unsubscribeRegion();
      unsubscribeProject();
    };
  }, [markAsModified]);

  return (
    <div className="arrange-room">
      <ProjectMenu />
      
      {lastSaved && (
        <div className="status-bar">
          Auto-saved at {lastSaved.toLocaleTimeString()}
        </div>
      )}
      
      {/* Your DAW UI */}
    </div>
  );
}

// ============================================================================
// Example 4: With Drag & Drop Support
// ============================================================================

export function ArrangeRoomWithDragDrop() {
  const { loadProject } = useProjectManager();
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.jbp')) {
      try {
        await loadProject(file);
      } catch (error) {
        console.error('Failed to load project:', error);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className={`arrange-room ${isDragging ? 'dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <ProjectMenu />
      
      {isDragging && (
        <div className="drop-overlay">
          Drop .jbp file to load project
        </div>
      )}
      
      {/* Your DAW UI */}
    </div>
  );
}

// ============================================================================
// Example 5: With Keyboard Shortcuts
// ============================================================================

export function ArrangeRoomWithKeyboardShortcuts() {
  const { saveProject, loadProject } = useProjectManager();
  const [projectName] = React.useState('My Project');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject(projectName);
      }

      // Ctrl/Cmd + O to open
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        loadProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveProject, loadProject, projectName]);

  return (
    <div className="arrange-room">
      <ProjectMenu />
      
      <div className="help-text">
        Keyboard shortcuts: Ctrl+S (Save), Ctrl+O (Open)
      </div>
      
      {/* Your DAW UI */}
    </div>
  );
}

// ============================================================================
// Example 6: With Recovery Dialog on Mount
// ============================================================================

export function ArrangeRoomWithRecovery() {
  const { recoverProject } = useProjectManager();
  const [showRecoveryDialog, setShowRecoveryDialog] = React.useState(false);

  React.useEffect(() => {
    // Check for auto-save on mount
    const checkAutoSave = async () => {
      // You could check IndexedDB to see if there's a recent auto-save
      // For now, we'll just show the dialog if there's any auto-save
      const hasAutoSave = true; // Replace with actual check
      if (hasAutoSave) {
        setShowRecoveryDialog(true);
      }
    };

    checkAutoSave();
  }, []);

  const handleRecover = async () => {
    const recovered = await recoverProject();
    if (recovered) {
      setShowRecoveryDialog(false);
    }
  };

  return (
    <div className="arrange-room">
      <ProjectMenu />
      
      {showRecoveryDialog && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Recover Project?</h3>
            <p className="py-4">
              An auto-saved version of your project was found. Would you like to recover it?
            </p>
            <div className="modal-action">
              <button className="btn btn-primary" onClick={handleRecover}>
                Recover
              </button>
              <button className="btn" onClick={() => setShowRecoveryDialog(false)}>
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Your DAW UI */}
    </div>
  );
}

// ============================================================================
// CSS Example for Drag & Drop
// ============================================================================

/*
.arrange-room {
  position: relative;
  width: 100%;
  height: 100%;
}

.arrange-room.dragging {
  border: 2px dashed #4a90e2;
}

.drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(74, 144, 226, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  color: #4a90e2;
  pointer-events: none;
  z-index: 1000;
}
*/
