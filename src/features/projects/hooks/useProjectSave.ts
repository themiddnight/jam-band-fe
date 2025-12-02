import { useState, useCallback } from "react";
import { useUserStore } from "@/shared/stores/userStore";
import {
  saveProject,
  updateProject,
  getUserProjects,
  type SaveProjectRequest,
  type SavedProject,
} from "@/shared/api/projects";
import { ProjectLimitModal } from "../components/ProjectLimitModal";

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
    async (projectName: string, existingProjectId?: string) => {
      if (!isAuthenticated) {
        throw new Error("You must be logged in to save projects");
      }

      setIsSaving(true);

      try {
        const { projectData, audioFiles } = await getProjectData();

        if (existingProjectId) {
          // Save over existing project
          await updateProject(existingProjectId, projectData, audioFiles);
          setSavedProjectId(existingProjectId);
          onSaved?.(existingProjectId);
        } else {
          // Check project limit first
          const { projects } = await getUserProjects();
          if (projects.length >= 2) {
            setLimitProjects(projects);
            setShowLimitModal(true);
            setIsSaving(false);
            return;
          }

          // Save new project
          const saveRequest: SaveProjectRequest = {
            name: projectName,
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
      setLimitProjects(projects);
      if (projects.length < 2) {
        setShowLimitModal(false);
      }
    } catch (error) {
      console.error("Failed to refresh projects:", error);
    }
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
  };
}

