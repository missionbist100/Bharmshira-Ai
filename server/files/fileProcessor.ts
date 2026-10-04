import multer from "multer";
import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../database/db";
import { CONFIG } from "../config";
import { AuthRequest } from "../auth/auth";

export interface ProcessedFile {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  extractedText?: string;
  imageBase64?: string;
  imageMimeType?: string;
  isImage: boolean;
}

// Multer memory storage
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONFIG.MAX_FILE_SIZE_BYTES, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = [".pdf", ".docx", ".txt", ".csv", ".json", ".md", ".png", ".jpg", ".jpeg", ".webp"];
    const ext = "." + (file.originalname.split(".").pop()?.toLowerCase() || "");
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Supported: PDF, DOCX, TXT, CSV, JSON, MD, PNG, JPG, WEBP`));
    }
  },
});

export class FileProcessor {
  /**
   * Process an uploaded file buffer into extractable text or vision inline data
   */
  static async processUploadedFile(file: Express.Multer.File, userId: string): Promise<ProcessedFile> {
    const fileId = "file-" + crypto.randomUUID();
    const originalName = file.originalname;
    const mimeType = file.mimetype;
    const size = file.size;
    const ext = "." + (originalName.split(".").pop()?.toLowerCase() || "");

    let extractedText = "";
    let imageBase64: string | undefined;
    let isImage = false;

    // 1. Image handling
    if (mimeType.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      isImage = true;
      imageBase64 = file.buffer.toString("base64");
      extractedText = `[Image attached: ${originalName} (${(size / 1024).toFixed(1)} KB)]`;
    }
    // 2. PDF handling
    else if (ext === ".pdf" || mimeType === "application/pdf") {
      try {
        const pdfParseModule = await import("pdf-parse");
        // pdf-parse module resolution compatibility
        const parseFunc = (pdfParseModule as any).default || pdfParseModule;
        const pdfData = await parseFunc(file.buffer);
        extractedText = pdfData.text || "";
      } catch (err: any) {
        extractedText = `[PDF text extraction fallback: ${originalName}]`;
      }
    }
    // 3. Text, CSV, JSON, Markdown
    else if ([".txt", ".csv", ".json", ".md"].includes(ext) || mimeType.startsWith("text/")) {
      extractedText = file.buffer.toString("utf-8");
    }
    // 4. DOCX fallback text extraction
    else if (ext === ".docx") {
      // Basic text extraction from docx XML content if unzipped, or ascii stream
      const raw = file.buffer.toString("utf-8");
      const textMatches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (textMatches) {
        extractedText = textMatches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ");
      } else {
        extractedText = file.buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t]/g, " ").trim();
      }
    }

    // Chunking / Cap size for text context
    if (extractedText && extractedText.length > 20000) {
      const header = `--- [Document Excerpt: ${originalName} (Original length: ${extractedText.length} chars, showing top relevant content)] ---\n\n`;
      extractedText = header + extractedText.slice(0, 18000) + "\n\n--- [End of Document Excerpt] ---";
    }

    // Persist to relational DB
    db.prepare(`
      INSERT INTO uploaded_files (id, user_id, filename, file_type, file_size, extracted_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(fileId, userId, originalName, mimeType || ext, size, extractedText, new Date().toISOString());

    return {
      id: fileId,
      filename: originalName,
      fileType: mimeType || ext,
      fileSize: size,
      extractedText,
      imageBase64,
      imageMimeType: isImage ? mimeType || "image/png" : undefined,
      isImage,
    };
  }
}
