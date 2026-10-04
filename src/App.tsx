import React, { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import {
  Conversation,
  Message,
  ModelDefinition,
  CoreMode,
  ProcessedFile,
  ResearchStep,
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { ModelSelector } from "./components/ModelSelector";
import { ChatMessage } from "./components/ChatMessage";
import { Composer } from "./components/Composer";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { AuthModal } from "./components/AuthModal";
import { SettingsModal } from "./components/SettingsModal";
import { AdminDashboard } from "./components/AdminDashboard";
import {
  Menu,
  Shield,
  Layers,
  Sparkles,
  BarChart3,
  AlertCircle,
} from "lucide-react";

function MainChatApp() {
  const { user, quota, settings, token, logout, refreshMe } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<ModelDefinition[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("gemini-model-1");
  const [selectedMode, setSelectedMode] = useState<CoreMode>("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchStage, setSearchStage] = useState<string>("");
  const [activeResearchSteps, setActiveResearchSteps] = useState<ResearchStep[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, searchStage]);

  // Load Models
  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.models && Array.isArray(data.models)) {
          setModels(data.models);
          if (settings?.default_model) {
            setSelectedModelId(settings.default_model);
          } else if (data.models.length > 0) {
            setSelectedModelId(data.models[0].id);
          }
        }
      })
      .catch((err) => console.error("Failed to load models:", err));
  }, [settings?.default_model]);

  // Load Conversations
  const loadConversations = async () => {
    if (!token) {
      setConversations([]);
      return;
    }
    try {
      const res = await fetch("/api/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (e) {
      console.error("Failed to fetch conversations:", e);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [token]);

  // Load active conversation messages
  useEffect(() => {
    if (!activeConversationId || !token) {
      setMessages([]);
      return;
    }

    fetch(`/api/conversations/${activeConversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(data.messages);
        }
        if (data.conversation) {
          setSelectedModelId(data.conversation.model || selectedModelId);
          setSelectedMode(data.conversation.mode || "chat");
        }
      })
      .catch((e) => console.error("Failed to load conversation details:", e));
  }, [activeConversationId, token]);

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setSearchStage("");
    setActiveResearchSteps([]);
    setGlobalError(null);
  };

  const handleDeleteConversation = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          handleNewChat();
        }
      }
    } catch (e) {
      console.error("Delete conversation error:", e);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
        );
      }
    } catch (e) {
      console.error("Rename conversation error:", e);
    }
  };

  // Stop generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setSearchStage("");
  };

  // Send message and stream response
  const handleSendMessage = async (
    prompt: string,
    options: {
      mode: CoreMode;
      enableWebSearch: boolean;
      deepResearch: boolean;
      files: ProcessedFile[];
    }
  ) => {
    // If not authenticated, open auth modal
    if (!token) {
      setIsAuthOpen(true);
      return;
    }

    setGlobalError(null);

    // Optimistically add user message
    const tempUserMsgId = "user-" + Date.now();
    const userMessage: Message = {
      id: tempUserMsgId,
      conversation_id: activeConversationId || "temp",
      role: "user",
      content: prompt,
      attachments: options.files,
      created_at: new Date().toISOString(),
    };

    // Prepare assistant placeholder message
    const tempAssistantMsgId = "assistant-" + Date.now();
    const assistantPlaceholder: Message = {
      id: tempAssistantMsgId,
      conversation_id: activeConversationId || "temp",
      role: "assistant",
      content: "",
      sources: [],
      created_at: new Date().toISOString(),
      modelUsed: models.find((m) => m.id === selectedModelId)?.displayName,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsGenerating(true);
    setSearchStage(options.enableWebSearch ? "Searching the web..." : "");
    setActiveResearchSteps([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          modelId: selectedModelId,
          mode: options.mode,
          prompt,
          enableWebSearch: options.enableWebSearch,
          deepResearch: options.deepResearch,
          fileData: options.files,
        }),
        signal: controller.signal,
      });

      if (!res.ok && res.status !== 200) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body stream");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;

          let eventType = "message";
          let eventData = "";

          const blockLines = block.split("\n");
          for (const line of blockLines) {
            if (line.startsWith("event: ")) {
              eventType = line.replace("event: ", "").trim();
            } else if (line.startsWith("data: ")) {
              eventData = line.replace("data: ", "").trim();
            }
          }

          if (!eventData) continue;

          try {
            const parsed = JSON.parse(eventData);

            if (eventType === "status") {
              setSearchStage(parsed.message || "");
            } else if (eventType === "research_progress") {
              if (parsed.step) {
                setActiveResearchSteps((prev) => {
                  const exists = prev.findIndex((s) => s.stepNumber === parsed.step.stepNumber);
                  if (exists >= 0) {
                    const next = [...prev];
                    next[exists] = parsed.step;
                    return next;
                  }
                  return [...prev, parsed.step];
                });
              }
              if (parsed.sources) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempAssistantMsgId ? { ...m, sources: parsed.sources } : m
                  )
                );
              }
            } else if (eventType === "token") {
              accumulatedText += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantMsgId
                    ? { ...m, content: accumulatedText, isStreaming: true }
                    : m
                )
              );
            } else if (eventType === "sources") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantMsgId ? { ...m, sources: parsed.sources } : m
                )
              );
            } else if (eventType === "done") {
              if (parsed.conversationId && !activeConversationId) {
                setActiveConversationId(parsed.conversationId);
                loadConversations();
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantMsgId
                    ? {
                        ...m,
                        id: parsed.assistantMessageId || m.id,
                        content: accumulatedText,
                        sources: parsed.sources || m.sources,
                        modelUsed: parsed.modelUsed || m.modelUsed,
                        isStreaming: false,
                      }
                    : m
                )
              );
              setSearchStage("");
              refreshMe();
            } else if (eventType === "error") {
              setGlobalError(parsed.message || "AI generation failed");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantMsgId
                    ? {
                        ...m,
                        content: `⚠️ **Request Error**: ${parsed.message}\n\n*If your 100-query daily quota has been reached, your quota will reset at 00:00 UTC.*`,
                        isStreaming: false,
                      }
                    : m
                )
              );
              setSearchStage("");
            }
          } catch {
            // ignore malformed sse chunk
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Stream generation error:", err);
        setGlobalError(err.message || "Failed to stream AI response");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantMsgId
              ? {
                  ...m,
                  content: `⚠️ **Connection Error**: ${err.message}`,
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } finally {
      setIsGenerating(false);
      setSearchStage("");
      abortControllerRef.current = null;
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-screen bg-[#0d1117] text-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        quota={quota}
        user={user}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={logout}
        isOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden lg:pl-72">
        {/* Top Navigation Bar */}
        <header className="h-14 border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-10 shrink-0 relative">
          {/* Left: Mobile Sidebar Toggle & Title */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <button
              type="button"
              id="mobile-sidebar-toggle"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 shrink-0"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden md:flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-gray-200 truncate max-w-[140px] sm:max-w-xs">
                {activeConv?.title || "New Conversation"}
              </span>
            </div>
          </div>

          {/* Center: Prominent Model Selector */}
          <div className="flex-1 flex justify-center items-center px-1 sm:px-4 min-w-0">
            <ModelSelector
              models={models}
              selectedModelId={selectedModelId}
              onSelectModel={(id) => setSelectedModelId(id)}
              disabled={isGenerating}
            />
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quota Pill */}
            {quota && (
              <div
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-gray-900 border border-gray-800 text-[10px] sm:text-[11px] font-mono font-medium text-gray-300"
                title={`${quota.remaining} of 100 queries remaining today. Resets at 00:00 UTC.`}
              >
                <Layers className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="hidden sm:inline">{quota.remaining} / 100</span>
                <span className="sm:hidden">{quota.remaining}</span>
              </div>
            )}

            {/* Admin Dashboard quick access */}
            {user?.role === "admin" && (
              <button
                type="button"
                onClick={() => setIsAdminOpen(true)}
                className="hidden md:flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-950/40 text-amber-300 border border-amber-800/60 hover:bg-amber-900/50 transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Admin
              </button>
            )}
          </div>
        </header>

        {/* Global Error Banner if any */}
        {globalError && (
          <div className="px-4 py-2 bg-rose-950/70 border-b border-rose-800 text-xs text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{globalError}</span>
            </div>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="text-rose-400 hover:text-white font-bold ml-2 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Chat Scroll Container */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-between" id="chat-messages-scroll-area">
          {messages.length === 0 ? (
            <WelcomeScreen
              onSelectPrompt={(prompt, mode, enableSearch, deepResearch) => {
                handleSendMessage(prompt, {
                  mode,
                  enableWebSearch: enableSearch ?? false,
                  deepResearch: deepResearch ?? false,
                  files: [],
                });
              }}
            />
          ) : (
            <div className="py-2 space-y-1">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  searchStage={msg.isStreaming ? searchStage : undefined}
                  researchSteps={msg.isStreaming ? activeResearchSteps : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer Bottom Area */}
        <div className="shrink-0 bg-gradient-to-t from-gray-950 via-gray-950/90 to-transparent pt-3">
          <Composer
            onSendMessage={handleSendMessage}
            isGenerating={isGenerating}
            onStopGeneration={handleStopGeneration}
            selectedMode={selectedMode}
            onSelectMode={(mode) => setSelectedMode(mode)}
            disabled={isGenerating}
          />
        </div>
      </main>

      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        models={models}
      />
      <AdminDashboard isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainChatApp />
    </AuthProvider>
  );
}
