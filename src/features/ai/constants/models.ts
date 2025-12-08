export interface AiProvider {
  value: string;
  label: string;
  description?: string;
  models: AiModel[];
}

export interface AiModel {
  value: string;
  label: string;
  description?: string;
}

export const MODELS_BY_PROVIDER: AiProvider[] = [
  {
    value: "gemini",
    label: "Gemini (Google)",
    description: "Google's AI model",
    models: [
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
  },
  {
    value: "openai",
    label: "ChatGPT (OpenAI)",
    description: "OpenAI's AI model",
    models: [
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
    ],
  },
];

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: string): string {
  const model = MODELS_BY_PROVIDER.find(p => p.value === provider)?.models[0]?.value ?? "";
  return model;
}

/**
 * Get models for a provider
 */
export function getModelsForProvider(provider: string): AiModel[] {
  return MODELS_BY_PROVIDER.find(p => p.value === provider)?.models ?? [];
}
