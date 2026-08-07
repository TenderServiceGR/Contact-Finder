// Centralised access to configuration. Nothing throws at import time —
// each connector checks `isConfigured` and falls back to demo data so the
// app is fully click-through-able before real keys are wired up.

export const env = {
  gemi: {
    apiKey: process.env.GEMI_API_KEY ?? "",
    baseUrl: process.env.GEMI_BASE_URL ?? "https://opendata-api.businessportal.gr/opendata",
    get isConfigured() {
      return Boolean(this.apiKey);
    },
  },
  procurement: {
    // KHMDIS open data does not currently require a key for read-only
    // GET access; PROCUREMENT_BASE_URL is still overridable per environment.
    baseUrl: process.env.PROCUREMENT_BASE_URL ?? "https://cerpp.eprocurement.gov.gr/khmdhs-opendata",
    get isConfigured() {
      return true;
    },
  },
  google: {
    // Any SerpAPI-compatible search provider works here.
    apiKey: process.env.SERPAPI_KEY ?? "",
    baseUrl: process.env.SERPAPI_BASE_URL ?? "https://serpapi.com/search",
    get isConfigured() {
      return Boolean(this.apiKey);
    },
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    get isConfigured() {
      return Boolean(this.apiKey);
    },
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    get isConfigured() {
      return Boolean(this.url && this.anonKey);
    },
  },
  demoMode: process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production",
};
