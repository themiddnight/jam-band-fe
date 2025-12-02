import { useState, useCallback, useEffect } from 'react';
import {
  loadProjectFromZip,
  saveProjectWithPicker,
  loadProjectWithPicker,
  autoSaveToIndexedDB,
  recoverFromAutoSave,
} from '../services/projectFileManager';
import { uploadProjectToRoom } from '../services/projectUploader';
import { useUserStore } from '@/shared/stores/userStore';

interface UseProjectManagerOptions {
  autoSaveInterval?: number; // in milliseconds, default 60000 (1 minute)
  enableAutoSave?: boolean;
}

export function useProjectManager(options: UseProjectManagerOptions = {}) {
  const { autoSaveInterval = 60000, enableAutoSave = true } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Save project
  const saveProject = useCallback(async (projectName: string) => {
    // Guest users cannot save projects
    const { isAuthenticated, userType } = useUserStore.getState();
    const isGuest = userType === "GUEST" || !isAuthenticated;
    if (isGuest) {
      const errorMessage = "Guest users cannot save projects. Please sign up to access this feature.";
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveProjectWithPicker(projectName);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save project';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Save as (always show picker)
  const saveProjectAs = useCallback(async (projectName: string) => {
    // Guest users cannot save projects
    const { isAuthenticated, userType } = useUserStore.getState();
    const isGuest = userType === "GUEST" || !isAuthenticated;
    if (isGuest) {
      const errorMessage = "Guest users cannot save projects. Please sign up to access this feature.";
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveProjectWithPicker(projectName);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save project';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Load project
  const loadProject = useCallback(async (file?: File) => {
    // Guest users cannot load projects
    const { isAuthenticated, userType } = useUserStore.getState();
    const isGuest = userType === "GUEST" || !isAuthenticated;
    if (isGuest) {
      const errorMessage = "Guest users cannot load projects. Please sign up to access this feature.";
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    setIsLoading(true);
    setError(null);

    try {
      if (file) {
        await loadProjectFromZip(file);
      } else {
        await loadProjectWithPicker();
      }
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load project';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load project and upload to room
  const loadProjectAndUploadToRoom = useCallback(async (
    roomId: string,
    userId: string,
    username: string,
    file?: File,
    onProgress?: (progress: number) => void
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get the project file
      let projectFile: File;
      
      if (file) {
        projectFile = file;
      } else {
        // Show file picker
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.collab';
        
        projectFile = await new Promise<File>((resolve, reject) => {
          input.onchange = (e) => {
            const selectedFile = (e.target as HTMLInputElement).files?.[0];
            if (selectedFile) {
              resolve(selectedFile);
            } else {
              reject(new Error('No file selected'));
            }
          };
          input.click();
        });
      }

      // Step 2: Load project locally first
      await loadProjectFromZip(projectFile);

      // Step 3: Upload to server for distribution
      const result = await uploadProjectToRoom({
        roomId,
        projectFile,
        userId,
        username,
        onProgress,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load and upload project';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-save
  const performAutoSave = useCallback(async (projectName: string) => {
    try {
      await autoSaveToIndexedDB(projectName);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, []);

  // Recover from auto-save
  const recoverProject = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const recovered = await recoverFromAutoSave();
      if (recovered) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        return true;
      }
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to recover project';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark project as modified
  const markAsModified = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  // Auto-save interval
  useEffect(() => {
    if (!enableAutoSave) return;

    const interval = setInterval(() => {
      if (hasUnsavedChanges) {
        performAutoSave('autosave');
      }
    }, autoSaveInterval);

    return () => clearInterval(interval);
  }, [enableAutoSave, autoSaveInterval, hasUnsavedChanges, performAutoSave]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return {
    // State
    isSaving,
    isLoading,
    error,
    lastSaved,
    hasUnsavedChanges,

    // Actions
    saveProject,
    saveProjectAs,
    loadProject,
    loadProjectAndUploadToRoom,
    recoverProject,
    markAsModified,
  };
}
