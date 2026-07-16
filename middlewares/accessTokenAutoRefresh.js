import { Token } from "../utils/index.js";

const accessTokenAutoRefresh = async (req, res, next) => {
  try {
    // Read access token from cookies or custom header `X-Access-Token`
    let accessToken = req.cookies.accessToken || req.headers["x-access-token"];

    // Handle JSON parsing for headers if needed
    if (typeof accessToken === "string" && accessToken.startsWith("{")) {
      try {
        accessToken = JSON.parse(accessToken);
      } catch (e) {
        // If parsing fails, use the string as is
      }
    }

    // //console.log("Access Token:", accessToken);

    // Check if access token is blacklisted before proceeding
    if (accessToken) {
      const isBlacklisted = await Token.isAccessTokenBlacklisted(accessToken);
    
      if (isBlacklisted) {
        return res.status(401).json({
          error: "Unauthorized",
          isNewDeviceLogin: true,
          message: "Session expired. Please log in again.",
        });
      }
    }

    // If access token exists and is not blacklisted, set it in the Authorization header
    if (accessToken) {
      req.headers["authorization"] = `Bearer ${accessToken}`;
      return next();
    }

    // If access token is missing or blacklisted, try to refresh it
    if (!accessToken) {
      // Read refresh token from cookies or custom header `X-Refresh-Token`
      let refreshToken =
        req.cookies.refreshToken || req.headers["x-refresh-token"];

      // Handle JSON parsing for headers if needed
      if (typeof refreshToken === "string" && refreshToken.startsWith("{")) {
        try {
          refreshToken = JSON.parse(refreshToken);
        } catch (e) {
          // If parsing fails, use the string as is
        }
      }

      if (!refreshToken) {
        // If refresh token is also missing, return an unauthorized response
        return res.status(401).json({
          error: "Unauthorized",
          message: "Access and refresh tokens are missing or invalid",
        });
      }

      try {
        // Blacklist old access token if present
        if (accessToken) {
          // Decode to get expiration
          const jwt = require("jsonwebtoken");
          const decodedUser = jwt.decode(accessToken);
          const exp = decodedUser?.exp ? decodedUser.exp * 1000 : Date.now();
          // 🔹 While refreshing, do not blacklist old access token if user is admin
          if (
            !(decodedUser?.role === "admin" || decodedUser?.roles?.includes("admin"))
          ) {
            await Token.generateTokens(decodedUser, accessToken, exp);
          }
        }

        // Refresh the access token using the refresh token
        const tokenData = await Token.refreshAccessToken(req, res);

        if (!tokenData) {
          return res.status(401).json({
            error: "Unauthorized",
            message: "Failed to refresh access token",
          });
        }

        const {
          newAccessToken,
          newRefreshToken,
          newAccessTokenExp,
          newRefreshTokenExp,
        } = tokenData;

        // Set the new access and refresh tokens as HTTP-only cookies
        Token.setTokensCookies(
          res,
          newAccessToken,
          newRefreshToken,
          newAccessTokenExp,
          newRefreshTokenExp
        );

        // Set the new access token in the Authorization header
        req.headers["authorization"] = `Bearer ${newAccessToken}`;

        return next(); // Proceed to the next middleware
      } catch (refreshError) {
        console.error("Error during token refresh:", refreshError);
        return res.status(401).json({
          error: "Unauthorized",
          message: "Failed to refresh access token or token is invalid",
        });
      }
    }
  } catch (error) {
    // Log error and send a response if something goes wrong
    console.error("Error in accessTokenAutoRefresh:", error);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication error",
    });
  }
};

export default accessTokenAutoRefresh;
