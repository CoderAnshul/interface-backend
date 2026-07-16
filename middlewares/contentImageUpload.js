import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Allowed mime types for images
const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/jfif', // JPEG File Interchange Format
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(process.cwd(), 'uploads', 'news', 'content', today);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Use original filename from multipart form data
    // Only sanitize for security (remove path separators)
    const originalName = file.originalname;
    // Remove path separators to prevent path traversal attacks
    // Keep spaces and most special characters as they are in the original
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
    // Also check file extension as fallback (some browsers may not send correct MIME type)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.jfif'];
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only images are allowed (PNG, JPEG, JPG, GIF, WEBP, SVG, JFIF)'), false);
    }
  }
};

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB per file
});

