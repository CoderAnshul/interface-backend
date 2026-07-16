import JWT from "passport-jwt";
import User from "../models/user.js";
import passport from "passport";
import { ServerConfig } from "./server.config.js";

const JwtStrategy = JWT.Strategy;
const ExtractJwt = JWT.ExtractJwt;

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: ServerConfig.JWT_ACCESS_SECRET,
};

// Use a placeholder secret if JWT_ACCESS_SECRET is not set (auth will fail but app won't crash)
const secretOrKey = ServerConfig.JWT_ACCESS_SECRET || "placeholder-secret-key-change-in-production";

if (!ServerConfig.JWT_ACCESS_SECRET) {
  console.warn("⚠️  WARNING: JWT_ACCESS_TOKEN_SECRET_KEY is not set. JWT authentication will not work properly.");
  console.warn("⚠️  Please set JWT_ACCESS_TOKEN_SECRET_KEY in your .env file.");
}

passport.use(
  "jwt", // Explicitly name the strategy
  new JwtStrategy({ ...opts, secretOrKey }, async function (jwt_payload, done) {
    if (!ServerConfig.JWT_ACCESS_SECRET) {
      return done(new Error("JWT authentication is not configured. Please set JWT_ACCESS_TOKEN_SECRET_KEY in your environment variables."), false);
    }
    try {
      // Fixed the syntax error here - removed invalid asterisks
      const user = await User.findOne({ _id: jwt_payload._id }).select("-password");
      if (user) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    } catch (error) {
      console.error("JWT Strategy Error:", error);
      return done(error, false);
    }
  })
);

export default passport;