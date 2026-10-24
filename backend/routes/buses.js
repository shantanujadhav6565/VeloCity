
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Bus = require("../models/Bus");

// Validate coordinate values
const validateCoordinate = (value, min, max) => {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return true;
  }

  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= min &&
    number <= max
  );
};

// Convert optional coordinate to number or null
const coordinateOrNull = (value) => {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return Number(value);
};

// POST: Add a new bus
router.post("/", async (req, res) => {
  try {
    const {
      busNumber,
      source,
      destination,
      route,
      busImage,
      sourceLatitude,
      sourceLongitude,
      destinationLatitude,
      destinationLongitude,
    } = req.body;

    // Validate required fields
    if (
      typeof busNumber !== "string" ||
      !busNumber.trim() ||
      typeof source !== "string" ||
      !source.trim() ||
      typeof destination !== "string" ||
      !destination.trim() ||
      typeof route !== "string" ||
      !route.trim()
    ) {
      return res.status(400).json({
        message:
          "Bus number, source, destination and route are required.",
      });
    }

    // Validate optional coordinates
    if (
      !validateCoordinate(sourceLatitude, -90, 90) ||
      !validateCoordinate(sourceLongitude, -180, 180) ||
      !validateCoordinate(destinationLatitude, -90, 90) ||
      !validateCoordinate(destinationLongitude, -180, 180)
    ) {
      return res.status(400).json({
        message: "Invalid source or destination coordinates.",
      });
    }

    const normalizedBusNumber = busNumber.trim();

    // Check duplicate bus number
    const existingBus = await Bus.findOne({
      busNumber: normalizedBusNumber,
    });

    if (existingBus) {
      return res.status(409).json({
        message: "This bus number already exists.",
      });
    }

    // Create bus
    const bus = await Bus.create({
      busNumber: normalizedBusNumber,
      source: source.trim(),
      destination: destination.trim(),
      route: route.trim(),
      busImage:
        typeof busImage === "string"
          ? busImage.trim()
          : "",

      sourceLatitude: coordinateOrNull(sourceLatitude),
      sourceLongitude: coordinateOrNull(sourceLongitude),
      destinationLatitude: coordinateOrNull(destinationLatitude),
      destinationLongitude: coordinateOrNull(destinationLongitude),

      tripStatus: "Not Started",
      status: "Stopped",

      latitude: null,
      longitude: null,
      lastLocationUpdate: null,
      locationHistory: [],
    });

    return res.status(201).json({
      message: "Bus added successfully.",
      bus,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This bus number already exists.",
      });
    }

    console.error("Add bus error:", error);

    return res.status(500).json({
      message: "Failed to add bus.",
    });
  }
});

// GET: Get all buses
router.get("/", async (req, res) => {
  try {
    const buses = await Bus.find().lean();

    return res.status(200).json({ buses });
  } catch (error) {
    console.error("Get buses error:", error);

    return res.status(500).json({
      message: "Failed to fetch buses.",
    });
  }
});

// PATCH: Update current GPS location and save location history
router.patch("/:id/location", async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    // Validate bus ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid bus ID.",
      });
    }

    // Validate GPS coordinates
    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude === null ||
      longitude === null ||
      latitude === "" ||
      longitude === ""
    ) {
      return res.status(400).json({
        message: "Latitude and longitude are required.",
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        message: "Invalid latitude or longitude.",
      });
    }

    // Find bus
    const bus = await Bus.findById(id);

    if (!bus) {
      return res.status(404).json({
        message: "Bus not found.",
      });
    }

    const timestamp = new Date();

    // Update current coordinates
    bus.latitude = lat;
    bus.longitude = lng;
    bus.lastLocationUpdate = timestamp;

    // Add GPS point to travelled route history
    const history = bus.locationHistory || [];
    const lastPoint = history[history.length - 1];

    // Avoid duplicate consecutive GPS points
    if (
      !lastPoint ||
      lastPoint.latitude !== lat ||
      lastPoint.longitude !== lng
    ) {
      history.push({
        latitude: lat,
        longitude: lng,
        timestamp,
      });
    }

    // Keep latest 500 history points
    bus.locationHistory = history.slice(-500);

    // Save to MongoDB
    await bus.save();

    return res.status(200).json({
      message: "Bus location updated successfully.",
      bus,
    });
  } catch (error) {
    console.error("Update bus location error:", error);

    return res.status(500).json({
      message: "Failed to update bus location.",
    });
  }
});

// GET: Get a single bus by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid bus ID.",
      });
    }

    const bus = await Bus.findById(id).lean();

    if (!bus) {
      return res.status(404).json({
        message: "Bus not found.",
      });
    }

    return res.status(200).json({ bus });
  } catch (error) {
    console.error("Get bus error:", error);

    return res.status(500).json({
      message: "Failed to fetch bus.",
    });
  }
});

module.exports = router;
