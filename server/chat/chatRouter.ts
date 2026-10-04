import { Router, Response } from "express";
import crypto from "crypto";
import { db } from "../database/db";
import { AuthRequest, authenticateToken } from "../auth/auth";
import { QuotaManager } from "../quota/quotaManager";
import { AIRouter, CoreMode } from "../ai/aiRouter";
import { ResearchEngine } from "../research/researchEngine";
import { upload, FileProcessor, ProcessedFile } from "../files/fileProcessor";
import { SearchResult } from "../search/searchTool";
import { getAvailableModels } from "../config";

const router = Router();

// 1. Get available AI models
router.get("/models", (_req, res) => {
  res.json({ models: getAvailableModels() });
});

// 2. List user conversations
router.get("/conversations", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = db.prepare(`
      SELECT c.id, c.title, c.model, c.mode, c.created_at, c.updated_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM conversations c
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(userId);

    res.json({ conversations });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load conversations" });
  }
});

// 3. Create new conversation
router.post("/conversations", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, model = "gemini-model-1", mode = "chat" } = req.body;
    const convId = "conv-" + crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO conversations (id, user_id, title, model, mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(convId, userId, title || "New Chat", model, mode, now, now);

    res.status(201).json({
      conversation: {
        id: convId,
        user_id: userId,
        title: title || "New Chat",
        model,
        mode,
        created_at: now,
        updated_at: now,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create conversation" });
  }
});

// 4. Get conversation with messages
router.get("/conversations/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;

    const conv = db.prepare(`
      SELECT * FROM conversations WHERE id = ? AND user_id = ?
    `).get(convId, userId);

    if (!conv) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
    `).all(convId) as any[];

    // Parse JSON fields
    const parsedMessages = messages.map((m) => ({
      ...m,
      sources: m.sources ? JSON.parse(m.sources) : [],
      search_queries: m.search_queries ? JSON.parse(m.search_queries) : [],
      attachments: m.attachments ? JSON.parse(m.attachments) : [],
    }));

    res.json({
      conversation: conv,
      messages: parsedMessages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load conversation messages" });
  }
});

// 5. Update conversation
router.put("/conversations/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;
    const { title, model, mode } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE conversations 
      SET 
        title = COALESCE(?, title),
        model = COALESCE(?, model),
        mode = COALESCE(?, mode),
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(title, model, mode, now, convId, userId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update conversation" });
  }
});

// 6. Delete conversation
router.delete("/conversations/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;

    db.prepare(`
      DELETE FROM conversations WHERE id = ? AND user_id = ?
    `).run(convId, userId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete conversation" });
  }
});

// 7. Upload files
router.post("/files/upload", authenticateToken, upload.array("files", 5), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const multerFiles = req.files as Express.Multer.File[];

    if (!multerFiles || multerFiles.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const processedFiles: ProcessedFile[] = [];
    for (const f of multerFiles) {
      const processed = await FileProcessor.processUploadedFile(f, userId);
      processedFiles.push(processed);
    }

    res.json({ files: processedFiles });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "File processing failed" });
  }
});

// 8. Primary Chat & Generation Streaming Endpoint
router.post("/chat/stream", authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const {
    conversationId,
    modelId = "gemini-model-1",
    mode = "chat",
    prompt,
    enableWebSearch = false,
    deepResearch = false,
    fileData = [],
  } = req.body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Check and Reserve Quota (100 daily limit cross-model backend enforcement)
  let reserved: { usageId: string; quota: any };
  try {
    reserved = QuotaManager.reserveQuota(userId, modelId);
  } catch (quotaErr: any) {
    sendEvent("error", {
      message: quotaErr.message || "Daily quota limit reached",
      type: "QUOTA_EXCEEDED",
    });
    return res.end();
  }

  // Ensure conversation exists or create one
  let activeConvId = conversationId;
  const now = new Date().toISOString();

  if (!activeConvId) {
    activeConvId = "conv-" + crypto.randomUUID();
    const shortTitle = prompt.trim().slice(0, 36) + (prompt.length > 36 ? "..." : "");
    db.prepare(`
      INSERT INTO conversations (id, user_id, title, model, mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(activeConvId, userId, shortTitle, modelId, mode, now, now);
  } else {
    // Update timestamp
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, activeConvId);
  }

  // Save user message to database
  const userMsgId = "msg-" + crypto.randomUUID();
  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, sources, search_queries, attachments, created_at)
    VALUES (?, ?, 'user', ?, '[]', '[]', ?, ?)
  `).run(userMsgId, activeConvId, prompt, JSON.stringify(fileData), now);

  const startTime = Date.now();
  let fullAssistantResponse = "";
  let actualModelUsed = AIRouter.getModel(modelId).displayName;
  const collectedSources: SearchResult[] = [];
  const searchQueries: string[] = [];

  try {
    // 1. Deep Research Mode
    if (deepResearch) {
      sendEvent("status", { state: "deep_research_started", message: "Initializing 9-step Deep Research workflow..." });

      const researchResult = await ResearchEngine.runResearch(prompt, userId, (progressEvent) => {
        sendEvent("research_progress", progressEvent);
      });

      fullAssistantResponse = researchResult.report;
      collectedSources.push(...researchResult.sources);

      // Stream the authored report chunks for live rendering
      sendEvent("token", { text: fullAssistantResponse });
    }
    // 2. Standard Chat / Core Functions (with or without Web Search)
    else {
      // Check user setting for autoFallback
      const settings = db.prepare("SELECT auto_fallback FROM user_settings WHERE user_id = ?").get(userId) as any;
      const autoFallback = settings ? Boolean(settings.auto_fallback) : true;

      // Load conversation history for contextual coherence (last 8 messages)
      const historyRows = db.prepare(`
        SELECT role, content 
        FROM messages 
        WHERE conversation_id = ? AND id != ?
        ORDER BY created_at ASC
        LIMIT 8
      `).all(activeConvId, userMsgId) as Array<{ role: "user" | "assistant"; content: string }>;

      if (enableWebSearch) {
        sendEvent("status", { state: "searching", message: "Searching the web..." });
      }

      const aiResult = await AIRouter.generate({
        userId,
        modelId,
        mode: mode as CoreMode,
        prompt,
        history: historyRows,
        files: fileData,
        enableWebSearch,
        autoFallback,
        onChunk: (chunk) => {
          fullAssistantResponse += chunk;
          sendEvent("token", { text: chunk });
        },
        onSources: (sources) => {
          sendEvent("status", { state: "reading_sources", message: "Reading sources..." });
          for (const s of sources) {
            if (!collectedSources.some((item) => item.url === s.url)) {
              collectedSources.push(s);
            }
          }
          sendEvent("sources", { sources: collectedSources });
        },
        onSearchQueries: (queries) => {
          searchQueries.push(...queries);
          sendEvent("search_queries", { queries });
        },
      });

      actualModelUsed = aiResult.modelUsed;

      if (!fullAssistantResponse && aiResult.text) {
        fullAssistantResponse = aiResult.text;
        sendEvent("token", { text: fullAssistantResponse });
      }

      if (aiResult.sources && aiResult.sources.length > 0) {
        for (const s of aiResult.sources) {
          if (!collectedSources.some((item) => item.url === s.url)) {
            collectedSources.push(s);
          }
        }
        sendEvent("sources", { sources: collectedSources });
      }

      if (enableWebSearch) {
        sendEvent("status", { state: "analyzing", message: "Analyzing information..." });
        sendEvent("status", { state: "complete", message: "Research complete" });
      }
    }

    // Save assistant message to database
    const assistantMsgId = "msg-" + crypto.randomUUID();
    const finishTime = new Date().toISOString();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, sources, search_queries, attachments, created_at)
      VALUES (?, ?, 'assistant', ?, ?, ?, '[]', ?)
    `).run(
      assistantMsgId,
      activeConvId,
      fullAssistantResponse,
      JSON.stringify(collectedSources),
      JSON.stringify(searchQueries),
      finishTime
    );

    // Finalize usage
    const durationMs = Date.now() - startTime;
    QuotaManager.finalizeUsage(reserved.usageId, true, Math.ceil(fullAssistantResponse.length / 4), durationMs);

    // Send final complete event with updated quota
    const updatedQuota = QuotaManager.getUserQuota(userId);
    sendEvent("done", {
      conversationId: activeConvId,
      userMessageId: userMsgId,
      assistantMessageId: assistantMsgId,
      sources: collectedSources,
      quota: updatedQuota,
      modelUsed: actualModelUsed,
    });
  } catch (err: any) {
    console.error("Chat generation error:", err);
    // Mark usage as failed
    QuotaManager.finalizeUsage(reserved.usageId, false, 0, Date.now() - startTime);

    sendEvent("error", {
      message: err.message || "An error occurred while generating the response.",
      type: "GENERATION_ERROR",
    });
  } finally {
    res.end();
  }
});

export const chatRouter = router;
