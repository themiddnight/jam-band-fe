import { useState, useCallback } from "react";
import { useUserStore } from "@/shared/stores/userStore";
import {
  saveProject,
  updateProject,
  getUserProjects,
  type SaveProjectRequest,
  type SavedProject,
} from "@/shared/api/projects";
import { isProjectLimitReached } from "@/shared/constants/projectLimits";

interface UseProjectSaveOptions {
  roomId?: string;
  roomType: "perform" | "arrange";
  getProjectData: () => Promise<{
    projectData: any;
    audioFiles?: Array<{ fileName: string; data: string }>;
  }>;
  onSaved?: (projectId: string) => void;
}

export function useProjectSave({
  roomId,
  roomType,
  getProjectData,
  onSaved,
}: UseProjectSaveOptions) {
  const { isAuthenticated } = useUserStore();
  const [isSaving, setIsSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitProjects, setLimitProjects] = useState<SavedProject[]>([]);

  const checkAndSave = useCallback(
    async (projectName?: string, existingProjectId?: string) => {
      if (!isAuthenticated) {
        throw new Error("You must be logged in to save projects");
      }

      setIsSaving(true);

      try {
        const { projectData, audioFiles } = await getProjectData();

        if (existingProjectId) {
          // Save over existing project (projectName not needed)
          await updateProject(existingProjectId, projectData, audioFiles);
          setSavedProjectId(existingProjectId);
          onSaved?.(existingProjectId);
        } else {
          // New project - projectName is required
          if (!projectName || !projectName.trim()) {
            throw new Error("Project name is required for new projects");
          }

          // Check project limit first
          const { projects } = await getUserProjects();
          const { userType } = useUserStore.getState();
          if (isProjectLimitReached(projects.length, userType)) {
            setLimitProjects(projects);
            setShowLimitModal(true);
            setIsSaving(false);
            return;
          }

          // Save new project
          const saveRequest: SaveProjectRequest = {
            name: projectName.trim(),
            roomType,
            projectData,
            metadata: {
              roomId,
              createdAt: new Date().toISOString(),
            },
            audioFiles,
          };

          const response = await saveProject(saveRequest);
          setSavedProjectId(response.project.id);
          onSaved?.(response.project.id);
        }
      } catch (error: any) {
        if (error.response?.status === 403 && error.response?.data?.projects) {
          // Project limit reached
          setLimitProjects(error.response.data.projects);
          setShowLimitModal(true);
        } else {
          throw error;
        }
      } finally {
        setIsSaving(false);
      }
    },
    [isAuthenticated, roomId, roomType, getProjectData, onSaved]
  );

  const clearSavedProject = useCallback(() => {
    setSavedProjectId(null);
  }, []);

  const handleLimitModalClose = useCallback(() => {
    setShowLimitModal(false);
    setLimitProjects([]);
  }, []);

  const handleProjectDeleted = useCallback(async () => {
    // Refresh projects list
    try {
      const { projects } = await getUserProjects();
      const { userType } = useUserStore.getState();
      setLimitProjects(projects);
      if (!isProjectLimitReached(projects.length, userType)) {
        setShowLimitModal(false);
      }
    } catch (error) {
      console.error("Failed to refresh projects:", error);
    }
  }, []);

  const checkProjectLimit = useCallback(async (): Promise<{
    isLimitReached: boolean;
    projects: SavedProject[];
  }> => {
    if (!isAuthenticated) {
      return { isLimitReached: false, projects: [] };
    }

    try {
      const { projects } = await getUserProjects();
      const { userType } = useUserStore.getState();
      return {
        isLimitReached: isProjectLimitReached(projects.length, userType),
        projects,
      };
    } catch (error) {
      console.error("Failed to check project limit:", error);
      return { isLimitReached: false, projects: [] };
    }
  }, [isAuthenticated]);

  const setLimitProjectsAndShow = useCallback((projects: SavedProject[]) => {
    setLimitProjects(projects);
    setShowLimitModal(true);
  }, []);

  return {
    isSaving,
    savedProjectId,
    checkAndSave,
    clearSavedProject,
    showLimitModal,
    limitProjects,
    handleLimitModalClose,
    handleProjectDeleted,
    checkProjectLimit,
    setLimitProjectsAndShow,
  };
}

