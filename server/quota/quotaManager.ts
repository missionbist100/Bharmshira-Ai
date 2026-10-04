import { db } from "../database/db";
import { CONFIG } from "../config";
import crypto from "crypto";

export interface QuotaStatus {
  userId: string;
  date: string;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
  modelBreakdown: Record<string, number>;
}

export class QuotaManager {
  /**
   * Get current UTC date in YYYY-MM-DD format
   */
  static getTodayUtcString(): string {
    const now = new Date();
    return now.toISOString().split("T")[0];
  }

  /**
   * Next UTC midnight timestamp
   */
  static getNextResetTime(): string {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    return tomorrow.toISOString();
  }

  /**
   * Get detailed quota usage for a user today
   */
  static getUserQuota(userId: string): QuotaStatus {
    const today = this.getTodayUtcString();
    
    // Check user role
    const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: string } | undefined;
    const isAdmin = user?.role === "admin";
    const limit = isAdmin ? 1000 : CONFIG.DAILY_QUERY_LIMIT; // Admins get higher dev capacity

    // Query successful or in-flight queries today
    const rows = db.prepare(`
      SELECT model, COUNT(*) as count 
      FROM usage 
      WHERE user_id = ? AND date = ? AND status IN ('success', 'processing')
      GROUP BY model
    `).all(userId, today) as Array<{ model: string; count: number }>;

    let totalUsed = 0;
    const modelBreakdown: Record<string, number> = {};

    for (const row of rows) {
      totalUsed += Number(row.count);
      modelBreakdown[row.model] = Number(row.count);
    }

    const remaining = Math.max(0, limit - totalUsed);

    return {
      userId,
      date: today,
      limit,
      used: totalUsed,
      remaining,
      resetAt: this.getNextResetTime(),
      modelBreakdown,
    };
  }

  /**
   * Backend quota enforcement gate before processing any AI generation.
   * Throws Error if quota is exceeded.
   */
  static reserveQuota(userId: string, model: string): { usageId: string; quota: QuotaStatus } {
    const currentQuota = this.getUserQuota(userId);

    if (currentQuota.remaining <= 0) {
      // Log blocked attempt
      const usageId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO usage (id, user_id, date, model, status, token_count, duration_ms, created_at)
        VALUES (?, ?, ?, ?, 'rate_limited', 0, 0, ?)
      `).run(usageId, userId, currentQuota.date, model, new Date().toISOString());

      throw new Error(
        `Daily query limit reached (${currentQuota.used} / ${currentQuota.limit} queries used today across all models). Your quota resets at 00:00 UTC.`
      );
    }

    // Atomically reserve query
    const usageId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO usage (id, user_id, date, model, status, token_count, duration_ms, created_at)
      VALUES (?, ?, ?, ?, 'processing', 0, 0, ?)
    `).run(usageId, userId, currentQuota.date, model, now);

    return {
      usageId,
      quota: {
        ...currentQuota,
        used: currentQuota.used + 1,
        remaining: currentQuota.remaining - 1,
      },
    };
  }

  /**
   * Finalize usage tracking with response metrics
   */
  static finalizeUsage(usageId: string, success: boolean, tokenCount = 0, durationMs = 0): void {
    const status = success ? "success" : "failed";
    db.prepare(`
      UPDATE usage 
      SET status = ?, token_count = ?, duration_ms = ?
      WHERE id = ?
    `).run(status, tokenCount, durationMs, usageId);
  }
}
