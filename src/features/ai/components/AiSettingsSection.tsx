import { useState, useEffect, useCallback } from "react";
import { getAiSettings, updateAiSettings, type AiSettings } from "../../../shared/api/aiSettings";

const modelsByProvider: Record<string, { value: string; label: string; description?: string }[]> = {
  gemini: [
    {
      value: "gemini-2.5-flash-lite",
      label: "Gemini 2.5 Flash-Lite",
      description: "High-throughput, low latency, cheapest (~15 RPM)"
    },
    {
      value: "gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      description: "Good for rapid prototyping (~10 RPM)"
    },
    {
      value: "gemini-2.5-pro",
      label: "Gemini 2.5 Pro",
      description: "Complex reasoning, very limited quota (~5 RPM)"
    },
  ],
  openai: [
    {
      value: "gpt-4o-mini",
      label: "GPT-4o Mini",
      description: "Cost-effective model"
    },
    {
      value: "gpt-4o",
      label: "GPT-4o",
      description: "Advanced reasoning and multimodal capabilities"
    },
    {
      value: "gpt-5.1",
      label: "GPT-5.1",
      description: "Next generation model (Experimental)"
    },
  ]
};

interface AiSettingsSectionProps {
  inline?: boolean;
}

export function AiSettingsSection({ inline = false }: AiSettingsSectionProps) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { settings } = await getAiSettings();
      setSettings(settings);
      setProvider(settings.provider);
      setEnabled(settings.enabled);
      // Load model from settings json, fallback to default for provider
      const loadedModel = settings.settings?.model;
      if (loadedModel) {
        setModel(loadedModel);
      } else {
        setModel(modelsByProvider[settings.provider]?.[0]?.value || "");
      }

      // apiKey is not returned, clear field
      setApiKey("");
    } catch (err) {
      console.error("Failed to load AI settings:", err);
      setError("Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Update default model when provider changes if current model is not valid for new provider
  useEffect(() => {
    const validModels = modelsByProvider[provider]?.map(m => m.value) || [];
    if (model && !validModels.includes(model)) {
      setModel(validModels[0] || "");
    } else if (!model && validModels.length > 0) {
      setModel(validModels[0]);
    }
  }, [provider, model]); // Added model to dependency array to fix lint warning, logic handles loop prevention

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { settings: newSettings } = await updateAiSettings({
        provider,
        enabled,
        apiKey: apiKey || undefined, // Send undefined if empty to not update
        settings: { model }
      });

      setSettings(newSettings);
      setApiKey(""); // Clear input after save
      setSuccess("Settings saved successfully");

      // Clear success message after 3s
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Failed to save AI settings:", err);
      setError(err.response?.data?.error || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex justify-center p-4">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );
  }

  const content = (
    <>
      {!inline && (
        <>
          <h3 className="card-title text-lg">AI Assistant Settings</h3>
          <p className="text-sm text-base-content/70 mb-4">
            Configure AI provider to enable note generation features in Arrange and Perform rooms.
            Your API key is encrypted and stored securely.
          </p>
        </>
      )}

      <div className={`form-control ${inline ? 'lg:col-span-2' : ''}`}>
        <label className="label cursor-pointer justify-start gap-4">
          <span className="label-text font-medium">Enable AI Features</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </label>
      </div>

      <div className={`${inline ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}`}>
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Provider</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="openai">ChatGPT (OpenAI)</option>
            <option value="gemini">Gemini (Google)</option>
          </select>
        </div>

        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Model</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {modelsByProvider[provider]?.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {/* Show description for selected model */}
          <label className="label">
            <span className="label-text-alt text-base-content/60">
              {modelsByProvider[provider]?.find(m => m.value === model)?.description}
            </span>
          </label>
        </div>

        <div className={`form-control w-full ${inline ? 'col-span-1 md:col-span-2' : ''}`}>
          <label className="label">
            <span className="label-text">API Key</span>
            {settings?.hasApiKey && (
              <span className="label-text-alt text-success">
                ✓ Saved
              </span>
            )}
          </label>
          <input
            type="password"
            className="input input-bordered w-full"
            placeholder={settings?.hasApiKey ? "••••••••••••••••" : "Enter API Key"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <label className="label">
            <span className="label-text-alt text-base-content/60">
              {provider === 'openai'
                ? 'Get your key from platform.openai.com'
                : 'Get your key from aistudio.google.com'}
            </span>
          </label>
        </div>

        {error && (
          <div className={`alert alert-error text-sm py-2 ${inline ? 'lg:col-span-2' : ''}`}>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className={`alert alert-success text-sm py-2 ${inline ? 'lg:col-span-2' : ''}`}>
            <span>{success}</span>
          </div>
        )}
      </div>

      <div className={`${inline ? 'lg:col-span-2 flex justify-end' : 'card-actions justify-end'} mt-2`}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <span className="loading loading-spinner loading-xs"></span> : "Save Settings"}
        </button>
      </div>
    </>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-4">
        {content}
      </div>
    </div>
  );
}
