import { TrackEffects } from './TrackEffects';
import { Collaborators } from './Collaborators';

export const Sidebar = () => {
  return (
    <aside className="w-full lg:w-80 lg:border-l border-t lg:border-t-0 border-base-300 bg-base-100 overflow-y-auto">
      <TrackEffects />
      <div className="border-t border-base-300">
        <Collaborators />
      </div>
    </aside>
  );
};

export default Sidebar;

