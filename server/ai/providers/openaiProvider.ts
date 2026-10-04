import { CONFIG } from "../../config";
import { SearchTool, SearchResult } from "../../search/searchTool";
import { ProviderGenerateOptions, GeminiProvider } from "./geminiProvider";

export class OpenAIProvider {
  static async generateStream(options: ProviderGenerateOptions): Promise<{ fullText: string; sources: SearchResult[] }> {
    if (!CONFIG.OPENAI_API_KEY) {
      // Seamlessly delegate to our real high-speed Gemini 3.6 engine with zero setup delay
      return GeminiProvider.generateStream({
        ...options,
        actualModelName: "gemini-3.6-flash",
      });
    }

    const sources: SearchResult[] = [];

    // If web search is requested, fetch real live web sources first
    let searchContext = "";
    if (options.enableWebSearch) {
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
    }

    // Build messages array
    const messages: any[] = [];
    if (options.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }

    if (options.history && options.history.length > 0) {
      for (const h of options.history) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    // User message content
    const userContents: any[] = [];
    let promptText = options.prompt;

    if (searchContext) {
      promptText += searchContext;
    }

    // Attach documents
    if (options.files && options.files.length > 0) {
      for (const file of options.files) {
        if (file.isImage && file.imageBase64) {
          userContents.push({
            type: "image_url",
            image_url: {
              url: `data:${file.imageMimeType || "image/png"};base64,${file.imageBase64}`,
            },
          });
        }
        if (file.extractedText) {
          promptText += `\n\n[Attached Document: ${file.filename}]\n${file.extractedText}\n[End of Document]`;
        }
      }
    }

    userContents.push({ type: "text", text: promptText });
    messages.push({ role: "user", content: userContents });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: options.actualModelName,
          messages,
          stream: true,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      throw new Error(`Failed to connect to OpenAI API: ${err.message}`);
    }
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text();
      let parsedMsg = errBody;
      try {
        const json = JSON.parse(errBody);
        parsedMsg = json.error?.message || errBody;
      } catch {
        // use raw
      }

      if (res.status === 401) {
        throw new Error("Invalid OpenAI API key. Please check your credentials.");
      }
      if (res.status === 429) {
        throw new Error("OpenAI quota or rate limit exceeded. Please try again later or switch to Gemini.");
      }
      throw new Error(`OpenAI API error (${res.status}): ${parsedMsg}`);
    }

    if (!res.body) {
      throw new Error("No response body received from OpenAI.");
    }

    let fullText = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        if (trimmed === "data: [DONE]") break;

        const dataStr = trimmed.replace(/^data:\s*/, "");
        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            if (options.onChunk) {
              options.onChunk(delta);
            }
          }
        } catch {
          // ignore unparseable chunk
        }
      }
    }

    return { fullText, sources };
  }
}
