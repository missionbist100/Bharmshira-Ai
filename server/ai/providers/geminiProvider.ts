import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { CONFIG } from "../../config";
import { SearchTool, SearchResult } from "../../search/searchTool";
import { ProcessedFile } from "../../files/fileProcessor";

// Server-side lazy initialization with telemetry user-agent
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    if (!CONFIG.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in server environment.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: CONFIG.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

export interface ProviderGenerateOptions {
  modelId: string;
  actualModelName: string;
  systemInstruction?: string;
  prompt: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  files?: ProcessedFile[];
  enableWebSearch?: boolean;
  onChunk?: (text: string) => void;
  onSources?: (sources: SearchResult[]) => void;
  onSearchQueries?: (queries: string[]) => void;
}

export class GeminiProvider {
  static async generateStream(options: ProviderGenerateOptions): Promise<{ fullText: string; sources: SearchResult[] }> {
    const ai = getGeminiClient();
    const sources: SearchResult[] = [];
    const searchQueries: string[] = [];

    // Build content parts
    const parts: any[] = [];

    // Attach files / images if any
    if (options.files && options.files.length > 0) {
      for (const file of options.files) {
        if (file.isImage && file.imageBase64) {
          parts.push({
            inlineData: {
              mimeType: file.imageMimeType || "image/png",
              data: file.imageBase64,
            },
          });
        }
        if (file.extractedText) {
          parts.push({
            text: `[Attached Document: ${file.filename}]\n${file.extractedText}\n[End of Document]\n\n`,
          });
        }
      }
    }

    // If web search is requested, fetch real live web sources using SearchTool
    let searchContext = "";
    if (options.enableWebSearch) {
      try {
        const searchRes = await SearchTool.search(options.prompt, 4);
        if (searchRes.length > 0) {
          sources.push(...searchRes);
          if (options.onSources) {
            options.onSources(sources);
          }
          searchContext = "\n\n--- REAL-TIME SEARCH EVIDENCE ---\n" +
            searchRes.map((s, idx) => `[${idx + 1}] ${s.title} (${s.url})\n"${s.snippet}"`).join("\n\n") +
            "\n--- END OF EVIDENCE ---\nPlease cite these real sources when answering.";
        }
      } catch (e) {
        console.warn("GeminiProvider: SearchTool lookup failed:", e);
      }
    }

    // Build prompt text
    parts.push({ text: searchContext ? `${options.prompt}\n${searchContext}` : options.prompt });

    // History formatting
    const contents: any[] = [];
    if (options.history && options.history.length > 0) {
      for (const h of options.history) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        });
      }
    }
    contents.push({
      role: "user",
      parts,
    });

    const config: any = {};
    if (options.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }

    let fullText = "";

    const executeStream = async (modelToUse: string) => {
      const responseStream = await ai.models.generateContentStream({
        model: modelToUse,
        contents,
        config,
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          if (options.onChunk) {
            options.onChunk(text);
          }
        }

        // Check for grounding metadata from Google Search tool
        const candidate = chunk.candidates?.[0];
        const groundingMetadata = (candidate as any)?.groundingMetadata;
        if (groundingMetadata) {
          // Web search queries
          if (groundingMetadata.webSearchQueries && Array.isArray(groundingMetadata.webSearchQueries)) {
            for (const q of groundingMetadata.webSearchQueries) {
              if (!searchQueries.includes(q)) {
                searchQueries.push(q);
              }
            }
            if (options.onSearchQueries) {
              options.onSearchQueries(searchQueries);
            }
          }

          // Grounding chunks with URLs
          if (groundingMetadata.groundingChunks && Array.isArray(groundingMetadata.groundingChunks)) {
            for (const item of groundingMetadata.groundingChunks) {
              if (item.web?.uri && item.web?.title) {
                const url = item.web.uri;
                if (!sources.some((s) => s.url === url)) {
                  const src: SearchResult = {
                    title: item.web.title,
                    url: item.web.uri,
                    snippet: item.web.title,
                    sourceName: new URL(url).hostname.replace("www.", ""),
                  };
                  sources.push(src);
                }
              }
            }
            if (options.onSources && sources.length > 0) {
              options.onSources(sources);
            }
          }
        }
      }

      return { fullText, sources };
    };

    // Ensure request uses high-availability, active model
    const safeModelName =
      options.actualModelName === "gemini-flash-latest" ||
      options.actualModelName === "gemini-3.7-flash" ||
      options.actualModelName === "gemini-3.8-flash"
        ? "gemini-3.1-flash-lite"
        : options.actualModelName;

    try {
      return await executeStream(safeModelName);
    } catch (err: any) {
      let errMsg = err.message || "";
      // Extract clean error message if nested in JSON
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.error?.message) {
          try {
            const nested = JSON.parse(parsed.error.message);
            errMsg = nested.error?.message || parsed.error.message;
          } catch {
            errMsg = parsed.error.message;
          }
        }
      } catch {
        // keep as is
      }

      // Check for transient 503 or demand spike
      const isTransient = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand");
      if (isTransient) {
        // Seamlessly fallback to high-capacity gemini-3.1-flash-lite if another model was busy
        if (safeModelName !== "gemini-3.1-flash-lite") {
          console.log(`GeminiProvider: Model ${safeModelName} experiencing demand spike. Fulfilling with gemini-3.1-flash-lite...`);
          try {
            return await executeStream("gemini-3.1-flash-lite");
          } catch {
            // pass to router
          }
        } else {
          // If 3.1-flash-lite itself had a blip, retry once in 500ms
          await new Promise((resolve) => setTimeout(resolve, 500));
          try {
            return await executeStream("gemini-3.1-flash-lite");
          } catch {
            // pass to router
          }
        }
      }

      if (errMsg.includes("API key not valid") || errMsg.includes("UNAUTHENTICATED")) {
        throw new Error("Invalid Gemini API key. Please check your credentials in Settings > Secrets.");
      }
      if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) {
        throw new Error("Gemini rate limit or quota exceeded. Please try another model or wait a moment.");
      }
      if (isTransient) {
        throw new Error("Google Gemini is temporarily experiencing high demand (503). Switching to alternative model...");
      }
      throw new Error(`Google Gemini service notice: ${errMsg}`);
    }
  }
}
