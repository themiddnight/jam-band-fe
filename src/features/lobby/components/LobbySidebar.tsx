import { InviteUrlInput } from "@/features/rooms";
import { Announcement } from "./Announcement";
import { TechnicalInfoPanel } from "@/features/ui";

export function LobbySidebar() {
  return (
    <div className="flex flex-col gap-4">
      {/* Invite URL Input */}
      <InviteUrlInput />

      {/* Announcement Card */}
      <Announcement
        emoji="🎉"
        title="New Feature Available!"
        highlight="Arrange Room"
        message="is now available! Create multi-track arrangements with asynchronous editing and collaborate on complex compositions."
      />

      {/* Technical Information Panel */}
      <TechnicalInfoPanel />
    </div>
  );
}

