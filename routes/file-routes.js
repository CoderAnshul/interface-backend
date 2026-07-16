import express from "express";
import {
  createFile,
  getFiles,
  getFileById,
  updateFile,
  deleteFile,
} from "../controllers/fileController.js";
import { upload } from "../middlewares/upload-middleware.js";

const fileRouter = express.Router();

// CRUD Routes
fileRouter.post("/", upload.single("file"), createFile); // Create
fileRouter.get("/", getFiles); // Read all
fileRouter.get("/:id", getFileById); // Read one
fileRouter.put("/:id", upload.any(), updateFile); // Update
fileRouter.delete("/:id", deleteFile); // Delete

export default fileRouter;
