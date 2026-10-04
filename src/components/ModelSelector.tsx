import React, { useState, useRef, useEffect } from "react";
import { ModelDefinition } from "../types";
import { ChevronDown, Sparkles, Zap, Shield, Check } from "lucide-react";

interface ModelSelectorProps {
  models: ModelDefinition[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-center" ref={dropdownRef} id="model-selector-container">
      <button
        type="button"
        id="model-selector-btn"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full sm:rounded-lg bg-gray-900/90 hover:bg-gray-800 text-gray-200 border border-gray-700/80 hover:border-gray-600 transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            selectedModel?.provider === "gemini" ? "bg-blue-400" : "bg-emerald-400"
          }`}
        />
        <span className="font-semibold text-gray-100 truncate max-w-[110px] xs:max-w-[140px] sm:max-w-[180px]">
          {selectedModel?.name || "Select Model"}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop to easily tap outside and dim background */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 sm:hidden animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu - perfectly centered on mobile and centered under button on desktop */}
          <div
            id="model-dropdown-menu"
            className="fixed top-16 inset-x-3 max-w-sm mx-auto sm:absolute sm:inset-auto sm:top-full sm:left-1/2 sm:-translate-x-1/2 sm:w-88 sm:mt-2 rounded-xl bg-gray-900 border border-gray-700/90 shadow-2xl z-50 overflow-hidden backdrop-blur-md divide-y divide-gray-800/80 text-left animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="px-3.5 py-2.5 bg-gray-950/70 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">AI Model System</p>
                <p className="text-[11px] text-gray-400">100% Real API Inference • Zero Setup</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 font-medium">
                Live APIs
              </span>
            </div>

            <div className="max-h-[65vh] sm:max-h-96 overflow-y-auto py-1 divide-y divide-gray-800/40">
              {models.map((model) => {
                const isSelected = model.id === selectedModelId;
                const isGemini = model.provider === "gemini";

                return (
                  <button
                    key={model.id}
                    id={`model-option-${model.id}`}
                    type="button"
                    onClick={() => {
                      onSelectModel(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-3 transition-colors flex items-start gap-3 hover:bg-gray-800/80 ${
                      isSelected ? "bg-blue-950/30 text-blue-100" : "text-gray-200"
                    }`}
                  >
                    <div
                      className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
                        isGemini ? "bg-blue-900/40 text-blue-400" : "bg-emerald-900/40 text-emerald-400"
                      }`}
                    >
                      {isGemini ? <Sparkles className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-gray-100">{model.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              isGemini ? "bg-blue-900/50 text-blue-300" : "bg-emerald-900/50 text-emerald-300"
                            }`}
                          >
                            {isGemini ? "Google" : "OpenAI"}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded border bg-emerald-950/50 text-emerald-300 border-emerald-800/50 font-medium">
                            Real API
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                      </div>

                      <p className="text-[11px] font-mono text-gray-400 mt-0.5">{model.actualModelId}</p>
                      <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">{model.description}</p>

                      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                        <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">{model.speed}</span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{model.intelligence}</span>
                        {model.supportsVision && (
                          <span className="text-blue-400 font-medium">Vision</span>
                        )}
                        {model.supportsSearch && (
                          <span className="text-emerald-400 font-medium">Web</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-2.5 bg-gray-950/50 text-center">
              <span className="text-[10px] text-gray-400 flex items-center justify-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> Real server-side inference active • Zero user keys required
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
