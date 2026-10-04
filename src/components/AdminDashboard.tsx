import React, { useState, useEffect } from "react";
import { AdminMetrics, ApiLog } from "../types";
import {
  X,
  Shield,
  Users,
  Activity,
  Zap,
  AlertTriangle,
  Clock,
  DollarSign,
  RefreshCw,
  Server,
  Layers,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [modelDistribution, setModelDistribution] = useState<Array<{ model: string; count: number }>>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string; created_at: string; queries_today: number }>>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "users">("overview");
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<"all" | "errors" | "gemini" | "openai">("all");

  const loadAdminData = async () => {
    setLoading(true);
    const token = localStorage.getItem("bharmashira_token");
    if (!token) return;

    try {
      // 1. Fetch Metrics
      const resMetrics = await fetch("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resMetrics.ok) {
        const data = await resMetrics.json();
        setMetrics(data.metrics);
        setModelDistribution(data.modelDistribution || []);
      }

      // 2. Fetch Logs
      const resLogs = await fetch("/api/admin/logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resLogs.ok) {
        const data = await resLogs.json();
        setLogs(data.logs || []);
      }

      // 3. Fetch Users
      const resUsers = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resUsers.ok) {
        const data = await resUsers.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen]);

  const handleResetUserQuota = async (userId: string) => {
    const token = localStorage.getItem("bharmashira_token");
    if (!token) return;
    try {
      const res = await fetch("/api/admin/reset-user-quota", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        alert("User quota successfully reset to 100 for today.");
        loadAdminData();
      }
    } catch {
      alert("Failed to reset user quota.");
    }
  };

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (logFilter === "errors") return log.success === 0;
    if (logFilter === "gemini") return log.provider === "gemini";
    if (logFilter === "openai") return log.provider === "openai";
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="admin-dashboard-dialog"
        className="w-full max-w-5xl rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl p-6 relative text-gray-100 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Bharmashira Admin Center</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700/50">
                  Protected System Console
                </span>
              </div>
              <p className="text-xs text-gray-400">Observability, multi-model query tracking, quotas & logs</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAdminData}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 py-3 border-b border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "overview"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            System Metrics & Health
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "logs"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            API Observability Logs
            {metrics?.totalErrors ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-900 text-rose-300">
                {metrics.totalErrors}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "users"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            Users & Quota Management ({users.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="text-xs font-medium">Total Users</span>
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{metrics?.totalUsers || 0}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{metrics?.activeUsersToday || 0} active today</p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="text-xs font-medium">Daily Queries</span>
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{metrics?.dailyQueries || 0}</p>
                  <p className="text-[10px] text-emerald-400 mt-1">Cross-model today</p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="text-xs font-medium">Avg Latency</span>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{metrics?.avgLatencyMs || 0}ms</p>
                  <p className="text-[10px] text-gray-400 mt-1">Streaming avg</p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="text-xs font-medium">Deep Research</span>
                    <Search className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{metrics?.totalResearchSessions || 0}</p>
                  <p className="text-[10px] text-gray-400 mt-1">9-step sessions</p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="text-xs font-medium">Total Errors</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{metrics?.totalErrors || 0}</p>
                  <p className="text-[10px] text-rose-400 mt-1">{metrics?.todayErrors || 0} failed today</p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="text-xs font-medium">Est. Cost</span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xl font-bold text-white">${metrics?.estimatedCostUsd || "0.00"}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Provider inference</p>
                </div>
              </div>

              {/* Models Breakdown & System Health */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Model Distribution */}
                <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
                  <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Queries by AI Model (Today)
                  </h4>
                  {modelDistribution.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">No queries executed yet today</p>
                  ) : (
                    <div className="space-y-2.5">
                      {modelDistribution.map((item) => {
                        const total = metrics?.dailyQueries || 1;
                        const pct = Math.round((item.count / total) * 100);
                        return (
                          <div key={item.model}>
                            <div className="flex justify-between text-xs text-gray-300 mb-1">
                              <span className="font-medium">{item.model}</span>
                              <span className="font-mono text-gray-400">
                                {item.count} queries ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* System Health */}
                <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
                  <h4 className="text-xs font-semibold text-gray-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                    Infrastructure & Health Status
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                      <div>
                        <p className="font-medium text-gray-200">Relational Database</p>
                        <p className="text-[11px] text-gray-400">{metrics?.systemHealth.database}</p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                      <div>
                        <p className="font-medium text-gray-200">AI Routing Layer</p>
                        <p className="text-[11px] text-gray-400">{metrics?.systemHealth.aiRouter}</p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                      <div>
                        <p className="font-medium text-gray-200">Live Search & Research</p>
                        <p className="text-[11px] text-gray-400">{metrics?.systemHealth.webSearch}</p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Online
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 pt-1">
                      <span>Daily Limit Protection: 100 queries/user</span>
                      <span>Uptime: {Math.floor((metrics?.systemHealth.uptimeSeconds || 0) / 60)} minutes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OBSERVABILITY LOGS */}
          {activeTab === "logs" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setLogFilter("all")}
                    className={`px-2.5 py-1 rounded-md ${
                      logFilter === "all" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    All ({logs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter("errors")}
                    className={`px-2.5 py-1 rounded-md ${
                      logFilter === "errors" ? "bg-rose-950 text-rose-300 border border-rose-800" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Errors Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter("gemini")}
                    className={`px-2.5 py-1 rounded-md ${
                      logFilter === "gemini" ? "bg-blue-950 text-blue-300 border border-blue-800" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter("openai")}
                    className={`px-2.5 py-1 rounded-md ${
                      logFilter === "openai" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    OpenAI
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/60 text-gray-400 font-semibold">
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Request ID</th>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Model</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Error / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-mono text-[11px]">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-gray-400">
                          No logs found matching filter
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-900/40 transition-colors">
                          <td className="p-3 text-gray-400 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-gray-300">{log.request_id.slice(0, 12)}...</td>
                          <td className="p-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-sans ${
                                log.provider === "gemini"
                                  ? "bg-blue-900/50 text-blue-300"
                                  : "bg-emerald-900/50 text-emerald-300"
                              }`}
                            >
                              {log.provider}
                            </span>
                          </td>
                          <td className="p-3 text-gray-200">{log.model}</td>
                          <td className="p-3 text-gray-400">{log.duration_ms}ms</td>
                          <td className="p-3">
                            {log.success === 1 ? (
                              <span className="flex items-center gap-1 text-emerald-400 font-sans">
                                <CheckCircle2 className="w-3.5 h-3.5" /> 200 OK
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-rose-400 font-sans">
                                <XCircle className="w-3.5 h-3.5" /> Failed
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-rose-300 max-w-xs truncate font-sans">
                            {log.error_message || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: USERS & QUOTA MANAGEMENT */}
          {activeTab === "users" && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/60 text-gray-400 font-semibold">
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Queries Today</th>
                      <th className="p-3">Quota Balance</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-xs">
                    {users.map((u) => {
                      const queries = u.queries_today || 0;
                      const remaining = Math.max(0, 100 - queries);
                      return (
                        <tr key={u.id} className="hover:bg-gray-900/40">
                          <td className="p-3 font-medium text-gray-200">{u.email}</td>
                          <td className="p-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                                u.role === "admin"
                                  ? "bg-amber-900/50 text-amber-300 border border-amber-700/50"
                                  : "bg-gray-800 text-gray-400"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-mono text-gray-200">{queries}</td>
                          <td className="p-3 font-mono text-gray-200">
                            <span className={remaining < 15 ? "text-rose-400" : "text-emerald-400"}>
                              {remaining} / 100
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleResetUserQuota(u.id)}
                              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] border border-gray-700"
                            >
                              Reset Quota
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
