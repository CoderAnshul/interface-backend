import jwt from "jsonwebtoken";
import UserRefreshToken from "../../models/UserRefreshToken.js";
import { ServerConfig } from "../../config/server.config.js";
import { initRedis } from "../../config/redisClient.js";

let redisInstance = null;
const getRedis = async () => {
  try {
    if (!redisInstance) redisInstance = await initRedis();
    return redisInstance;
  } catch (err) {
    console.warn("[REDIS] Redis unavailable, using in-memory fallback");
    return null;
  }
};

// In-memory fallback stores
const memoryBlacklist = new Map();
const memoryUserTokens = new Map();

const ACCESS_TOKEN_BLACKLIST_PREFIX = "accessToken:blacklist:";
const USER_ACCESS_TOKENS_PREFIX = "user:accessTokens:";

// Store issued access token for user in Redis or fallback
const storeAccessTokenForUser = async (userId, token, exp) => {
  const redis = await getRedis();
  if (redis) {
    // Store token with expiration as score in a sorted set
    await redis.zAdd(`${USER_ACCESS_TOKENS_PREFIX}${userId}`, [{ score: exp, value: token }]);
  } else {
    if (!memoryUserTokens.has(userId)) memoryUserTokens.set(userId, []);
    memoryUserTokens.get(userId).push({ token, exp });
  }
};

// Get all active access tokens for user from Redis or fallback
const getAllAccessTokensForUser = async (userId) => {
  const redis = await getRedis();
  if (redis) {
    // Get all tokens with expiration > now
    const now = Date.now();
    return await redis.zRangeByScore(`${USER_ACCESS_TOKENS_PREFIX}${userId}`, now, '+inf');
  } else {
    const now = Date.now();
    return (memoryUserTokens.get(userId) || [])
      .filter(t => t.exp > now)
      .map(t => t.token);
  }
};

// Remove expired tokens from user's set
const cleanupExpiredAccessTokensForUser = async (userId) => {
  const redis = await getRedis();
  if (redis) {
    const now = Date.now();
    await redis.zRemRangeByScore(`${USER_ACCESS_TOKENS_PREFIX}${userId}`, '-inf', now);
  } else {
    if (memoryUserTokens.has(userId)) {
      const now = Date.now();
      memoryUserTokens.set(userId, memoryUserTokens.get(userId).filter(t => t.exp > now));
    }
  }
};

const blacklistAccessToken = async (token, exp) => {
  const redis = await getRedis();
  // Set blacklist with TTL equal to token's remaining lifetime
  const ttl = Math.floor((exp - Date.now()) / 1000);
  if (ttl > 0) {
    if (redis) {
      await redis.setEx(`${ACCESS_TOKEN_BLACKLIST_PREFIX}${token}`, ttl, "1");
    } else {
      memoryBlacklist.set(token, Date.now() + ttl * 1000);
    }
    //console.log(`[BLACKLIST] Token ${token.substring(0, 12)}... set for ${ttl}s`);
  } else {
    //console.log(`[BLACKLIST] Token ${token.substring(0, 12)}... not set (expired)`);
  }
};

const isAccessTokenBlacklisted = async (token, user) => {
  // 🔹 Admin bypass: If user is admin, do not check blacklist
  if (user?.role === "admin" || user?.roles?.includes("admin")) return false;

  const redis = await getRedis();
  if (redis) {
    const result = await redis.get(`${ACCESS_TOKEN_BLACKLIST_PREFIX}${token}`);
    return result === "1";
  } else {
    const expiry = memoryBlacklist.get(token);
    return expiry && expiry > Date.now();
  }
};

const getTokenExp = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded?.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

const generateTokens = async (user, oldAccessToken = null, oldAccessTokenExp = null) => {
  try {
    //console.log('🔹 Generating tokens for user1:', user);
    const payload = { _id: user._id, roles: user.role };
    const accessSecret = process.env.JWT_ACCESS_TOKEN_SECRET_KEY || ServerConfig.JWT_ACCESS_SECRET || "access_token_secret_placeholder";
    const refreshSecret = process.env.JWT_REFRESH_TOKEN_SECRET_KEY || "refresh_token_secret_placeholder";

    const accessToken = jwt.sign(payload, accessSecret);
    const refreshToken = jwt.sign(payload, refreshSecret);

    //console.log('🔄 Generated new tokens for user:', user._id);
    //console.log('🍪 Setting cookies with maxAge values:', { 
    //   accessTokenMaxAge: Math.floor(accessTokenTTL / 1000), 
    //   refreshTokenMaxAge: Math.floor(refreshTokenTTL / 1000) 
    // });

    // Delete ALL existing refresh tokens for this user (cleanup)
    await UserRefreshToken.deleteMany({ userId: user._id });

    // Save new refresh token (no expiry)
    const newRefreshToken = new UserRefreshToken({
      userId: user._id,
      token: refreshToken,
      expiresAt: null // No expiry
    });
    await newRefreshToken.save();

    // Blacklist previous tokens (if not admin)
    if (!(user?.role === "admin" || user?.roles?.includes("admin"))) {
      await cleanupExpiredAccessTokensForUser(user._id);
      const previousTokens = await getAllAccessTokensForUser(user._id);
      for (const prevToken of previousTokens) {
        await blacklistAccessToken(prevToken, Date.now() + 1000 * 60 * 60 * 24 * 365 * 10); // Arbitrary far future
      }
    }

    // Store new access token for user in Redis (no expiry)
    await storeAccessTokenForUser(user._id, accessToken, Date.now() + 1000 * 60 * 60 * 24 * 365 * 10);

    return { accessToken, refreshToken };
  } catch (error) {
    console.error('❌ Error in generateTokens:', error);
    throw new Error(`Token generation failed: ${error.message}`);
  }
};

const generateTokenForResetPassword = async (user) => {
  try {
    const payload = { _id: user._id, roles: user.role };
    const secret = ServerConfig.JWT_EMAIL_RESET_SECRET;
    const token = jwt.sign({ userID: user._id }, secret, { expiresIn: "15m" });
    return token;
  } catch (error) {
    console.error('❌ Error in generateTokenForResetPassword:', error);
    throw new Error(`Reset token generation failed: ${error.message}`);
  }
};

export { generateTokens, generateTokenForResetPassword, isAccessTokenBlacklisted, blacklistAccessToken, cleanupExpiredAccessTokensForUser, getAllAccessTokensForUser };

// Only refresh tokens are stored and managed for session control.
// Access tokens are stateless and cannot be forcibly invalidated unless you implement a blacklist.
// Use isAccessTokenBlacklisted(token) in your auth middleware to reject blacklisted tokens.