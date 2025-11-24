import { memo } from 'react';
import { TrackEffects } from './TrackEffects';
import { Collaborators } from './Collaborators';
import type { CollaboratorsProps } from './Collaborators';

export interface SidebarProps {
  collaboratorsProps?: CollaboratorsProps;
}

export const Sidebar = memo(({ collaboratorsProps }: SidebarProps) => {
  return (
    <aside className="w-full xl:w-96 lg:border-l border-t lg:border-t-0 border-base-300 bg-base-100 flex flex-col h-full overflow-hidden">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70 p-3">
        Track Effects
      </h3>
      <div className="flex-1 overflow-y-auto min-h-0">
        <TrackEffects />
      </div>
      <div className="border-t border-base-300 flex-shrink-0">
        <Collaborators {...collaboratorsProps} />
      </div>
    </aside>
  );
});
Sidebar.displayName = 'Sidebar';

export default Sidebar;

