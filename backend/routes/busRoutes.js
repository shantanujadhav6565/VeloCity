
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Bus = require("../models/Bus");

// GET: Get all buses
router.get("/", async (req, res) => {
  try {
    const buses = await Bus.find().lean();
    res.status(200).json({ buses });
  } catch (error) {
    console.error("Fetch buses error:", error.message);
    res.status(500).json({ message: "Failed to fetch buses" });
  }
});

// GET: Get one bus by ID
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid bus ID" });
    }

    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    res.status(200).json({ bus });
  } catch (error) {
    console.error("Fetch bus error:", error.message);
    res.status(500).json({ message: "Failed to fetch bus" });
  }
});

/* PATCH: Update current GPS location and save GPS history */
router.patch("/:id/location", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid bus ID" });
    }

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        message: "Valid latitude and longitude are required",
      });
    }

    const now = new Date();

    const bus = await Bus.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          latitude,
          longitude,
          lastLocationUpdate: now,
        },
        $push: {
          locationHistory: {
            latitude,
            longitude,
            timestamp: now,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    res.status(200).json({
      message: "Bus GPS location and history updated",
      bus,
    });
  } catch (error) {
    console.error("Update bus location error:", error.message);
    res.status(500).json({
      message: "Failed to update bus location",
    });
  }
});


module.exports = router;
