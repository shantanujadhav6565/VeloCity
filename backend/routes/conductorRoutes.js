
const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Conductor = require("../models/Conductor");
const authenticate = require("../middleware/auth");
const authorize = require("../middleware/authorize");

// ==================================================
// GET ALL CONDUCTORS — ADMIN
// GET /api/conductors
// ==================================================

router.get(
  "/",
  authenticate,
  authorize("Admin"),
  async (req, res) => {
    try {
      const conductors = await Conductor.find()
        .sort({ createdAt: -1 })
        .lean();

      // Only return conductors linked to approved, active accounts.
      const approvedUsers = await User.find({
        role: "Conductor",
        approvalStatus: "Approved",
        isActive: true,
      })
        .select("conductor")
        .lean();

      const approvedConductorIds = new Set(
        approvedUsers
          .filter((user) => user.conductor)
          .map((user) => user.conductor.toString())
      );

      const availableConductors = conductors.filter(
        (conductor) =>
          approvedConductorIds.has(conductor._id.toString()) &&
          conductor.status !== "Inactive"
      );

      return res.status(200).json({
        success: true,
        count: availableConductors.length,
        conductors: availableConductors,
      });
    } catch (error) {
      console.error("Fetch conductors error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch conductors",
      });
    }
  }
);

// ==================================================
// GET LOGGED-IN CONDUCTOR PROFILE
// GET /api/conductors/me
// ==================================================

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
      console.error("Get conductor profile error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to load conductor profile",
      });
    }
  }
);

module.exports = router;
