import { useTrackStore } from '../../stores/trackStore';
import { loadInstrumentForTrack } from '../../utils/audioEngine';

export const AddTrackButton = () => {
  const addTrack = useTrackStore((state) => state.addTrack);

  const handleAddTrack = async () => {
    const track = addTrack();
    // Load instrument in background
    loadInstrumentForTrack(track).catch((error) => {
      console.error('Failed to load instrument for new track:', error);
    });
  };

  return (
    <button
      type="button"
      onClick={handleAddTrack}
      className="btn btn-sm btn-outline w-full"
    >
      + Add Track
    </button>
  );
};

