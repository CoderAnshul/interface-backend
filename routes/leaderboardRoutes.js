import express from 'express';
import {
  saveLeaderboardSettings,
  getLeaderboardSettings,
  updateLeaderboardEntry,
  getGlobalLeaderboardAPI,
  getUserLeaderboardAPI,
  getUserHistoryAPI
} from '../controllers/leaderboardController.js';

const router = express.Router();

// Admin APIs
router.post('/admin/leaderboard/settings', saveLeaderboardSettings);
router.get('/admin/leaderboard/settings', getLeaderboardSettings);

// User APIs
router.post('/leaderboard/update', updateLeaderboardEntry);
router.get('/leaderboard/global', getGlobalLeaderboardAPI);
router.get('/leaderboard/user/:userId', getUserLeaderboardAPI);
router.get('/leaderboard/history/:userId', getUserHistoryAPI);

export default router;
