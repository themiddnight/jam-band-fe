import { memo } from 'react';
import { TrackEffects } from './TrackEffects';
import { Collaborators } from './Collaborators';
import type { CollaboratorsProps } from './Collaborators';

export interface SidebarProps {
  collaboratorsProps?: CollaboratorsProps;
}

export const Sidebar = memo(({ collaboratorsProps }: SidebarProps) => {
  return (
    <aside className="w-full xl:w-96 lg:border-l border-t lg:border-t-0 border-base-300 bg-base-100 overflow-y-auto">
      <TrackEffects />
      <div className="border-t border-base-300">
        <Collaborators {...collaboratorsProps} />
      </div>
    </aside>
  );
});
Sidebar.displayName = 'Sidebar';

export default Sidebar;

