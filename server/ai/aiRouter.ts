import crypto from "crypto";
import { CONFIG, getAvailableModels, ModelDefinition } from "../config";
import { GeminiProvider } from "./providers/geminiProvider";
import { OpenAIProvider } from "./providers/openaiProvider";
import { SearchResult } from "../search/searchTool";
import { ProcessedFile } from "../files/fileProcessor";
import { db } from "../database/db";

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

export interface GenerateRequestOptions {
  userId: string;
  modelId: string;
  mode?: CoreMode;
  prompt: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  files?: ProcessedFile[];
  enableWebSearch?: boolean;
  autoFallback?: boolean;
  onChunk?: (text: string) => void;
  onSources?: (sources: SearchResult[]) => void;
  onSearchQueries?: (queries: string[]) => void;
}

export class AIRouter {
  /**
   * Resolve model definition by ID
   */
  static getModel(modelId: string): ModelDefinition {
    const models = getAvailableModels();
    const found = models.find((m) => m.id === modelId || m.actualModelId === modelId);
    if (!found) {
      // Default fallback to first Gemini model
      return models[0];
    }
    return found;
  }

  /**
   * Build specialized system instructions based on Core Function Mode
   */
  static getSystemPrompt(mode: CoreMode = "chat"): string {
    const base = "You are Bharmashira AI, a powerful, accurate, and helpful multi-model AI assistant. Provide direct, objective, and high-quality responses. When citing sources, reference them explicitly.";

    switch (mode) {
      case "reasoning":
        return `${base} You are operating in Structured Reasoning Mode. Break down problems methodically into logical premises, analyze potential counter-arguments, verify deduction steps, and reach rigorous conclusions. Use clear headings for your thinking process.`;

      case "math":
        return `${base} You are operating in Mathematics Mode. Provide rigorous step-by-step mathematical proofs and computations. Clearly show formulas, define variables, verify edge cases (e.g. division by zero, domain limits), and format expressions cleanly using standard notation or LaTeX.`;

      case "science":
        return `${base} You are operating in Science Mode. Answer with empirical rigor across physics, chemistry, biology, earth science, and astronomy. Reference established scientific laws, SI units, reaction mechanisms, and empirical observations.`;

      case "coding":
        return `${base} You are operating in Expert Coding & Engineering Mode. Write production-ready, clean, well-typed, and secure code. Follow idiomatic best practices, provide brief explanations of design patterns, handle edge cases, and enclose code in appropriate markdown syntax with language identifiers.`;

      case "writing":
        return `${base} You are operating in Professional Writing Mode. Craft compelling, well-structured, engaging text suited for the requested medium (articles, reports, executive briefs, correspondence). Focus on cadence, active voice, and vocabulary richness.`;

      case "rewrite":
        return `${base} You are operating in Text Rewrite & Enhancement Mode. Enhance the clarity, conciseness, flow, and elegance of the provided text while strictly preserving its original semantic intent, factual accuracy, and voice. Highlight what improvements were made.`;

      case "summarize":
        return `${base} You are operating in Document Summarization Mode. Distill complex text and uploaded documents into an Executive Overview, Core Key Points, Supporting Data/Metrics, and Actionable Conclusions. Keep information density high and eliminate fluff.`;

      case "translate":
        return `${base} You are operating in Linguistic Translation Mode. Translate between languages with idiomatic precision, maintaining tone, cultural nuance, register (formal/informal), and technical terminology. When relevant, note any linguistic ambiguities.`;

      case "brainstorm":
        return `${base} You are operating in Strategic Ideation & Brainstorming Mode. Generate creative, non-obvious, diversified ideas and strategies. Group them into thematic vectors, assess feasibility and uniqueness, and suggest immediate next steps.`;

      case "chat":
      default:
        return base;
    }
  }

  /**
   * Unified AI generation entry point: ai.generate()
   */
  static async generate(options: GenerateRequestOptions): Promise<{ text: string; sources: SearchResult[]; modelUsed: string }> {
    const requestId = "req-" + crypto.randomUUID();
    const startTime = Date.now();
    let modelDef = this.getModel(options.modelId);
    let primarySuccess = false;
    let finalError: any = null;

    const systemInstruction = this.getSystemPrompt(options.mode);

    // Try primary model
    try {
      let result: { fullText: string; sources: SearchResult[] };

      if (modelDef.provider === "gemini") {
        result = await GeminiProvider.generateStream({
          modelId: modelDef.id,
          actualModelName: modelDef.actualModelId,
          systemInstruction,
          prompt: options.prompt,
          history: options.history,
          files: options.files,
          enableWebSearch: options.enableWebSearch,
          onChunk: options.onChunk,
          onSources: options.onSources,
          onSearchQueries: options.onSearchQueries,
        });
      } else {
        result = await OpenAIProvider.generateStream({
          modelId: modelDef.id,
          actualModelName: modelDef.actualModelId,
          systemInstruction,
          prompt: options.prompt,
          history: options.history,
          files: options.files,
          enableWebSearch: options.enableWebSearch,
          onChunk: options.onChunk,
          onSources: options.onSources,
          onSearchQueries: options.onSearchQueries,
        });
      }

      primarySuccess = true;
      const durationMs = Date.now() - startTime;

      // Log success
      this.logApiCall(requestId, options.userId, modelDef.provider, modelDef.actualModelId, durationMs, true, null, 0);

      return {
        text: result.fullText,
        sources: result.sources,
        modelUsed: modelDef.displayName,
      };
    } catch (err: any) {
      finalError = err;

      // Check fallback eligibility if user has autoFallback enabled
      if (options.autoFallback) {
        console.log(`AIRouter: Model ${modelDef.displayName} temporarily unavailable (${err.message}). Checking failover candidates...`);
        const configuredCandidates = getAvailableModels().filter((m) => {
          // Exclude the failed model
          if (m.id === modelDef.id) return false;
          // Only consider models that have valid keys configured
          if (m.provider === "gemini") return Boolean(CONFIG.GEMINI_API_KEY);
          if (m.provider === "openai") return Boolean(CONFIG.OPENAI_API_KEY);
          return false;
        });

        // Try another model from the same provider first, or cross-provider if configured
        let fallbackModel = configuredCandidates.find((m) => m.provider === modelDef.provider);
        if (!fallbackModel && configuredCandidates.length > 0) {
          fallbackModel = configuredCandidates[0];
        }

        if (fallbackModel) {
          console.log(`AIRouter: Attempting automatic failover to ${fallbackModel.displayName} (${fallbackModel.actualModelId})`);
          if (options.onChunk) {
            options.onChunk(`\n\n*[Failover: Switched to ${fallbackModel.displayName} for reliable response]*\n\n`);
          }

          try {
            let fallbackResult: { fullText: string; sources: SearchResult[] };
            if (fallbackModel.provider === "gemini") {
              fallbackResult = await GeminiProvider.generateStream({
                modelId: fallbackModel.id,
                actualModelName: fallbackModel.actualModelId,
                systemInstruction,
                prompt: options.prompt,
                history: options.history,
                files: options.files,
                enableWebSearch: options.enableWebSearch,
                onChunk: options.onChunk,
                onSources: options.onSources,
                onSearchQueries: options.onSearchQueries,
              });
            } else {
              fallbackResult = await OpenAIProvider.generateStream({
                modelId: fallbackModel.id,
                actualModelName: fallbackModel.actualModelId,
                systemInstruction,
                prompt: options.prompt,
                history: options.history,
                files: options.files,
                enableWebSearch: options.enableWebSearch,
                onChunk: options.onChunk,
                onSources: options.onSources,
                onSearchQueries: options.onSearchQueries,
              });
            }

            const durationMs = Date.now() - startTime;
            this.logApiCall(requestId, options.userId, fallbackModel.provider, fallbackModel.actualModelId, durationMs, true, null, 0);

            return {
              text: fallbackResult.fullText,
              sources: fallbackResult.sources,
              modelUsed: `${fallbackModel.displayName} (Failover)`,
            };
          } catch (fallbackErr: any) {
            console.error("AIRouter fallback also failed:", fallbackErr.message);
          }
        }
      }

      const durationMs = Date.now() - startTime;
      this.logApiCall(requestId, options.userId, modelDef.provider, modelDef.actualModelId, durationMs, false, finalError?.message || "Unknown error", 0);
      throw finalError;
    }
  }

  private static logApiCall(
    requestId: string,
    userId: string,
    provider: string,
    model: string,
    durationMs: number,
    success: boolean,
    errorMessage: string | null,
    tokenUsage: number
  ) {
    try {
      db.prepare(`
        INSERT INTO api_logs (id, request_id, user_id, provider, model, duration_ms, success, error_message, token_usage, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        requestId,
        userId,
        provider,
        model,
        durationMs,
        success ? 1 : 0,
        errorMessage,
        tokenUsage,
        new Date().toISOString()
      );
    } catch (e) {
      console.error("Failed to log API call:", e);
    }
  }
}
