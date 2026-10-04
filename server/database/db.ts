import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

// Ensure data directory exists
const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "bharmashira.db");
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign key constraints for production performance & relational integrity
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Initialize relational schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      default_model TEXT NOT NULL DEFAULT 'gemini-model-1',
      auto_search INTEGER NOT NULL DEFAULT 1,
      auto_fallback INTEGER NOT NULL DEFAULT 1,
      theme TEXT NOT NULL DEFAULT 'system',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'chat',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
      content TEXT NOT NULL,
      sources TEXT, -- JSON array of SourceCitation
      search_queries TEXT, -- JSON array of strings
      attachments TEXT, -- JSON array of file references
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL, -- 'YYYY-MM-DD' UTC
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success', -- 'success' | 'failed' | 'rate_limited'
      token_count INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS research_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT,
      topic TEXT NOT NULL,
      plan TEXT, -- JSON breakdown steps
      sources TEXT, -- JSON array of processed sources
      report TEXT, -- Markdown final synthesized report
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed' | 'failed'
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      extracted_text TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      user_id TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      success INTEGER NOT NULL,
      error_message TEXT,
      token_usage INTEGER,
      created_at TEXT NOT NULL
    );

    -- Relational Indexes for high-throughput queries
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_usage_date ON usage(date);
    CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_research_user ON research_sessions(user_id, created_at DESC);
  `);

  // Seed default admin and user if not exists
  const adminHash = bcrypt.hashSync("AdminPass123!", 10);
  const userHash = bcrypt.hashSync("UserPass123!", 10);
  const now = new Date().toISOString();

  const checkAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@bharmashira.ai");
  if (!checkAdmin) {
    const adminId = "admin-root-001";
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adminId, "admin@bharmashira.ai", adminHash, "admin", now, now);

    db.prepare(`
      INSERT INTO user_settings (user_id, default_model, auto_search, auto_fallback, theme, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adminId, "gemini-model-1", 1, 1, "dark", now);
  } else {
    // Ensure password hash matches
    db.prepare("UPDATE users SET password_hash = ? WHERE email = ?").run(adminHash, "admin@bharmashira.ai");
  }

  const checkDemoUser = db.prepare("SELECT id FROM users WHERE email = ?").get("user@bharmashira.ai");
  if (!checkDemoUser) {
    const userId = "user-demo-001";
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, "user@bharmashira.ai", userHash, "user", now, now);

    db.prepare(`
      INSERT INTO user_settings (user_id, default_model, auto_search, auto_fallback, theme, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, "gemini-model-1", 1, 1, "dark", now);
  } else {
    // Ensure password hash matches
    db.prepare("UPDATE users SET password_hash = ? WHERE email = ?").run(userHash, "user@bharmashira.ai");
  }
}
