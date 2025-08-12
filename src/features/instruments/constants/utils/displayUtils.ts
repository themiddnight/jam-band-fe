// Shared display and utility functions for keyboard shortcuts and controls

// Helper function to convert keys to readable display names
export const getKeyDisplayName = (key: string): string => {
  switch (key) {
    case " ":
      return "SPACE";
    case "\\":
      return "\\";
    case "shift":
      return "SHIFT";
    case "ctrl":
      return "CTRL";
    case "alt":
      return "ALT";
    case "meta":
      return "META";
    case "enter":
      return "ENTER";
    case "tab":
      return "TAB";
    case "escape":
      return "ESC";
    case "backspace":
      return "BACKSPACE";
    case "delete":
      return "DEL";
    case "arrowup":
      return "↑";
    case "arrowdown":
      return "↓";
    case "arrowleft":
      return "←";
    case "arrowright":
      return "→";
    default:
      return key.toUpperCase();
  }
};

// Generic helper function to get shortcuts by category
export const getShortcutsByCategory = <
  T extends Record<string, { category: string }>,
>(
  shortcuts: T,
  category: string,
) => {
  return Object.entries(shortcuts).filter(
    ([, shortcut]) => shortcut.category === category,
  );
};

// Generic helper function to get modifier keys
export const getModifierKeys = <T extends Record<string, { key: string }>>(
  shortcuts: T,
  modifierKeys: (keyof T)[],
): string[] => {
  return modifierKeys.map((key) => shortcuts[key]?.key).filter(Boolean);
};

// Helper function to validate key combinations
export const isValidKeyCombination = (key: string): boolean => {
  const validKeys = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "shift",
    "ctrl",
    "alt",
    "meta",
    "enter",
    "tab",
    "escape",
    "backspace",
    "delete",
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    " ",
    "\\",
    "[",
    "]",
    ";",
    "'",
  ];
  return validKeys.includes(key.toLowerCase());
};
