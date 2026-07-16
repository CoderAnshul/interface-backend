import express from "express";
import multer from "multer";
import {
  createNews,
  getAllNews,
  getNewsById,
  getNewsBySlug,
  updateNews,
  deleteNews,
  searchNews,
  incrementNewsStats,
  likeNews,
  unlikeNews,
  toggleLike,
  viewNews,
  shareNews,
  likeNewsByUserId,
  viewNewsByUserId,
  shareNewsByUserId,
  getUsersWhoViewed,
  getUsersWhoLiked,
  getUsersWhoShared,
  checkUserInteractionStatus,
  uploadContentVideo,
  uploadEditorImage,
  uploadContentImage, // Restored missing import
  getAllCategories,
  addComment,
  addReply,
  deleteComment,
  getComments,
} from "../controllers/newsController.js";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import passport from "passport";
import { isAdmin } from "../middlewares/isAdmin.js";
import newsUpload from "../middlewares/newsUpload.js";
import contentImageUpload from "../middlewares/contentImageUpload.js";
import contentVideoUpload from "../middlewares/contentVideoUpload.js";
import { combinedUpload } from "../middlewares/combinedNewsUpload.js";

const router = express.Router();

// Public routes (no authentication required)
router.get("/", getAllNews); // GET /news - Get all news with filters
router.get("/all/categories", getAllCategories);
router.get("/search", searchNews); // GET /news/search?q=query - Search news
router.get("/slug/:slug", getNewsBySlug); // GET /news/slug/:slug - Get news by slug
router.get("/:id", getNewsById); // GET /news/:id - Get news by ID
router.get("/:id/comments", getComments); // GET /news/:id/comments - Get comments for news
router.patch("/:id/stats", incrementNewsStats); // PATCH /news/:id/stats - Increment views/likes/shares (tracks user if authenticated)

// Public routes to get user lists (no auth required)
router.get("/:id/users/viewed", getUsersWhoViewed); // GET /news/:id/users/viewed - Get users who viewed
router.get("/:id/users/liked", getUsersWhoLiked); // GET /news/:id/users/liked - Get users who liked
router.get("/:id/users/shared", getUsersWhoShared); // GET /news/:id/users/shared - Get users who shared

// Public routes with userId in URL (no auth required)
router.post("/:id/like/:userId", likeNewsByUserId); // POST /news/:id/like/:userId - Like news by user ID
router.post("/:id/view/:userId", viewNewsByUserId); // POST /news/:id/view/:userId - Track view by user ID
router.post("/:id/share/:userId", shareNewsByUserId); // POST /news/:id/share/:userId - Share news by user ID



// Protected routes (authentication required)
router.use(accessTokenAutoRefresh);
router.use(passport.authenticate("jwt", { session: false }));

// User interaction routes (authenticated users - uses token user)
router.post("/:id/like", likeNews); // POST /news/:id/like - Like news (uses authenticated user)
router.delete("/:id/like", unlikeNews); // DELETE /news/:id/like - Unlike news (uses authenticated user)
router.post("/:id/toggle-like", toggleLike); // POST /news/:id/toggle-like - Toggle like/unlike (alternative)
router.post("/:id/view", viewNews); // POST /news/:id/view - Track view (uses authenticated user)
router.post("/:id/share", shareNews); // POST /news/:id/share - Share news (uses authenticated user)

router.get("/:id/interaction-status", checkUserInteractionStatus); // GET /news/:id/interaction-status - Check if user interacted
router.post("/:id/comment", addComment); // POST /news/:id/comment - Add comment (uses authenticated user)
router.post("/:id/comment/:commentId/reply", addReply); // POST /news/:id/comment/:commentId/reply - Add reply to comment
router.delete("/:id/comment/:commentId", deleteComment); // DELETE /news/:id/comment/:commentId - Delete comment

// Admin only routes
// Handle multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
  }
  next();
};

router.post("/", combinedUpload, handleMulterError, createNews); // POST /news - Create news with image upload and content images (Admin only)
router.post(
  "/content-image",
  contentImageUpload.single("image"),
  handleMulterError,
  uploadContentImage
); // POST /news/content-image - Upload image for content blocks (Admin only)
router.post(
  "/content-video",
  contentVideoUpload.single("video"),
  handleMulterError,
  uploadContentVideo
); // POST /news/content-video - Upload video for content blocks (Admin only)
router.put("/:id", combinedUpload, handleMulterError, updateNews); // PUT /news/:id - Update news with image upload (Admin only)
router.delete("/:id", deleteNews); // DELETE /news/:id - Delete news (Admin only)

export default router;
