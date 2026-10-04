import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  PORT: 3000,
  HOST: "0.0.0.0",

  // API Keys
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  SEARCH_API_KEY: process.env.SEARCH_API_KEY || "",

  // Model IDs (configurable via env vars)
  OPENAI_MODEL_1: process.env.OPENAI_MODEL_1 || "gpt-4o-mini",
  OPENAI_MODEL_2: process.env.OPENAI_MODEL_2 || "gpt-4o",
  GEMINI_MODEL_1: process.env.GEMINI_MODEL_1 || "gemini-3.1-flash-lite",
  GEMINI_MODEL_2: process.env.GEMINI_MODEL_2 || "gemini-3.5-flash-lite",
  GEMINI_MODEL_3: process.env.GEMINI_MODEL_3 || "gemini-3.6-flash",
  GEMINI_MODEL_4: process.env.GEMINI_MODEL_4 || "gemini-3.1-flash-lite",

  // Quotas & Rate Limits
  DAILY_QUERY_LIMIT: 100, // 100 queries per day total across ALL models
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB

  // Security
  AUTH_SECRET: process.env.AUTH_SECRET || "bharmashira-super-secret-jwt-key-change-in-production",
  ADMIN_KEY: process.env.ADMIN_KEY || "admin-access-token-bharmashira-2026",
};

export interface ModelDefinition {
  id: string;
  actualModelId: string;
  provider: "openai" | "gemini";
  name: string;
  displayName: string;
  description: string;
  speed: "Ultra Fast" | "Fast" | "Moderate";
  intelligence: "High" | "Very High" | "Maximum";
  supportsVision: boolean;
  supportsSearch: boolean;
  contextWindow: string;
  isConfigured: boolean;
}

export function getAvailableModels(): ModelDefinition[] {
  return [
    {
      id: "gemini-model-1",
      actualModelId: CONFIG.GEMINI_MODEL_1,
      provider: "gemini",
      name: "Gemini Flash Lite",
      displayName: `Google ${CONFIG.GEMINI_MODEL_1}`,
      description: "Ultra-fast, high-availability model for rapid reasoning, conversation, and code.",
      speed: "Ultra Fast",
      intelligence: "High",
      supportsVision: true,
      supportsSearch: true,
      contextWindow: "1M tokens",
      isConfigured: true,
    },
    {
      id: "gemini-model-2",
      actualModelId: CONFIG.GEMINI_MODEL_2,
      provider: "gemini",
      name: "Gemini Flash 3.5",
      displayName: `Google ${CONFIG.GEMINI_MODEL_2}`,
      description: "Advanced multimodal intelligence for complex math, science, and structured analysis.",
      speed: "Ultra Fast",
      intelligence: "Very High",
      supportsVision: true,
      supportsSearch: true,
      contextWindow: "1M tokens",
      isConfigured: true,
    },
    {
      id: "gemini-model-3",
      actualModelId: CONFIG.GEMINI_MODEL_3,
      provider: "gemini",
      name: "Gemini Flash 3.6",
      displayName: `Google ${CONFIG.GEMINI_MODEL_3}`,
      description: "Next-gen deep reasoning model for intricate programming, logic, and multi-step tasks.",
      speed: "Fast",
      intelligence: "Maximum",
      supportsVision: true,
      supportsSearch: true,
      contextWindow: "1M tokens",
      isConfigured: true,
    },
    {
      id: "gemini-model-4",
      actualModelId: CONFIG.GEMINI_MODEL_4,
      provider: "gemini",
      name: "Gemini Fast Response",
      displayName: `Google ${CONFIG.GEMINI_MODEL_4}`,
      description: "Dedicated low-latency fallback engine for uninterrupted everyday queries.",
      speed: "Ultra Fast",
      intelligence: "High",
      supportsVision: true,
      supportsSearch: true,
      contextWindow: "1M tokens",
      isConfigured: true,
    },
  ];
}
