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
  'image/jfif',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.jfif'];
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only images are allowed (PNG, JPEG, JPG, GIF, WEBP, SVG, JFIF)'), false);
    }
  }
};

// Dynamic storage based on field name
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const today = new Date().toISOString().slice(0, 10);
    
    // Use different directories based on field name
    if (file.fieldname === 'content' || file.fieldname === 'contentImages') {
      const dir = path.join(process.cwd(), 'uploads', 'news', 'content', today);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } else {
      // Main image or other fields
      const dir = path.join(process.cwd(), 'uploads', 'news', today);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    }
  },
  filename: (req, file, cb) => {
    const originalName = file.originalname;
    const safe = originalName.replace(/[\/\\]/g, '_').trim();
    cb(null, safe);
  }
});

// Create multer instance with fields support
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB per file
});

// Combined middleware to handle main image and content (text + images)
export const combinedUpload = upload.fields([
  { name: 'image', maxCount: 1 }, // Main news image
  { name: 'content', maxCount: 20 } // Content images (up to 20 files) - text comes from req.body.content
]);

export default combinedUpload;

