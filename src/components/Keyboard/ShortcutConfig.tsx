import { useState } from 'react';
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

  if (!isOpen) return null;

  const categories = ['mode', 'chord', 'control', 'octave', 'velocity'] as const;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Keyboard Shortcuts Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {categories.map(category => (
            <div key={category} className="border rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-3 capitalize">
                {category} Controls
              </h3>
              <div className="space-y-2">
                {getShortcutsByCategory(shortcuts, category).map(([name, shortcut]) => (
                  <div key={name} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{shortcut.description}</span>
                    <button
                      onClick={() => setEditingShortcut(name)}
                      className={`px-3 py-1 rounded border text-sm ${
                        editingShortcut === name
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
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
          ))}
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Reset to Defaults
          </button>
          <button
            onClick={exportShortcuts}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Export
          </button>
          <label className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer">
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>

        {importError && (
          <div className="mt-2 text-red-500 text-sm">{importError}</div>
        )}

        <div className="mt-4 text-xs text-gray-500">
          <p>• Click on any shortcut key to edit it</p>
          <p>• Press any key to set the new shortcut</p>
          <p>• Changes are automatically saved to your browser</p>
        </div>
      </div>
    </div>
  );
}; 