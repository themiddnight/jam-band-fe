import { useRef, useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useDAWCollaborationContext } from "../../contexts/useDAWCollaborationContext";
import ScaleSelector from "@/features/ui/components/ScaleSelector";
import AnchoredPopup from "@/features/ui/components/shared/AnchoredPopup";

export const ProjectScaleControl = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { projectScale, setProjectScale } = useProjectStore();
  const { handleProjectScaleChange } = useDAWCollaborationContext();

  const handleRootNoteChange = (rootNote: string) => {
    setProjectScale(rootNote, projectScale.scale);
    handleProjectScaleChange(rootNote, projectScale.scale);
  };

  const handleScaleChange = (scale: "major" | "minor") => {
    setProjectScale(projectScale.rootNote, scale);
    handleProjectScaleChange(projectScale.rootNote, scale);
  };

  return (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/60">
        Key:
      </span>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-xs btn-accent gap-1 font-mono"
        title="Project Scale (synced across room)"
      >
        <span className="font-semibold">
          {projectScale.rootNote}{" "}
          {projectScale.scale === "major" ? "Maj" : "Min"}
        </span>
      </button>

      <AnchoredPopup
        open={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={buttonRef}
        placement="bottom"
        offset={8}
        className="p-4"
      >
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Project Scale</div>
          <div className="text-xs text-base-content/70 mb-2">
            Synced across all users in the room
          </div>
          <ScaleSelector
            rootNote={projectScale.rootNote}
            scale={projectScale.scale}
            onRootNoteChange={handleRootNoteChange}
            onScaleChange={handleScaleChange}
            size="sm"
          />
        </div>
      </AnchoredPopup>
    </>
  );
};
