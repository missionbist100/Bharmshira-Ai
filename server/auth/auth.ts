import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../database/db";
import { CONFIG } from "../config";
import { QuotaManager } from "../quota/quotaManager";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "user" | "admin";
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    CONFIG.AUTH_SECRET,
    { expiresIn: "7d" }
  );
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  // Extract token from Authorization header or cookie
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, CONFIG.AUTH_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired session token" });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  let token = "";
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, CONFIG.AUTH_SECRET) as AuthenticatedUser;
      req.user = decoded;
    } catch {
      // Ignore invalid optional token
    }
  }
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user) {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Administrator privileges required" });
    }
    return next();
  }

  // If authenticateToken wasn't called before requireAdmin, authenticate first
  authenticateToken(req, res, () => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Administrator privileges required" });
    }
    next();
  });
}

// Auth API Controller
export const authController = {
  register: (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password || typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const id = "user-" + crypto.randomUUID();
      const passwordHash = bcrypt.hashSync(password, 10);
      const now = new Date().toISOString();
      const role = normalizedEmail.includes("admin") ? "admin" : "user";

      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, normalizedEmail, passwordHash, role, now, now);

      db.prepare(`
        INSERT INTO user_settings (user_id, default_model, auto_search, auto_fallback, theme, updated_at)
        VALUES (?, 'gemini-model-1', 1, 1, 'dark', ?)
      `).run(id, now);

      const user: AuthenticatedUser = { id, email: normalizedEmail, role };
      const token = generateToken(user);
      const quota = QuotaManager.getUserQuota(id);

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        user,
        token,
        quota,
        settings: {
          default_model: "gemini-model-1",
          auto_search: true,
          auto_fallback: true,
          theme: "dark",
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to register user" });
    }
  },

  login: (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const row = db.prepare(`
        SELECT id, email, password_hash, role 
        FROM users 
        WHERE email = ?
      `).get(normalizedEmail) as { id: string; email: string; password_hash: string; role: "user" | "admin" } | undefined;

      if (!row) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const passwordMatch = bcrypt.compareSync(password, row.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const user: AuthenticatedUser = { id: row.id, email: row.email, role: row.role };
      const token = generateToken(user);
      const quota = QuotaManager.getUserQuota(row.id);

      const settingsRow = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(row.id) as any;

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        user,
        token,
        quota,
        settings: settingsRow ? {
          default_model: settingsRow.default_model,
          auto_search: Boolean(settingsRow.auto_search),
          auto_fallback: Boolean(settingsRow.auto_fallback),
          theme: settingsRow.theme,
        } : {
          default_model: "gemini-model-1",
          auto_search: true,
          auto_fallback: true,
          theme: "dark",
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Login failed" });
    }
  },

  me: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userRow = db.prepare("SELECT id, email, role, created_at FROM users WHERE id = ?").get(req.user.id) as any;
      if (!userRow) {
        return res.status(404).json({ error: "User not found" });
      }

      const settingsRow = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(req.user.id) as any;
      const quota = QuotaManager.getUserQuota(req.user.id);

      return res.json({
        user: {
          id: userRow.id,
          email: userRow.email,
          role: userRow.role,
          created_at: userRow.created_at,
        },
        quota,
        settings: settingsRow ? {
          default_model: settingsRow.default_model,
          auto_search: Boolean(settingsRow.auto_search),
          auto_fallback: Boolean(settingsRow.auto_fallback),
          theme: settingsRow.theme,
        } : {
          default_model: "gemini-model-1",
          auto_search: true,
          auto_fallback: true,
          theme: "dark",
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to fetch user profile" });
    }
  },

  updateSettings: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { default_model, auto_search, auto_fallback, theme } = req.body;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO user_settings (user_id, default_model, auto_search, auto_fallback, theme, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          default_model = COALESCE(excluded.default_model, user_settings.default_model),
          auto_search = COALESCE(excluded.auto_search, user_settings.auto_search),
          auto_fallback = COALESCE(excluded.auto_fallback, user_settings.auto_fallback),
          theme = COALESCE(excluded.theme, user_settings.theme),
          updated_at = excluded.updated_at
      `).run(
        req.user.id,
        default_model || "gemini-model-1",
        auto_search !== undefined ? (auto_search ? 1 : 0) : 1,
        auto_fallback !== undefined ? (auto_fallback ? 1 : 0) : 1,
        theme || "dark",
        now
      );

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to update settings" });
    }
  },

  logout: (req: Request, res: Response) => {
    res.clearCookie("token");
    return res.json({ success: true, message: "Logged out successfully" });
  },
};
