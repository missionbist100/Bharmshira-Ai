import React, { useState, useRef, useEffect } from "react";
import { CoreMode, ProcessedFile } from "../types";
import {
  Send,
  Square,
  Globe,
  Sparkles,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Brain,
  Calculator,
  FlaskConical,
  Code,
  PenTool,
  RotateCcw,
  BookOpen,
  Languages,
  Lightbulb,
} from "lucide-react";

interface ComposerProps {
  onSendMessage: (
    prompt: string,
    options: {
      mode: CoreMode;
      enableWebSearch: boolean;
      deepResearch: boolean;
      files: ProcessedFile[];
    }
  ) => void;
  isGenerating: boolean;
  onStopGeneration?: () => void;
  selectedMode: CoreMode;
  onSelectMode: (mode: CoreMode) => void;
  disabled?: boolean;
}

const MODES: Array<{ id: CoreMode; label: string; icon: React.ReactNode; desc: string }> = [
  { id: "chat", label: "Chat", icon: <MessageSquare className="w-3 h-3" />, desc: "General multi-turn assistance" },
  { id: "reasoning", label: "Reasoning", icon: <Brain className="w-3 h-3" />, desc: "Deep structured logical steps" },
  { id: "math", label: "Math", icon: <Calculator className="w-3 h-3" />, desc: "Proof derivations & calculation" },
  { id: "science", label: "Science", icon: <FlaskConical className="w-3 h-3" />, desc: "Physics, chemistry & biology" },
  { id: "coding", label: "Coding", icon: <Code className="w-3 h-3" />, desc: "Implementation & debugging" },
  { id: "writing", label: "Writing", icon: <PenTool className="w-3 h-3" />, desc: "Articles, prose & emails" },
  { id: "rewrite", label: "Rewrite", icon: <RotateCcw className="w-3 h-3" />, desc: "Enhance flow & eloquence" },
  { id: "summarize", label: "Summarize", icon: <BookOpen className="w-3 h-3" />, desc: "Executive distillation" },
  { id: "translate", label: "Translate", icon: <Languages className="w-3 h-3" />, desc: "Idiomatic multilingual" },
  { id: "brainstorm", label: "Brainstorm", icon: <Lightbulb className="w-3 h-3" />, desc: "Creative strategies & ideas" },
];

export const Composer: React.FC<ComposerProps> = ({
  onSendMessage,
  isGenerating,
  onStopGeneration,
  selectedMode,
  onSelectMode,
  disabled = false,
}) => {
  const [prompt, setPrompt] = useState("");
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<ProcessedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if ((!prompt.trim() && attachedFiles.length === 0) || isGenerating || disabled) {
      return;
    }

    onSendMessage(prompt.trim(), {
      mode: selectedMode,
      enableWebSearch: deepResearch ? true : enableWebSearch,
      deepResearch,
      files: attachedFiles,
    });

    setPrompt("");
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // Handle file uploads
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const token = localStorage.getItem("bharmashira_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/files/upload", {
        method: "POST",
        headers,
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.files && Array.isArray(data.files)) {
          setAttachedFiles((prev) => [...prev, ...data.files]);
        }
      } else {
        const err = await res.json();
        alert(err.error || "File upload failed. Ensure files are < 10MB (PDF, DOCX, TXT, CSV, Images).");
      }
    } catch {
      alert("Network error during file upload");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      {/* Core Function Modes Pills Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs" id="mode-pills-bar">
        {MODES.map((m) => {
          const isSelected = selectedMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              id={`mode-pill-${m.id}`}
              onClick={() => onSelectMode(m.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
                isSelected
                  ? "bg-blue-600 text-white font-medium shadow-sm shadow-blue-500/20"
                  : "bg-gray-900/90 text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-800/80"
              }`}
              title={m.desc}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Input Box */}
      <div className="rounded-2xl bg-gray-900/90 border border-gray-700/80 shadow-lg focus-within:border-blue-500/80 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all p-3">
        {/* Attached Files Chips */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5 pb-2 border-b border-gray-800">
            {attachedFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-gray-200 text-xs border border-gray-700"
              >
                {f.isImage ? (
                  <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                )}
                <span className="truncate max-w-[140px] font-medium">{f.filename}</span>
                <span className="text-[10px] text-gray-400">({(f.fileSize / 1024).toFixed(0)} KB)</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="p-0.5 text-gray-400 hover:text-rose-400 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id="chat-composer-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            deepResearch
              ? "Ask a complex research question (will execute 9-step deep web discovery)..."
              : enableWebSearch
              ? "Ask a question with live web search grounding..."
              : `Ask Bharmashira AI in ${selectedMode.toUpperCase()} mode...`
          }
          rows={1}
          disabled={disabled}
          className="w-full bg-transparent text-gray-100 text-xs sm:text-sm placeholder-gray-400 outline-none resize-none min-h-[44px] max-h-[220px] leading-relaxed"
        />

        {/* Action Toolbar */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-800/60">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* File Upload Hidden Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".pdf,.docx,.txt,.csv,.json,.md,.png,.jpg,.jpeg,.webp"
              className="hidden"
            />
            <button
              type="button"
              id="attach-file-btn"
              disabled={isUploading || disabled}
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 text-xs flex items-center gap-1.5 transition-colors border border-transparent hover:border-gray-700"
              title="Upload documents (PDF, DOCX, TXT, CSV) or images"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isUploading ? "Uploading..." : "Attach"}</span>
            </button>

            {/* Live Web Search Toggle */}
            <button
              type="button"
              id="web-search-toggle-btn"
              onClick={() => {
                setEnableWebSearch(!enableWebSearch);
                if (deepResearch && !enableWebSearch) setDeepResearch(false);
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all border ${
                enableWebSearch
                  ? "bg-blue-950/60 text-blue-300 border-blue-600/70 shadow-xs"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800 border-transparent hover:border-gray-700"
              }`}
              title="Search the live web for up-to-date facts and citations"
            >
              <Globe className={`w-3.5 h-3.5 ${enableWebSearch ? "text-blue-400" : ""}`} />
              <span className="hidden sm:inline">Web Search</span>
            </button>

            {/* Deep Research Toggle */}
            <button
              type="button"
              id="deep-research-toggle-btn"
              onClick={() => {
                const next = !deepResearch;
                setDeepResearch(next);
                if (next) setEnableWebSearch(true);
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all border ${
                deepResearch
                  ? "bg-indigo-950/70 text-indigo-200 border-indigo-500 shadow-xs"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800 border-transparent hover:border-gray-700"
              }`}
              title="Multi-step 9-stage deep web research and evidence synthesis"
            >
              <Sparkles className={`w-3.5 h-3.5 ${deepResearch ? "text-indigo-400" : ""}`} />
              <span className="hidden sm:inline">Deep Research</span>
            </button>
          </div>

          {/* Send / Stop Button */}
          <div>
            {isGenerating ? (
              <button
                type="button"
                id="stop-generation-btn"
                onClick={onStopGeneration}
                className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm"
                title="Stop generation"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                type="button"
                id="send-message-btn"
                disabled={(!prompt.trim() && attachedFiles.length === 0) || disabled}
                onClick={handleSubmit}
                className={`p-2 rounded-lg transition-all shadow-sm ${
                  (!prompt.trim() && attachedFiles.length === 0) || disabled
                    ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-95"
                }`}
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 px-1">
        <span>Bharmashira AI routes to official OpenAI & Google APIs.</span>
        <span>Enter to send, Shift+Enter for new line.</span>
      </div>
    </div>
  );
};
