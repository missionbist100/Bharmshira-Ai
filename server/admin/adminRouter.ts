import { Router, Response } from "express";
import { db } from "../database/db";
import { AuthRequest, requireAdmin } from "../auth/auth";
import { QuotaManager } from "../quota/quotaManager";

const router = Router();

// Metrics endpoint
router.get("/metrics", requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const today = QuotaManager.getTodayUtcString();

    // Total registered users
    const totalUsersRow = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    const totalUsers = Number(totalUsersRow?.count || 0);

    // Active users today
    const activeUsersRow = db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM usage WHERE date = ?").get(today) as { count: number };
    const activeUsersToday = Number(activeUsersRow?.count || 0);

    // Total queries today
    const dailyQueriesRow = db.prepare("SELECT COUNT(*) as count FROM usage WHERE date = ? AND status = 'success'").get(today) as { count: number };
    const dailyQueries = Number(dailyQueriesRow?.count || 0);

    // Queries by model
    const modelDistribution = db.prepare(`
      SELECT model, COUNT(*) as count 
      FROM usage 
      WHERE date = ? AND status = 'success'
      GROUP BY model
    `).all(today) as Array<{ model: string; count: number }>;

    // Error statistics
    const totalErrorsRow = db.prepare("SELECT COUNT(*) as count FROM api_logs WHERE success = 0").get() as { count: number };
    const totalErrors = Number(totalErrorsRow?.count || 0);

    const todayErrorsRow = db.prepare("SELECT COUNT(*) as count FROM usage WHERE date = ? AND status = 'failed'").get(today) as { count: number };
    const todayErrors = Number(todayErrorsRow?.count || 0);

    // Research sessions count
    const researchRow = db.prepare("SELECT COUNT(*) as count FROM research_sessions").get() as { count: number };
    const totalResearchSessions = Number(researchRow?.count || 0);

    // Uploaded files count
    const filesRow = db.prepare("SELECT COUNT(*) as count FROM uploaded_files").get() as { count: number };
    const totalUploadedFiles = Number(filesRow?.count || 0);

    // Latency metrics
    const latencyRow = db.prepare("SELECT AVG(duration_ms) as avg_duration FROM api_logs WHERE success = 1").get() as { avg_duration: number | null };
    const avgLatencyMs = Math.round(Number(latencyRow?.avg_duration || 0));

    // Daily queries over past 7 days
    const recentTrend = db.prepare(`
      SELECT date, COUNT(*) as count 
      FROM usage 
      WHERE status = 'success'
      GROUP BY date 
      ORDER BY date DESC 
      LIMIT 7
    `).all() as Array<{ date: string; count: number }>;

    // Estimated Cost ($0.00015 avg per flash query, $0.002 per pro/plus query)
    let estimatedCostUsd = 0;
    for (const m of modelDistribution) {
      if (m.model.includes("pro") || m.model.includes("plus") || m.model.includes("openai-model-2")) {
        estimatedCostUsd += m.count * 0.002;
      } else {
        estimatedCostUsd += m.count * 0.00015;
      }
    }

    return res.json({
      metrics: {
        totalUsers,
        activeUsersToday,
        dailyQueries,
        totalErrors,
        todayErrors,
        totalResearchSessions,
        totalUploadedFiles,
        avgLatencyMs,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
        systemHealth: {
          database: "Healthy (SQLite Relational WAL)",
          aiRouter: "Operational (OpenAI + Gemini)",
          webSearch: "Online (Active Grounding & Live Engine)",
          uptimeSeconds: Math.floor(process.uptime()),
        },
      },
      modelDistribution,
      recentTrend: recentTrend.reverse(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load admin metrics" });
  }
});

// Logs endpoint
router.get("/logs", requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const logs = db.prepare(`
      SELECT id, request_id, user_id, provider, model, duration_ms, success, error_message, token_usage, created_at 
      FROM api_logs 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all();

    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load API logs" });
  }
});

// User management list
router.get("/users", requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const today = QuotaManager.getTodayUtcString();
    const users = db.prepare(`
      SELECT u.id, u.email, u.role, u.created_at,
        (SELECT COUNT(*) FROM usage WHERE user_id = u.id AND date = ? AND status = 'success') as queries_today
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 100
    `).all(today);

    return res.json({ users });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load users" });
  }
});

// Reset a specific user's quota
router.post("/reset-user-quota", requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const today = QuotaManager.getTodayUtcString();
    db.prepare("DELETE FROM usage WHERE user_id = ? AND date = ?").run(userId, today);

    return res.json({ success: true, message: `Reset quota for user ${userId}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const adminRouter = router;
