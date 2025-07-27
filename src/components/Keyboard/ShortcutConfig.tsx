import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { useKeyboardShortcutsStore } from '../../stores/keyboardShortcutsStore';
import { getShortcutsByCategory } from '../../constants/keyboardShortcuts';

interface ShortcutConfigProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutConfig: React.FC<ShortcutConfigProps> = ({ isOpen, onClose }) => {
  const { shortcuts, updateShortcut, resetToDefaults, exportShortcuts, importShortcuts } = useKeyboardShortcutsStore();
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleKeyPress = (e: React.KeyboardEvent, shortcutName: string) => {
    e.preventDefault();
    updateShortcut(shortcutName as keyof typeof shortcuts, e.key.toLowerCase());
    setEditingShortcut(null);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target?.result as string);
            importShortcuts(imported);
            setImportError(null);
          } catch {
            setImportError('Invalid shortcuts file');
          }
        };
        reader.onerror = () => setImportError('Failed to read file');
        reader.readAsText(file);
      } catch {
        setImportError('Failed to import shortcuts file');
      }
    }
  };

  const categories = ['mode', 'chord', 'control', 'octave', 'velocity'] as const;

  return (
    <Modal
      open={isOpen}
      setOpen={(open) => !open && onClose()}
      title="Keyboard Shortcuts Configuration"
      onCancel={onClose}
      showOkButton={false}
      size="2xl"
    >
      <div className="space-y-4">
        {categories.map(category => (
          <div key={category} className="card bg-base-200">
            <div className="card-body p-4">
              <h3 className="card-title text-base capitalize">
                {category} Controls
              </h3>
              <div className="space-y-2">
                {getShortcutsByCategory(shortcuts, category).map(([name, shortcut]) => (
                  <div key={name} className="flex justify-between items-center">
                    <span className="text-sm">{shortcut.description}</span>
                    <button
                      onClick={() => setEditingShortcut(name)}
                      className={`btn btn-sm ${
                        editingShortcut === name
                          ? 'btn-primary'
                          : 'btn-outline'
                      }`}
                      onKeyDown={(e) => editingShortcut === name && handleKeyPress(e, name)}
                      tabIndex={editingShortcut === name ? 0 : -1}
                    >
                      {editingShortcut === name ? 'Press a key...' : shortcut.key.toUpperCase()}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportShortcuts}
            className="btn btn-primary"
          >
            Export
          </button>
          <label className="btn btn-success cursor-pointer">
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={resetToDefaults}
            className="btn btn-outline"
          >
            Reset to Defaults
          </button>
        </div>

        {importError && (
          <div className="alert alert-error mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{importError}</span>
          </div>
        )}

        <div className="alert alert-info mt-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div>
            <div className="font-bold">Tips:</div>
            <ul className="text-sm">
              <li>• Click on any shortcut key to edit it</li>
              <li>• Press any key to set the new shortcut</li>
              <li>• Changes are automatically saved to your browser</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}; 