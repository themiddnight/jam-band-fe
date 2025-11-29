export const analyticsConfig = {
  endpoint: import.meta.env.VITE_ANALYTICS_URL as string | undefined,
  apiKey: import.meta.env.VITE_ANALYTICS_API_KEY as string | undefined,
};

export const isAnalyticsEnabled = Boolean(
  analyticsConfig.endpoint && analyticsConfig.apiKey,
);
