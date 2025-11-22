import { useMarkerStore } from '../../stores/markerStore';

export const MarkerEditToggle = () => {
  const isEditMode = useMarkerStore((state) => state.isEditMode);
  const setEditMode = useMarkerStore((state) => state.setEditMode);
  const selectMarker = useMarkerStore((state) => state.selectMarker);

  const handleToggle = () => {
    const newMode = !isEditMode;
    setEditMode(newMode);
    if (!newMode) {
      // Clear selection when exiting edit mode
      selectMarker(null);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`btn btn-xs ${isEditMode ? 'btn-primary' : 'btn-ghost'}`}
      title={isEditMode ? 'Exit marker edit mode' : 'Enter marker edit mode'}
    >
      {isEditMode ? '📍✏️' : '📍'}
    </button>
  );
};
