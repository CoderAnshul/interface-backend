import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Allowed mime types for videos
const ALLOWED_MIME = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo', // AVI
  'video/x-ms-wmv', // WMV
  'video/mpeg',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(process.cwd(), 'uploads', 'news', 'content', 'videos', today);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Use original filename from multipart form data
    // Only sanitize for security (remove path separators)
    const originalName = file.originalname;
    // Remove path separators to prevent path traversal attacks
    const safe = originalName
      .replace(/[\/\\]/g, '_') // Replace path separators only
      .trim(); // Remove leading/trailing whitespace
    
    cb(null, safe);
  }
});

const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Also check file extension as fallback
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.mpeg', '.mpg'];
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only videos are allowed (MP4, WebM, OGG, MOV, AVI, WMV, MPEG)'), false);
    }
  }
};

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB per file (videos are larger)
});

