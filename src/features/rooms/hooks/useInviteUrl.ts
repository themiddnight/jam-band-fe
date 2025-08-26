import { useState, useCallback } from "react";

export interface UseInviteUrlReturn {
  inviteUrl: string;
  setInviteUrl: (url: string) => void;
  isValidating: boolean;
  error: string;
  handleSubmit: (e: React.FormEvent) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePaste: () => Promise<void>;
}

export const useInviteUrl = (): UseInviteUrlReturn => {
  const [inviteUrl, setInviteUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");

  const isValidInviteUrl = useCallback((url: string): boolean => {
    try {
      const trimmedUrl = url.trim();

      // Check if it's a valid URL
      const urlObj = new URL(trimmedUrl);

      // Check if it matches the invite URL pattern: /invite/<room_id>
      const inviteMatch = urlObj.pathname.match(/^\/invite\/[^/]+$/);

      if (!inviteMatch) {
        return false;
      }

      // If there's a role parameter, validate it
      const roleParam = urlObj.searchParams.get('role');
      if (roleParam && !['band_member', 'audience'].includes(roleParam)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteUrl.trim()) {
      setError("Please enter an invite URL");
      return;
    }

    setIsValidating(true);
    setError("");

    if (!isValidInviteUrl(inviteUrl)) {
      setError("Invalid invite URL format");
      setIsValidating(false);
      return;
    }

    // Navigate directly to the full URL
    window.location.href = inviteUrl;
  }, [inviteUrl, isValidInviteUrl]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInviteUrl(e.target.value);
    if (error) {
      setError("");
    }
  }, [error]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInviteUrl(text);
      if (error) {
        setError("");
      }
    } catch {
      // Clipboard access might be denied, ignore silently
      console.warn("Clipboard access denied or not available");
    }
  }, [error]);

  return {
    inviteUrl,
    setInviteUrl,
    isValidating,
    error,
    handleSubmit,
    handleInputChange,
    handlePaste,
  };
};