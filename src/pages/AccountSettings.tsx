import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useUserStore } from "../shared/stores/userStore";
import { useAuth } from "../shared/hooks/useAuth";
import {
  getUserProjects,
  deleteProject,
  loadProject,
  type SavedProject,
} from "../shared/api/projects";
import { OpenProjectModal } from "../features/projects/components/OpenProjectModal";
import { createRoom } from "../features/rooms/services/api";
import { useUserStore as useUserStoreForRoom } from "../shared/stores/userStore";
import { uploadProjectToRoom } from "../features/daw/services/projectUploader";
import { updateUsername } from "../shared/api/auth";
import JSZip from "jszip";

export default function AccountSettings() {
  const navigate = useNavigate();
  const { authUser, isAuthenticated, logout, updateAuthUser } = useUserStore();
  const { resendVerification, loading, error } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SavedProject | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login?redirect=/account");
      return;
    }

    if (authUser) {
      setUsername(authUser.username || "");
      setEmail(authUser.email || "");
    }
  }, [isAuthenticated, authUser, navigate]);

  // Load projects
  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const { projects } = await getUserProjects();
      setProjects(projects);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleOpenProject = async (roomName: string, description?: string, isPrivate?: boolean, isHidden?: boolean) => {
    if (!selectedProject) return;

    setIsOpening(true);
    try {
      // Load project data
      const { projectData, audioFiles } = await loadProject(selectedProject.id);

      // Create arrange room
      const { username, userId } = useUserStoreForRoom.getState();
      if (!username || !userId) {
        throw new Error("User information not available");
      }

      const { room } = await createRoom(
        roomName,
        username,
        userId,
        isPrivate ?? false,
        isHidden ?? false,
        description,
        "arrange"
      );

      if (!room?.id) {
        throw new Error("Failed to create room: room ID is missing");
      }

      // Create .collab file from project data and upload to room
      const zip = new JSZip();
      
      // Add project.json
      zip.file("project.json", JSON.stringify(projectData, null, 2));
      
      // Add audio files
      if (audioFiles && audioFiles.length > 0) {
        const audioFolder = zip.folder("audio");
        if (audioFolder) {
          for (const audioFile of audioFiles) {
            // Convert base64 to blob
            const binaryString = atob(audioFile.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "audio/webm" });
            audioFolder.file(audioFile.fileName, blob);
          }
        }
      }
      
      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      
      // Create File object
      const projectFile = new File([zipBlob], `${selectedProject.name}.collab`, {
        type: "application/zip",
      });
      
      // Set loading state before navigating (will be used by ArrangeRoom)
      // Import useProjectStore dynamically to avoid circular dependency
      const { useProjectStore } = await import("@/features/daw/stores/projectStore");
      useProjectStore.getState().setIsLoadingProject(true);
      
      // Upload project to room
      await uploadProjectToRoom({
        roomId: room.id,
        projectFile,
        userId,
        username,
      });
      
      // Navigate to the room
      // The loading state will be cleared by ArrangeRoom when project is loaded
      navigate(`/arrange/${room.id}`);
    } catch (error) {
      console.error("Failed to open project:", error);
      throw error;
    } finally {
      setIsOpening(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    setDeletingId(projectId);
    try {
      await deleteProject(projectId);
      await loadProjects();
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("Failed to delete project. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleResendVerification = async () => {
    await resendVerification();
  };

  const validateUsername = (value: string): string => {
    if (!value || value.trim().length === 0) {
      return "Username cannot be empty";
    }
    const trimmed = value.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      return "Username must be between 3 and 30 characters";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return "Username can only contain letters, numbers, underscores, and hyphens";
    }
    return "";
  };

  const handleStartEditUsername = () => {
    setNewUsername(username);
    setUsernameError("");
    setIsEditingUsername(true);
  };

  const handleCancelEditUsername = () => {
    setNewUsername("");
    setUsernameError("");
    setIsEditingUsername(false);
  };

  const handleSaveUsername = async () => {
    const error = validateUsername(newUsername);
    if (error) {
      setUsernameError(error);
      return;
    }

    if (newUsername.trim() === username) {
      setIsEditingUsername(false);
      return;
    }

    setIsUpdatingUsername(true);
    setUsernameError("");
    try {
      const response = await updateUsername(newUsername.trim());
      setUsername(response.user.username || "");
      if (authUser) {
        updateAuthUser(response.user);
      }
      setIsEditingUsername(false);
    } catch (err: any) {
      setUsernameError(err.response?.data?.error || err.message || "Failed to update username");
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (!isAuthenticated || !authUser) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-base-200 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Account Settings</h2>

            {/* Profile Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Profile</h3>
                <div className="space-y-2">
                  <div>
                    <label className="label">
                      <span className="label-text">Email</span>
                    </label>
                    <input
                      type="email"
                      className="input input-bordered w-full"
                      value={email}
                      disabled
                    />
                    {!authUser.emailVerified && (
                      <div className="alert alert-warning mt-2">
                        <span>Email not verified</span>
                        <button
                          onClick={handleResendVerification}
                          className="btn btn-sm btn-outline"
                          disabled={loading}
                        >
                          Resend Verification
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">Username</span>
                    </label>
                    {isEditingUsername ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          className={`input input-bordered w-full ${usernameError ? "input-error" : ""}`}
                          value={newUsername}
                          onChange={(e) => {
                            setNewUsername(e.target.value);
                            setUsernameError("");
                          }}
                          disabled={isUpdatingUsername}
                          placeholder="Enter new username"
                        />
                        {usernameError && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              {usernameError}
                            </span>
                          </label>
                        )}
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={handleSaveUsername}
                            disabled={isUpdatingUsername}
                          >
                            {isUpdatingUsername ? (
                              <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                              "Save"
                            )}
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={handleCancelEditUsername}
                            disabled={isUpdatingUsername}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          className="input input-bordered w-full"
                          value={username}
                          disabled
                        />
                        <div className="flex items-center justify-between mt-2">
                          <label className="label">
                            <span className="label-text-alt">
                              Your username for this account
                            </span>
                          </label>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={handleStartEditUsername}
                          >
                            Change Username
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="divider"></div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Password</h3>
                <Link to="/forgot-password" className="btn btn-outline">
                  Change Password
                </Link>
              </div>

              {/* Saved Projects Section */}
              <div className="divider"></div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Saved Projects</h3>
                {loadingProjects ? (
                  <div className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm"></span>
                    <span>Loading projects...</span>
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-base-content/70">
                    You don't have any saved projects yet. Save a project from a perform or arrange room to get started.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{project.name}</div>
                          <div className="text-sm text-base-content/60">
                            {project.roomType === "perform" ? "Perform Room" : "Arrange Room"} •{" "}
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setSelectedProject(project);
                              setShowOpenModal(true);
                            }}
                          >
                            Open
                          </button>
                          <button
                            className="btn btn-sm btn-error"
                            onClick={() => handleDeleteProject(project.id)}
                            disabled={deletingId === project.id}
                          >
                            {deletingId === project.id ? (
                              <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                              "Delete"
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* App Settings Section */}
              <div className="divider"></div>
              <div>
                <h3 className="text-lg font-semibold mb-2">App Settings</h3>
                <p className="text-sm text-base-content/70">
                  App settings and preferences will be available here in the
                  future.
                </p>
              </div>

              {/* Logout */}
              <div className="divider"></div>
              <div>
                <button
                  onClick={handleLogout}
                  className="btn btn-error btn-outline"
                >
                  Logout
                </button>
              </div>

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="card-actions justify-end mt-4">
              <Link to="/" className="btn btn-ghost">
                Back to Lobby
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Open Project Modal */}
      {selectedProject && (
        <OpenProjectModal
          open={showOpenModal}
          onClose={() => {
            setShowOpenModal(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          onOpen={handleOpenProject}
          isOpening={isOpening}
        />
      )}

      {/* Loading Overlay */}
      {isOpening && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="card bg-base-200 shadow-xl p-8">
            <div className="card-body items-center text-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <h3 className="card-title mt-4">Opening Project</h3>
              <p className="text-base-content/70">
                Loading project data and creating room...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

