import LeaderboardSettings from '../models/LeaderboardSettings.js';
import Leaderboard from '../models/Leaderboard.js';
import LeaderboardHistory from '../models/LeaderboardHistory.js';
import User from '../models/user.js';

export async function getLatestSettings() {
  return await LeaderboardSettings.findOne().sort({ updatedAt: -1 });
}

export function getLevelFromXP(levelRanks, xp) {
  for (const rank of levelRanks) {
    if (xp >= rank.minXP && xp <= rank.maxXP) {
      return rank.levelName;
    }
  }
  return levelRanks.length ? levelRanks[levelRanks.length - 1].levelName : 'Unranked';
}

export async function updateLeaderboard({ userId, action, referenceType, referenceId, remark }) {
  const settings = await getLatestSettings();
  if (!settings) throw new Error('Leaderboard settings not configured');
  const xpChange = settings.actionXP.get(action) || 0;
  let leaderboard = await Leaderboard.findOne({ userId });
  if (!leaderboard) {
    leaderboard = new Leaderboard({ userId, xp: 0 });
  }
  leaderboard.xp += xpChange;
  leaderboard.level = getLevelFromXP(settings.levelRanks, leaderboard.xp);
  leaderboard.lastUpdated = new Date();
  await leaderboard.save();

  await LeaderboardHistory.create({
    userId,
    referenceType,
    referenceId,
    action,
    remark,
    xpChange,
    totalXP: leaderboard.xp
  });

  return leaderboard;
}

export async function getGlobalLeaderboard(limit = 50) {
  return await Leaderboard.find()
    .sort({ xp: -1 })
    .limit(limit)
    .populate('userId', 'name fullName profilePicture email');
}

export async function getUserLeaderboard(userId) {
  const entry = await Leaderboard.findOne({ userId }).populate('userId', 'name fullName profilePicture  email');
  if (!entry) return null;
  const higherXPCount = await Leaderboard.countDocuments({ xp: { $gt: entry.xp } });
  return { ...entry.toObject(), rank: higherXPCount + 1 };
}

export async function getUserHistory(userId, limit = 100) {
  return await LeaderboardHistory.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
}

export async function createInitialLeaderboardEntry(userId, initialXP = 10) {
  const settings = await getLatestSettings();
  if (!settings) throw new Error('Leaderboard settings not configured');
  
  const leaderboard = new Leaderboard({ 
    userId, 
    xp: initialXP,
    level: getLevelFromXP(settings.levelRanks, initialXP),
    lastUpdated: new Date()
  });
  
  await leaderboard.save();
  
  // Create history entry for initial XP
  await LeaderboardHistory.create({
    userId,
    referenceType: 'system',
    referenceId: null,
    action: 'initial_signup',
    remark: 'Initial leaderboard entry',
    xpChange: initialXP,
    totalXP: initialXP
  });
  
  // Return entry with rank calculation
  const populatedEntry = await Leaderboard.findOne({ userId }).populate('userId', 'name fullName profilePicture email');
  const higherXPCount = await Leaderboard.countDocuments({ xp: { $gt: populatedEntry.xp } });
  return { ...populatedEntry.toObject(), rank: higherXPCount + 1 };
}

