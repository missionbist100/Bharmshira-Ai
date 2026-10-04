import React from "react";
import { useAuth } from "../context/AuthContext";
import { ModelDefinition } from "../types";
import { X, Sliders, Shield, Layers, Clock, Zap } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelDefinition[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, models }) => {
  const { settings, updateSettings, quota, user } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="settings-modal-dialog"
        className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl p-6 relative text-gray-100 max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-200 rounded-md hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-800">
          <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Platform Settings</h3>
            <p className="text-xs text-gray-400">Manage your AI routing and quota preferences</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Default Model */}
          <div>
            <label className="block text-xs font-semibold text-gray-200 mb-1.5">Default AI Model</label>
            <select
              value={settings?.default_model || "gemini-model-1"}
              onChange={(e) => updateSettings({ default_model: e.target.value })}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.provider.toUpperCase()})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              The primary model selected when creating new conversations.
            </p>
          </div>

          {/* Automatic Fallback Toggle */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-950/60 border border-gray-800">
            <div>
              <p className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Automatic Multi-Model Failover
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                If the primary model provider is temporarily unavailable or rate-limited, automatically re-route requests to an equivalent model.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings?.auto_fallback ?? true}
              onChange={(e) => updateSettings({ auto_fallback: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Auto Search Toggle */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-950/60 border border-gray-800">
            <div>
              <p className="text-xs font-semibold text-gray-200">Default Web Search On</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Automatically enable live web grounding on every new query.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings?.auto_search ?? false}
              onChange={(e) => updateSettings({ auto_search: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Detailed Quota Breakdown */}
          <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Quota Allocation
              </span>
              <span className="text-xs font-bold text-gray-100 font-mono">
                {quota ? `${quota.remaining} / ${quota.limit} Left Today` : "100 Queries / Day"}
              </span>
            </div>

            <p className="text-[11px] text-gray-400">
              The 100-query daily limit is strictly enforced on the server across all model providers to guarantee reliability.
            </p>

            {quota?.modelBreakdown && Object.keys(quota.modelBreakdown).length > 0 && (
              <div className="pt-2 border-t border-gray-800 space-y-1.5">
                <p className="text-[10px] uppercase font-semibold text-gray-400">Today's Usage Breakdown</p>
                {Object.entries(quota.modelBreakdown).map(([model, count]) => (
                  <div key={model} className="flex justify-between text-xs text-gray-300">
                    <span className="truncate">{model}</span>
                    <span className="font-mono font-medium">{count} queries</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-400" /> Protected by backend QuotaManager
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-400" /> Resets: 00:00 UTC
              </span>
            </div>
          </div>

          {/* User Account Info */}
          {user && (
            <div className="p-3 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-400 flex items-center justify-between">
              <div>
                <span className="text-gray-200 font-medium">{user.email}</span>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 text-[10px]">
                  {user.role.toUpperCase()}
                </span>
              </div>
              <span className="text-[11px] text-gray-400 font-mono">ID: {user.id.slice(0, 10)}...</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
