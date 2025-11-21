const API_URL = `${import.meta.env.VITE_API_URL}/api`;

export interface UploadProjectOptions {
  roomId: string;
  projectFile: File;
  userId: string;
  username: string;
  onProgress?: (progress: number) => void;
}

export interface UploadProjectResult {
  success: boolean;
  message: string;
  projectName?: string;
  audioFilesCount?: number;
}

/**
 * Upload a project file to the server for distribution to all room members
 */
export async function uploadProjectToRoom(
  options: UploadProjectOptions
): Promise<UploadProjectResult> {
  const { roomId, projectFile, userId, username, onProgress } = options;

  try {
    const formData = new FormData();
    formData.append('project', projectFile);
    formData.append('userId', userId);
    formData.append('username', username);

    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });
    }

    const response = await new Promise<Response>((resolve, reject) => {
      xhr.open('POST', `${API_URL}/rooms/${roomId}/projects`);
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText,
          }));
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));

      xhr.send(formData);
    });

    const result = await response.json();

    if (result.success) {
      console.log('Project uploaded successfully', {
        roomId,
        projectName: result.projectName,
        audioFilesCount: result.audioFilesCount,
      });
    }

    return result;
  } catch (error) {
    console.error('Failed to upload project:', error);

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to upload project',
    };
  }
}

/**
 * Get the current project for a room
 */
export async function getRoomProject(roomId: string): Promise<any | null> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/projects`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No project in room
      }
      throw new Error(`Failed to get project: ${response.statusText}`);
    }

    const result = await response.json();
    return result.success ? result.project : null;
  } catch (error) {
    console.error('Failed to get room project:', error);
    return null;
  }
}
