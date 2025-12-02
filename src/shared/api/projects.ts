import axiosInstance from "../utils/axiosInstance";
import { endpoints } from "../utils/endpoints";

export interface SavedProject {
  id: string;
  name: string;
  roomType: "perform" | "arrange";
  metadata?: {
    roomId?: string;
    createdAt?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  project: SavedProject;
  projectData: any;
  audioFiles?: Array<{
    fileName: string;
    data: string; // base64
  }>;
}

export interface SaveProjectRequest {
  name: string;
  roomType: "perform" | "arrange";
  projectData: any;
  metadata?: {
    roomId?: string;
    [key: string]: any;
  };
  audioFiles?: Array<{
    fileName: string;
    data: string; // base64
  }>;
}

export interface GetUserProjectsResponse {
  projects: SavedProject[];
}

export interface SaveProjectResponse {
  project: SavedProject;
}

export interface ProjectLimitError {
  error: string;
  message: string;
  projects: SavedProject[];
}

/**
 * Get all saved projects for the current user
 */
export async function getUserProjects(): Promise<GetUserProjectsResponse> {
  const response = await axiosInstance.get(endpoints.getUserProjects);
  return response.data;
}

/**
 * Get a specific project by ID
 */
export async function loadProject(projectId: string): Promise<ProjectData> {
  const response = await axiosInstance.get(endpoints.loadProject(projectId));
  return response.data;
}

/**
 * Save a new project
 */
export async function saveProject(
  data: SaveProjectRequest
): Promise<SaveProjectResponse> {
  const response = await axiosInstance.post(endpoints.saveProject, data);
  return response.data;
}

/**
 * Update an existing project (save over)
 */
export async function updateProject(
  projectId: string,
  projectData: any,
  audioFiles?: Array<{ fileName: string; data: string }>
): Promise<SaveProjectResponse> {
  const response = await axiosInstance.put(endpoints.updateProject(projectId), {
    projectData,
    audioFiles,
  });
  return response.data;
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<void> {
  await axiosInstance.delete(endpoints.deleteProject(projectId));
}

