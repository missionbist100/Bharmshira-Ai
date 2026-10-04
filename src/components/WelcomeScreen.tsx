import React from "react";
import { Sparkles, Brain, Code, Globe, FlaskConical, Shield, Layers } from "lucide-react";
import { CoreMode } from "../types";

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string, mode: CoreMode, enableSearch?: boolean, deepResearch?: boolean) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectPrompt }) => {
  const starters = [
    {
      title: "Deep Structured Reasoning",
      prompt: "Deconstruct the computational complexity of the P vs NP problem, explaining why standard polynomial-time reductions fail.",
      mode: "reasoning" as CoreMode,
      icon: <Brain className="w-4 h-4 text-purple-400" />,
      tag: "Logic & Proof",
    },
    {
      title: "Production Architecture & Code",
      prompt: "Architect a production-grade distributed event bus in TypeScript using RabbitMQ and Redis idempotency locks with full error recovery.",
      mode: "coding" as CoreMode,
      icon: <Code className="w-4 h-4 text-emerald-400" />,
      tag: "Software Engineering",
    },
    {
      title: "Biochemical Science Analysis",
      prompt: "Explain the molecular mechanics and off-target fidelity improvements of prime editing compared to conventional CRISPR-Cas9 double-strand breaks.",
      mode: "science" as CoreMode,
      icon: <FlaskConical className="w-4 h-4 text-amber-400" />,
      tag: "Biomedical",
    },
    {
      title: "Live Deep Web Research",
      prompt: "Investigate the current commercial production milestones and technological roadblocks for solid-state lithium metal EV battery cells.",
      mode: "chat" as CoreMode,
      enableSearch: true,
      deepResearch: true,
      icon: <Globe className="w-4 h-4 text-blue-400" />,
      tag: "9-Step Research",
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto my-auto animate-in fade-in duration-300">
      {/* Brand Icon */}
      <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-4 ring-1 ring-white/20">
        <Sparkles className="w-7 h-7" />
      </div>

      {/* Main Title */}
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
        Bharmashira AI
      </h2>

      {/* Subtitle */}
      <p className="text-xs sm:text-sm text-gray-400 max-w-lg mb-6 leading-relaxed">
        Production-ready multi-model AI platform with real-time web discovery, 9-step deep research, document extraction, and verified citations.
      </p>

      {/* Highlights Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8 text-[11px] text-gray-400">
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-900 border border-gray-800">
          <Layers className="w-3 h-3 text-blue-400" /> Google Gemini & OpenAI
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-900 border border-gray-800">
          <Shield className="w-3 h-3 text-emerald-400" /> 100 Daily Cross-Model Quota
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-900 border border-gray-800">
          <Globe className="w-3 h-3 text-indigo-400" /> Live Web Grounding
        </span>
      </div>

      {/* Starters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {starters.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(item.prompt, item.mode, item.enableSearch, item.deepResearch)}
            className="p-3.5 rounded-xl bg-gray-900/80 hover:bg-gray-850 border border-gray-800 hover:border-blue-500/50 transition-all text-left group shadow-xs hover:shadow-blue-500/10 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-gray-800 border border-gray-700">
                    {item.icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-blue-300 transition-colors">
                    {item.title}
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700/60 font-medium">
                  {item.tag}
                </span>
              </div>
              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed group-hover:text-gray-300 transition-colors">
                {item.prompt}
              </p>
            </div>
            <span className="text-[10px] text-blue-400/80 font-medium mt-2 block group-hover:text-blue-300">
              Run prompt →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
