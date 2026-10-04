import React, { useState } from "react";
import { Conversation, QuotaStatus, User } from "../types";
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  Settings,
  Shield,
  LogOut,
  LogIn,
  Layers,
  Clock,
  Sparkles,
  BarChart3,
} from "lucide-react";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  quota: QuotaStatus | null;
  user: User | null;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  quota,
  user,
  onOpenSettings,
  onOpenAdmin,
  onOpenAuth,
  onLogout,
  isOpen,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartEdit = (e: React.MouseEvent, c: Conversation) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const handleSaveEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteConversation(id);
  };

  // Quota bar calculations
  const limit = quota?.limit || 100;
  const remaining = quota?.remaining !== undefined ? quota.remaining : 100;
  const used = quota?.used || 0;
  const percentage = Math.min(100, Math.round((remaining / limit) * 100));

  let barColor = "bg-blue-500";
  if (percentage <= 15) barColor = "bg-rose-500";
  else if (percentage <= 40) barColor = "bg-amber-500";

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-gray-950 border-r border-gray-800/80 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                Bharmashira AI
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50">
                  v1.0
                </span>
              </h1>
              <p className="text-[11px] text-gray-400">Multi-Model AI Platform</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-200 rounded-md hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            type="button"
            id="new-chat-btn"
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm shadow-sm transition-all hover:shadow-blue-500/20 active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        {/* Search Conversations */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="search-conv-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8.5 pr-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-200 placeholder-gray-400 focus:outline-none focus:border-gray-700 focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-40" />
              <p className="text-xs text-gray-400">No conversations yet</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Start a new chat to begin</p>
            </div>
          ) : (
            filtered.map((c) => {
              const isActive = c.id === activeConversationId;
              const isEditing = editingId === c.id;

              return (
                <div
                  key={c.id}
                  id={`conversation-item-${c.id}`}
                  onClick={() => {
                    if (!isEditing) {
                      onSelectConversation(c.id);
                      onCloseMobile();
                    }
                  }}
                  className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    isActive
                      ? "bg-gray-850 text-white font-medium shadow-xs"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-900/70"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? "text-blue-400" : "text-gray-400 group-hover:text-gray-400"
                      }`}
                    />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        className="w-full bg-gray-900 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate text-xs">{c.title}</span>
                    )}
                  </div>

                  {/* Action Icons on hover */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleSaveEdit(e, c.id)}
                          className="p-1 hover:text-emerald-400 text-gray-400"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="p-1 hover:text-rose-400 text-gray-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(e, c)}
                          className="p-1 text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, c.id)}
                          className="p-1 text-gray-400 hover:text-rose-400 rounded hover:bg-gray-800"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 100 Query Daily Limit Widget */}
        <div className="p-3 mx-2 my-2 rounded-xl bg-gray-900 border border-gray-800 shadow-sm" id="daily-quota-widget">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-gray-300 flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-400" />
              Daily Limit
            </span>
            <span className="text-[11px] font-bold text-gray-100 font-mono">
              {remaining} / {limit} left
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full ${barColor} transition-all duration-300 rounded-full`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>Shared across all models</span>
            <span className="flex items-center gap-0.5" title="Resets every midnight at 00:00 UTC">
              <Clock className="w-2.5 h-2.5" /> 00:00 UTC
            </span>
          </div>
        </div>

        {/* User Account Bar */}
        <div className="p-3 border-t border-gray-800/80 bg-gray-950/80">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-500/30 shrink-0">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-200 truncate">{user.email}</p>
                  <div className="flex items-center gap-1">
                    {user.role === "admin" ? (
                      <span className="text-[9px] font-semibold uppercase px-1 py-0.2 rounded bg-amber-900/40 text-amber-300 border border-amber-700/50">
                        Admin
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold uppercase px-1 py-0.2 rounded bg-gray-800 text-gray-400">
                        User
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {user.role === "admin" && (
                  <button
                    type="button"
                    id="admin-dashboard-btn"
                    onClick={onOpenAdmin}
                    className="p-1.5 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-gray-850 transition-colors"
                    title="Admin Dashboard"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  id="settings-btn"
                  onClick={onOpenSettings}
                  className="p-1.5 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-850 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  id="logout-btn"
                  onClick={onLogout}
                  className="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-gray-850 transition-colors"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              id="auth-open-btn"
              onClick={onOpenAuth}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gray-900 hover:bg-gray-850 border border-gray-800 text-xs font-medium text-gray-200 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5 text-blue-400" />
              Sign In or Register
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
