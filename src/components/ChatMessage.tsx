import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, ResearchStep } from "../types";
import {
  Sparkles,
  User,
  Copy,
  Check,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ChatMessageProps {
  message: Message;
  researchSteps?: ResearchStep[];
  searchStage?: string;
  onCopy?: (text: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  researchSteps,
  searchStage,
  onCopy,
}) => {
  const [copied, setCopied] = useState(false);
  const [showDeepResearchSteps, setShowDeepResearchSteps] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    if (onCopy) onCopy(message.content);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`py-4 sm:py-6 px-4 sm:px-8 transition-colors ${
        isUser ? "bg-transparent" : "bg-gray-950/40 border-y border-gray-800/40"
      }`}
    >
      <div className="max-w-4xl mx-auto flex items-start gap-3 sm:gap-4">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 shadow-sm">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content Column */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-gray-200">
                {isUser ? "You" : "Bharmashira AI"}
              </span>
              {!isUser && message.modelUsed && (
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-blue-950/70 text-blue-300 border border-blue-800/60 font-medium">
                  {message.modelUsed}
                </span>
              )}
            </div>

            {!isUser && message.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="text-gray-400 hover:text-gray-200 p-1 rounded hover:bg-gray-800 transition-colors"
                title="Copy message"
              >
                {copied ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <Check className="w-3.5 h-3.5" /> Copied
                  </span>
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {/* User Attachments Preview */}
          {isUser && message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {message.attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-300"
                >
                  {file.isImage ? (
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span className="truncate max-w-[160px]">{file.filename}</span>
                  <span className="text-[10px] text-gray-400">
                    ({(file.fileSize / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Live Search Stage Progression Display */}
          {!isUser && searchStage && message.isStreaming && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-950/30 border border-blue-800/40 text-xs text-blue-200">
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
              <span>{searchStage}</span>
            </div>
          )}

          {/* Deep Research Steps Timeline Accordion */}
          {!isUser && researchSteps && researchSteps.length > 0 && (
            <div className="rounded-xl border border-indigo-900/60 bg-indigo-950/20 overflow-hidden my-2">
              <button
                type="button"
                onClick={() => setShowDeepResearchSteps(!showDeepResearchSteps)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-xs font-semibold text-indigo-200 hover:bg-indigo-950/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Deep Research Protocol ({researchSteps.filter((s) => s.status === "completed").length} / {researchSteps.length} Steps Completed)</span>
                </div>
                {showDeepResearchSteps ? (
                  <ChevronUp className="w-4 h-4 text-indigo-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-indigo-400" />
                )}
              </button>

              {showDeepResearchSteps && (
                <div className="p-3 border-t border-indigo-900/40 space-y-2 bg-gray-950/40">
                  {researchSteps.map((step) => {
                    let icon = <Clock className="w-3.5 h-3.5 text-gray-400" />;
                    let statusColor = "text-gray-400";

                    if (step.status === "in_progress") {
                      icon = <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
                      statusColor = "text-blue-300 font-medium";
                    } else if (step.status === "completed") {
                      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
                      statusColor = "text-emerald-300";
                    } else if (step.status === "failed") {
                      icon = <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
                      statusColor = "text-rose-300";
                    }

                    return (
                      <div
                        key={step.stepNumber}
                        className="flex items-start gap-2.5 text-xs text-gray-300 p-2 rounded-lg bg-gray-900/60 border border-gray-800/60"
                      >
                        <div className="mt-0.5 shrink-0">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`font-semibold ${statusColor}`}>
                              Step {step.stepNumber}: {step.title}
                            </p>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                              {step.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{step.description}</p>
                          {step.details && (
                            <p className="text-[11px] text-indigo-300/90 mt-1 font-mono">{step.details}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Markdown Content Body */}
          <div className="text-gray-200 text-xs sm:text-sm leading-relaxed prose-bharmashira break-words">
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeText = String(children).replace(/\n$/, "");

                    if (!className && !String(children).includes("\n")) {
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }

                    return (
                      <div className="my-3 rounded-lg overflow-hidden border border-gray-800 bg-gray-950">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/90 border-b border-gray-800 text-xs font-mono text-gray-400">
                          <span>{match ? match[1] : "code"}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(codeText);
                            }}
                            className="flex items-center gap-1 hover:text-gray-200 px-2 py-0.5 rounded hover:bg-gray-800 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        </div>
                        <pre className="p-3 text-xs overflow-x-auto text-gray-200 font-mono">
                          <code>{children}</code>
                        </pre>
                      </div>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}

            {/* Live blinking cursor during streaming */}
            {!isUser && message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-blue-400 ml-1 animate-pulse align-middle" />
            )}
          </div>

          {/* Verified Source Citations Cards */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-800/80">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 mb-2">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Verified Sources ({message.sources.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex flex-col justify-between p-2.5 rounded-lg bg-gray-900/80 hover:bg-gray-850 border border-gray-800 hover:border-blue-500/40 transition-all text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-blue-300 group-hover:text-blue-200 line-clamp-1 flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">[{idx + 1}]</span> {src.title}
                      </p>
                      <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-normal">
                        {src.snippet}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mt-2 pt-1 border-t border-gray-800/60">
                      <span className="truncate">{src.sourceName}</span>
                      <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-blue-400 shrink-0" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
