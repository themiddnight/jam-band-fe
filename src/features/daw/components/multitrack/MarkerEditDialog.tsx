import { useState, useEffect, useRef } from 'react';
import type { TimeMarker } from '../../types/marker';

interface MarkerEditDialogProps {
  marker: TimeMarker | null;
  onSave: (description: string) => void;
  onCancel: () => void;
}

export const MarkerEditDialog = ({ marker, onSave, onCancel }: MarkerEditDialogProps) => {
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (marker) {
      setDescription(marker.description);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [marker]);

  if (!marker) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(description);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-base-100 rounded-lg shadow-xl p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">Edit Marker</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <input
              ref={inputRef}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input input-bordered w-full"
              placeholder="Enter marker description"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
