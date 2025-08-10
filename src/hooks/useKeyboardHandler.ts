import { useCallback, useRef, useEffect } from "react";

export interface KeyboardHandlerConfig {
  shortcuts: Record<string, { key: string }>;
  onKeyDown?: (key: string, event: KeyboardEvent) => void;
  onKeyUp?: (key: string, event: KeyboardEvent) => void;
  isEnabled?: boolean;
  preventDefault?: boolean;
}

export const useKeyboardHandler = (config: KeyboardHandlerConfig) => {
  const processingKeys = useRef<Set<string>>(new Set());
  const handlersRef = useRef(config);

  // Update handlers ref when config changes
  handlersRef.current = config;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!handlersRef.current.isEnabled || event.repeat) return;

    const key = event.key.toLowerCase();

    // Check if the target is an input element
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.contentEditable === "true" ||
      target.closest('input, textarea, [contenteditable="true"]') ||
      target.hasAttribute("data-dropdown-search") ||
      target.hasAttribute("data-chat-input") ||
      target.closest("[data-chat-input]")
    ) {
      return;
    }

    // Early exit if key is being processed
    if (processingKeys.current.has(key)) {
      return;
    }

    // Check if key matches any shortcut
    const shortcutEntry = Object.entries(handlersRef.current.shortcuts).find(
      ([, shortcut]) => shortcut.key === key,
    );

    if (shortcutEntry) {
      if (handlersRef.current.preventDefault) {
        event.preventDefault();
      }

      // Mark key as being processed
      processingKeys.current.add(key);

      // Call the handler
      handlersRef.current.onKeyDown?.(key, event);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!handlersRef.current.isEnabled) return;

    const key = event.key.toLowerCase();

    // Remove from processing keys
    processingKeys.current.delete(key);

    // Check if key matches any shortcut
    const shortcutEntry = Object.entries(handlersRef.current.shortcuts).find(
      ([, shortcut]) => shortcut.key === key,
    );

    if (shortcutEntry) {
      // Call the handler
      handlersRef.current.onKeyUp?.(key, event);
    }
  }, []);

  useEffect(() => {
    const currentProcessingKeys = processingKeys.current;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      // Clear processing keys on cleanup using captured reference
      currentProcessingKeys.clear();
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    handleKeyDown,
    handleKeyUp,
  };
};
