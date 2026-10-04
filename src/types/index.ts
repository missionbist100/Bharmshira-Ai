export interface User {
  id: string;
  email: string;
  role: "user" | "admin";
  created_at?: string;
}

export interface UserSettings {
  default_model: string;
  auto_search: boolean;
  auto_fallback: boolean;
  theme: string;
}

export interface QuotaStatus {
  userId: string;
  date: string;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
  modelBreakdown: Record<string, number>;
}

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
  isConfigured?: boolean;
}

export type CoreMode =
  | "chat"
  | "reasoning"
  | "math"
  | "science"
  | "coding"
  | "writing"
  | "rewrite"
  | "summarize"
  | "translate"
  | "brainstorm";

export interface SourceCitation {
  title: string;
  url: string;
  snippet: string;
  sourceName: string;
}

export interface ProcessedFile {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  extractedText?: string;
  imageBase64?: string;
  imageMimeType?: string;
  isImage: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: SourceCitation[];
  search_queries?: string[];
  attachments?: ProcessedFile[];
  created_at: string;
  modelUsed?: string;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  model: string;
  mode: CoreMode;
  created_at: string;
  updated_at: string;
  last_message?: string;
}

export interface ResearchStep {
  stepNumber: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  details?: string;
  data?: any;
}

export interface AdminMetrics {
  totalUsers: number;
  activeUsersToday: number;
  dailyQueries: number;
  totalErrors: number;
  todayErrors: number;
  totalResearchSessions: number;
  totalUploadedFiles: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
  systemHealth: {
    database: string;
    aiRouter: string;
    webSearch: string;
    uptimeSeconds: number;
  };
}

export interface ApiLog {
  id: string;
  request_id: string;
  user_id: string;
  provider: string;
  model: string;
  duration_ms: number;
  success: number;
  error_message: string | null;
  token_usage: number;
  created_at: string;
}
