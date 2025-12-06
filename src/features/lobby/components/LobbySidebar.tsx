import { InviteUrlInput } from "@/features/rooms";
import { Announcement } from "./Announcement";
import { TechnicalInfoPanel } from "@/features/ui";

export function LobbySidebar() {
  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Invite URL Input */}
      <div className="flex-none">
        <InviteUrlInput />
      </div>

      {/* Announcement & Technical Info - Scrollable on XL */}
      <div className="flex flex-col gap-4 flex-1 min-h-0 xl:overflow-y-auto">
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
    </div>
  );
}

