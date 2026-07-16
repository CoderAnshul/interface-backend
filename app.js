import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import passport from "passport";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register Passport JWT strategy before using passport
import "./config/jwt-authenticate.js";

const app = express();

// Request logger for debugging 404s
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// CORS config
const corsOptions = {
  origin: "*", // for production, set specific domain
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(helmet());

// Increase body parser limits and timeouts for large file uploads
app.use(express.json({ limit: '2gb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '2gb' }));

// Set global timeouts for large file operations
app.use((req, res, next) => {
  // Set much longer timeouts for chunk upload routes
  if (req.path.includes('/chunk') || req.path.includes('/upload')) {
    req.setTimeout(7200000); // 120 minutes (2 hours)
    res.setTimeout(7200000); // 120 minutes (2 hours)
  } else if (req.path.includes('/video') || req.path.includes('/file')) {
    req.setTimeout(1800000); // 30 minutes for video/file operations
    res.setTimeout(1800000); // 30 minutes for video/file operations
  } else {
    req.setTimeout(600000); // 10 minutes for other routes
    res.setTimeout(600000); // 10 minutes for other routes
  }
  next();
});

// Debug (optional)

// API Routes
app.use("/", routes);

export default app;

