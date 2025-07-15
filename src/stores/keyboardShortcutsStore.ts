import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_SHORTCUTS, type KeyboardShortcuts } from '../constants/keyboardShortcuts';

interface KeyboardShortcutsState {
  shortcuts: KeyboardShortcuts;
  updateShortcut: (shortcutName: keyof KeyboardShortcuts, newKey: string) => void;
  resetToDefaults: () => void;
  exportShortcuts: () => void;
  importShortcuts: (shortcuts: Partial<KeyboardShortcuts>) => void;
}

export const useKeyboardShortcutsStore = create<KeyboardShortcutsState>()(
  persist(
    (set, get) => ({
      shortcuts: DEFAULT_SHORTCUTS,
      
      updateShortcut: (shortcutName: keyof KeyboardShortcuts, newKey: string) => {
        set((state) => ({
          shortcuts: {
            ...state.shortcuts,
            [shortcutName]: {
              ...state.shortcuts[shortcutName],
              key: newKey
            }
          }
        }));
      },
      
      resetToDefaults: () => {
        set({ shortcuts: DEFAULT_SHORTCUTS });
      },
      
      exportShortcuts: () => {
        const { shortcuts } = get();
        const dataStr = JSON.stringify(shortcuts, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'keyboard-shortcuts.json';
        link.click();
        URL.revokeObjectURL(url);
      },
      
      importShortcuts: (importedShortcuts: Partial<KeyboardShortcuts>) => {
        set((state) => ({
          shortcuts: { ...state.shortcuts, ...importedShortcuts }
        }));
      }
    }),
    {
      name: 'keyboard-shortcuts',
      storage: createJSONStorage(() => localStorage),
    }
  )
); 