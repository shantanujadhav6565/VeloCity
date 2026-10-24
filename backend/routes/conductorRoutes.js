const express = require("express");
const router = express.Router();

const User = require("../models/User");
const authenticate = require("../middleware/auth");
const authorize = require("../middleware/authorize");

// GET /api/conductors/me
router.get(
  "/me",
  authenticate,
  authorize("Conductor"),
  async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;

      const user = await User.findById(userId)
        .select("-password")
        .populate("conductor");

      if (!user || user.role !== "Conductor") {
        return res.status(404).json({
          success: false,
          message: "Conductor user not found",
        });
      }

      if (!user.conductor) {
        return res.status(404).json({
          success: false,
          message: "No conductor profile is linked to this account",
        });
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user._id,
          firstName: user.firstName,
          phone: user.phone,
          role: user.role,
        },
        conductor: user.conductor,
      });
    } catch (error) {
      console.error("Get conductor profile error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load conductor profile",
      });
    }
  }
);

module.exports = router;