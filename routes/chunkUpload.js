// routes/chunkUpload.js
import express from "express";
import fs from "fs";
import path from "path";

const chunkRouter = express.Router();

const UPLOAD_DIR = path.resolve("uploads/chunks");

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Handle chunk upload
chunkRouter.post("/upload-chunk", async (req, res) => {
  try {
    const fileId = req.headers["fileid"];
    const chunkIndex = req.headers["chunkindex"];
    const totalChunks = req.headers["totalchunks"];

    if (!fileId || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ error: "Missing headers" });
    }

    const chunkDir = path.join(UPLOAD_DIR, fileId);
    if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true });

    const chunkPath = path.join(chunkDir, `${chunkIndex}`);
    const writeStream = fs.createWriteStream(chunkPath);

    req.pipe(writeStream);

    writeStream.on("finish", () => {
      res.json({ success: true, chunkIndex });
    });

    writeStream.on("error", (err) => {
      console.error("Chunk write error:", err);
      res.status(500).json({ error: "Failed to write chunk" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Merge chunks
chunkRouter.post("/merge-chunks", async (req, res) => {
  try {
    const { fileId, fileName, totalChunks } = req.body;
    const chunkDir = path.join(UPLOAD_DIR, fileId);
    const finalPath = path.join("uploads", fileName);

    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `${i}`);
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ error: `Missing chunk ${i}` });
      }
      const data = fs.readFileSync(chunkPath);
      writeStream.write(data);
    }

    writeStream.end();

    writeStream.on("finish", () => {
      // Cleanup chunk dir
      fs.rmSync(chunkDir, { recursive: true, force: true });
      res.json({ success: true, filePath: finalPath });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to merge chunks" });
  }
});

export default chunkRouter;
