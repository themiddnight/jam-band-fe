import { convertSessionToProject } from "@/features/rooms/utils/sessionToCollabConverter";
import type { SessionRecordingSnapshot } from "@/features/rooms";
import { serializeProject, extractAudioFiles } from "@/features/daw/services/projectSerializer";
import { useRegionStore } from "@/features/daw/stores/regionStore";

/**
 * Convert session recording snapshot to project data format for saving
 */
export async function convertSessionToProjectData(
  snapshot: SessionRecordingSnapshot
): Promise<{
  projectData: any;
  audioFiles: Array<{ fileName: string; data: string }>;
}> {
  const { project, audioFiles } = convertSessionToProject(snapshot);

  // Convert audio files to base64 (chunked for large files)
  const audioFilesBase64 = await Promise.all(
    audioFiles.map(async (file) => {
      const arrayBuffer = await file.blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);
      return {
        fileName: file.fileName,
        data: base64,
      };
    })
  );

  return {
    projectData: project,
    audioFiles: audioFilesBase64,
  };
}

/**
 * Get arrange room project data for saving
 */
export async function getArrangeRoomProjectData(projectName: string): Promise<{
  projectData: any;
  audioFiles: Array<{ fileName: string; data: string }>;
}> {
  // Serialize project
  const projectData = serializeProject(projectName);

  // Extract audio files
  const audioFiles = await extractAudioFiles(useRegionStore.getState().regions);

  // Convert audio files to base64 (chunked for large files)
  const audioFilesBase64 = await Promise.all(
    audioFiles.map(async (file) => {
      const arrayBuffer = await file.blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);
      return {
        fileName: file.fileName,
        data: base64,
      };
    })
  );

  return {
    projectData,
    audioFiles: audioFilesBase64,
  };
}

