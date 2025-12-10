import { useState, useEffect, useRef, useCallback } from "react";
import AnchoredPopup from "../../ui/components/shared/AnchoredPopup";
import { getAiSettings } from "../../../shared/api/aiSettings";
import { generateNotes, cancelGeneration, type AiNote } from "../../../shared/api/aiGeneration";
import { formatAiError } from "../utils/errorFormatter";
import { getModelsForProvider } from "../constants/models";
import { useAiPreferencesStore } from "../stores/aiPreferencesStore";

export interface AiGenerationPopupProps {
  onGenerate: (notes: AiNote[]) => void;
  context: any; // Base context
  extraContext?: any; // Context to include if toggle is checked
  showContextToggle?: boolean;
  contextToggleLabel?: string;
  trigger: React.ReactElement;
  placement?: "top" | "right" | "bottom" | "left";
}

export function AiGenerationPopup({ 
  onGenerate, 
  context, 
  extraContext, 
  showContextToggle = false, 
  contextToggleLabel = "Include Context",
  trigger, 
  placement = "bottom-end" as any 
}: AiGenerationPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [checkingSettings, setCheckingSettings] = useState(false);
  const [includeExtraContext, setIncludeContext] = useState(false);
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  
  const anchorRef = useRef<HTMLDivElement>(null);
  
  // Zustand store for persisting model preferences
  const { getModel: getStoredModel, setModel: setStoredModel } = useAiPreferencesStore();

  const checkAiEnabled = useCallback(async () => {
    setCheckingSettings(true);
    try {
      const { settings } = await getAiSettings();
      setEnabled(settings.enabled && settings.hasApiKey);
      setProvider(settings.provider);
      
      // Load stored model preference or use default for provider
      const storedModel = getStoredModel(settings.provider);
      setModel(storedModel);
      
      if (!settings.enabled) {
        setError("AI features are disabled in Settings");
      } else if (!settings.hasApiKey) {
        setError("API Key is missing in Account Settings");
      } else {
        setError("");
      }
    } catch (err) {
      console.error("Failed to check AI settings:", err);
      setError("Failed to verify AI settings");
      setEnabled(false);
    } finally {
      setCheckingSettings(false);
    }
  }, [getStoredModel]);

  // Check if AI is enabled when opening
  useEffect(() => {
    if (isOpen) {
      checkAiEnabled();
    }
  }, [isOpen, checkAiEnabled]);

  // Update model when provider changes - use stored preference or default
  useEffect(() => {
    if (provider) {
      const storedModel = getStoredModel(provider);
      setModel(storedModel);
    }
  }, [provider, getStoredModel]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");

    try {
      const finalContext = {
        ...context,
        ...(includeExtraContext && extraContext ? extraContext : {})
      };

      const response = await generateNotes({
        prompt,
        context: finalContext,
        model: model || undefined,
      });

      if (response.processedNotes && response.processedNotes.length > 0) {
        onGenerate(response.processedNotes);
        setIsOpen(false); // Close on success
        setPrompt(""); // Clear prompt? Maybe keep it for refinement.
      } else {
        setError("AI returned no notes");
      }
    } catch (err: any) {
      console.error("AI Generation Failed:", err);
      setError(formatAiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelGeneration();
      setError("Generation canceled");
    } catch (err) {
      console.error("Failed to cancel:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        ref={anchorRef} 
        onClick={() => !loading && setIsOpen(!isOpen)}
        className="inline-block"
      >
        {trigger}
      </div>

      <AnchoredPopup
        open={isOpen}
        onClose={() => !loading && setIsOpen(false)}
        anchorRef={anchorRef}
        placement={placement.includes("bottom") ? "bottom" : "top"} // Map to closest supported placement
        className="w-80 p-4 z-50 shadow"
      >
        <div className="flex flex-col gap-3">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <span>✨</span> AI Composer
          </h3>
          
          {checkingSettings ? (
            <div className="flex justify-center py-4">
              <span className="loading loading-spinner loading-sm"></span>
            </div>
          ) : !enabled ? (
            <div className="alert alert-warning text-xs">
              <span>{error || "AI features are not configured."}</span>
              <a href="/account" className="link link-primary">Settings</a>
            </div>
          ) : (
            <>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Describe what you want</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24 text-sm"
                  placeholder="e.g., A funky bassline in C minor, syncopated rhythm..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                  autoFocus
                ></textarea>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Model</span>
                </label>
                <select
                  className="select select-bordered select-xs w-full text-xs"
                  value={model}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    setModel(newModel);
                    // Save to store for persistence
                    if (provider) {
                      setStoredModel(provider, newModel);
                    }
                  }}
                  disabled={loading || !enabled}
                >
                  {getModelsForProvider(provider).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {getModelsForProvider(provider).find(m => m.value === model)?.description && (
                  <label className="label text-xs">
                    <span className="label-text-alt text-base-content/60 text-xs">
                      {getModelsForProvider(provider).find(m => m.value === model)?.description}
                    </span>
                  </label>
                )}
              </div>

              {showContextToggle && (
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={includeExtraContext}
                      onChange={(e) => setIncludeContext(e.target.checked)}
                    />
                    <span className="label-text text-xs">{contextToggleLabel}</span>
                  </label>
                </div>
              )}

              {error && (
                <div className="alert alert-error text-xs py-2">
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2">
                {loading ? (
                  <button 
                    className="btn btn-sm btn-error"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                ) : (
                  <button 
                    className="btn btn-sm btn-ghost"
                    onClick={() => setIsOpen(false)}
                  >
                    Close
                  </button>
                )}
                
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                >
                  {loading ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Thinking...
                    </>
                  ) : (
                    "Generate"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </AnchoredPopup>
    </>
  );
}
