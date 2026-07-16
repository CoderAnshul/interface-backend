import mongoose from 'mongoose';

const LeaderboardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  xp: { type: Number, default: 0 },
  level: { type: String },
  lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model('Leaderboard', LeaderboardSchema);
