import express from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { initDatabase } from "./server/database/db";
import { authController, authenticateToken } from "./server/auth/auth";
import { chatRouter } from "./server/chat/chatRouter";
import { adminRouter } from "./server/admin/adminRouter";
import { CONFIG } from "./server/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Relational SQLite database schema and seeds
  initDatabase();

  // Basic Middlewares
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  app.use(cookieParser());

  // CORS & Security headers (configured to allow AI Studio iframe preview)
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    // Ensure no X-Frame-Options or frame-ancestors restrict iframe embedding
    res.removeHeader("X-Frame-Options");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "operational",
      platform: "Bharmashira AI",
      timestamp: new Date().toISOString(),
      models: {
        gemini: [CONFIG.GEMINI_MODEL_1, CONFIG.GEMINI_MODEL_2],
        openai: [CONFIG.OPENAI_MODEL_1, CONFIG.OPENAI_MODEL_2],
      },
    });
  });

  // Auth Routes
  app.post("/api/auth/register", authController.register);
  app.post("/api/auth/login", authController.login);
  app.get("/api/auth/me", authenticateToken, authController.me);
  app.put("/api/auth/settings", authenticateToken, authController.updateSettings);
  app.post("/api/auth/logout", authController.logout);

  // Chat & Generation Routes
  app.use("/api", chatRouter);

  // Admin Dashboard Routes
  app.use("/api/admin", adminRouter);

  // Vite middleware for development vs static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith("/api")) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bharmashira AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
