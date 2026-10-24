
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Ticket = require("../models/Ticket");
const Bus = require("../models/Bus");
const User = require("../models/User");

const authenticate = require("../middleware/auth");
const authorize = require("../middleware/authorize");

// Get the logged-in conductor's profile and assigned bus.
async function getConductorAndBus(userId) {
  const user = await User.findById(userId).select("-password");

  if (!user || user.role !== "Conductor" || !user.conductor) {
    const error = new Error("Conductor account or profile not found");
    error.status = 404;
    throw error;
  }

  const bus = await Bus.findOne({
    assignedConductor: user.conductor,
  });

  if (!bus) {
    const error = new Error("No bus is assigned to this conductor");
    error.status = 404;
    throw error;
  }

  return { user, bus };
}

// Recalculate passengers onboard at the bus's current stop.
async function recalculateCrowd(bus) {
  if (bus.crowdUpdateMode === "manual") {
    return bus.currentPassengerCount;
  }

  const stops = [...(bus.routeStops || [])].sort(
    (a, b) => a.sequence - b.sequence
  );

  if (!stops.length) {
    throw new Error("Bus route stops are not configured");
  }

  const currentSequence =
    bus.currentStopSequence ?? stops[0].sequence;

  const tickets = await Ticket.find({
    bus: bus._id,
    status: "Active",
    boardingStopSequence: { $lte: currentSequence },
    destinationStopSequence: { $gt: currentSequence },
  }).select("passengerCount");

  const passengerCount = tickets.reduce(
    (total, ticket) => total + ticket.passengerCount,
    0
  );

  bus.currentPassengerCount = passengerCount;
  bus.crowdLastUpdated = new Date();

  await bus.save();

  return passengerCount;
}

// GET /api/tickets/my-bus
router.get(
  "/my-bus",
  authenticate,
  authorize("Conductor"),
  async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const { bus } = await getConductorAndBus(userId);

      return res.json({
        success: true,
        bus,
        crowd: {
          passengerCount: bus.currentPassengerCount,
          availableSeats: Math.max(
            0,
            bus.capacity - bus.currentPassengerCount
          ),
          mode: bus.crowdUpdateMode || "tickets",
        },
      });
    } catch (error) {
      console.error("Get conductor bus error:", error);

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to load assigned bus",
      });
    }
  }
);

// POST /api/tickets/issue
router.post(
  "/issue",
  authenticate,
  authorize("Conductor"),
  async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;

      const {
        boardingStop,
        destinationStop,
        passengerCount = 1,
      } = req.body;

      if (!boardingStop || !destinationStop) {
        return res.status(400).json({
          success: false,
          message: "Boarding stop and destination stop are required",
        });
      }

      if (
        !Number.isInteger(Number(passengerCount)) ||
        Number(passengerCount) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Passenger count must be a positive whole number",
        });
      }

      const { user, bus } = await getConductorAndBus(userId);

      if (bus.tripStatus !== "In Progress") {
        return res.status(400).json({
          success: false,
          message: "Start the bus trip before issuing tickets",
        });
      }

      const stops = [...(bus.routeStops || [])].sort(
        (a, b) => a.sequence - b.sequence
      );

      const boarding = stops.find(
        (stop) => stop.name === boardingStop
      );

      const destination = stops.find(
        (stop) => stop.name === destinationStop
      );

      if (!boarding || !destination) {
        return res.status(400).json({
          success: false,
          message: "Select stops from this bus's configured route",
        });
      }

      if (destination.sequence <= boarding.sequence) {
        return res.status(400).json({
          success: false,
          message: "Destination must come after the boarding stop",
        });
      }

      const ticket = await Ticket.create({
        ticketNumber:
          `VC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        bus: bus._id,
        conductor: user._id,
        boardingStop: boarding.name,
        boardingStopSequence: boarding.sequence,
        destinationStop: destination.name,
        destinationStopSequence: destination.sequence,
        passengerCount: Number(passengerCount),
        status: "Active",
      });

      const passengerTotal = await recalculateCrowd(bus);

      return res.status(201).json({
        success: true,
        message: "Ticket issued successfully",
        ticket,
        crowd: {
          passengerCount: passengerTotal,
          availableSeats: Math.max(0, bus.capacity - passengerTotal),
          mode: bus.crowdUpdateMode || "tickets",
        },
      });
    } catch (error) {
      console.error("Issue ticket error:", error);

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to issue ticket",
      });
    }
  }
);

// GET /api/tickets/history
router.get(
  "/history",
  authenticate,
  authorize("Conductor"),
  async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const { bus, user } = await getConductorAndBus(userId);

      const tickets = await Ticket.find({
        bus: bus._id,
        conductor: user._id,
      }).sort({ issuedAt: -1 });

      return res.json({
        success: true,
        count: tickets.length,
        tickets,
      });
    } catch (error) {
      console.error("Ticket history error:", error);

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to load ticket history",
      });
    }
  }
);

// PATCH /api/tickets/crowd/manual
router.patch(
  "/crowd/manual",
  authenticate,
  authorize("Conductor"),
  async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const { passengerCount, reason } = req.body;

      if (
        !Number.isInteger(passengerCount) ||
        passengerCount < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Passenger count must be a non-negative whole number",
        });
      }

      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          message: "Please provide a reason for the crowd correction",
        });
      }

      const { bus } = await getConductorAndBus(userId);

      if (passengerCount > bus.capacity) {
        return res.status(400).json({
          success: false,
          message: `Passenger count cannot exceed bus capacity (${bus.capacity})`,
        });
      }

      bus.crowdUpdateMode = "manual";
      bus.currentPassengerCount = passengerCount;
      bus.crowdLastUpdated = new Date();
      bus.manualCrowdUpdate = {
        passengerCount,
        reason: String(reason).trim(),
        updatedBy: userId,
        updatedAt: new Date(),
      };

      await bus.save();

      return res.json({
        success: true,
        message: "Crowd count corrected manually",
        crowd: {
          passengerCount: bus.currentPassengerCount,
          availableSeats: Math.max(
            0,
            bus.capacity - bus.currentPassengerCount
          ),
          mode: bus.crowdUpdateMode,
          manualUpdate: bus.manualCrowdUpdate,
        },
      });
    } catch (error) {
      console.error("Manual crowd update error:", error);

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to update crowd count",
      });
    }
  }
);

// PATCH /api/tickets/crowd/resume-tickets
router.patch(
  "/crowd/resume-tickets",
  authenticate,
  authorize("Conductor"),
  async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const { bus } = await getConductorAndBus(userId);

      bus.crowdUpdateMode = "tickets";
      await bus.save();

      const passengerTotal = await recalculateCrowd(bus);

      return res.json({
        success: true,
        message: "Crowd count is now calculated from active tickets",
        crowd: {
          passengerCount: passengerTotal,
          availableSeats: Math.max(
            0,
            bus.capacity - passengerTotal
          ),
          mode: bus.crowdUpdateMode,
        },
      });
    } catch (error) {
      console.error("Resume ticket crowd calculation error:", error);

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to resume ticket calculation",
      });
    }
  }
);

module.exports = router;
