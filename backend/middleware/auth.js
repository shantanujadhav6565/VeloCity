
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

async function authenticate(req, res, next) {
  try {
    // 1. Get token from Authorization header
    const header = req.headers.authorization || "";
    const [scheme, token, ...extraParts] = header.trim().split(/\s+/);

    if (
      scheme !== "Bearer" ||
      !token ||
      extraParts.length > 0
    ) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    // 2. Check JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from environment variables");

      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error",
      });
    }

    // 3. Verify JWT token
    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: "transitpulse-api",
        audience: "transitpulse-client",
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // 4. Validate user ID from token
    if (
      !payload ||
      typeof payload.sub !== "string" ||
      !mongoose.isValidObjectId(payload.sub)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    // 5. Find user in MongoDB
    const user = await User.findById(payload.sub).select(
      "_id phone role driver isActive"
    );
// console.log("AUTH USER:", user?.phone, user?.role);
    // 6. Check user account status
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is unavailable",
      });
    }

    // 7. Attach authenticated user to request
    req.user = user;

    // 8. Continue to the next middleware or route
    return next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    return next(error);
  }
}

module.exports = authenticate;
