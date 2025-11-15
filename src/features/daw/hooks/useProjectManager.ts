import { useState, useCallback, useEffect } from 'react';
import {
  loadProjectFromZip,
  saveProjectWithPicker,
  loadProjectWithPicker,
  autoSaveToIndexedDB,
  recoverFromAutoSave,
} from '../services/projectFileManager';

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
    recoverProject,
    markAsModified,
  };
}
