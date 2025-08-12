// Shared display and utility functions

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
