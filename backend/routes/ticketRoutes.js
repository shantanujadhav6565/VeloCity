
const express = require("express");
const { randomUUID } = require("node:crypto");

const router = express.Router();

const Ticket = require("../models/Ticket");
const Bus = require("../models/Bus");
const User = require("../models/User");

const authenticate = require("../middleware/auth");
const authorize = require("../middleware/authorize");

// Serialize ticket creation per bus within this Node.js process.
const busIssueQueues = new Map();

async function withBusIssueLock(busId, operation) {
  const previous = busIssueQueues.get(busId) || Promise.resolve();

  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });

  busIssueQueues.set(busId, current);

  await previous;

  try {
    return await operation();
  } finally {
    release();

    if (busIssueQueues.get(busId) === current) {
      busIssueQueues.delete(busId);
    }
  }
}

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Get the logged-in conductor's profile and assigned bus.
async function getConductorAndBus(userId) {
  const user = await User.findById(userId).select("-password");

  if (!user || user.role !== "Conductor" || !user.conductor) {
    throw createError(
      "Conductor account or profile not found. Please verify your conductor profile.",
      404
    );
  }

  const bus = await Bus.findOne({
    assignedConductor: user.conductor,
  });

  if (!bus) {
    throw createError(
      "No bus is assigned to this conductor. Ask the administrator to assign a bus.",
      404
    );
  }

  return { user, bus };
}

// Validate and return route stops in sequence order.
function getSortedStops(bus) {
  const stops = Array.isArray(bus.routeStops)
    ? [...bus.routeStops].sort(
        (a, b) => Number(a.sequence) - Number(b.sequence)
      )
    : [];

  return stops;
}

// Recalculate passengers currently onboard.
async function recalculateCrowd(bus) {
  if (bus.crowdUpdateMode === "manual") {
    return bus.currentPassengerCount || 0;
  }

  const stops = getSortedStops(bus);

  // No configured route: keep the existing crowd count and let
  // the dashboard display the route configuration problem.
  if (stops.length === 0) {
    return bus.currentPassengerCount || 0;
  }

  const currentSequence =
    bus.currentStopSequence ?? stops[0].sequence;

  const tickets = await Ticket.find({
    bus: bus._id,
    status: "Active",
    boardingStopSequence: { $lte: currentSequence },
    destinationStopSequence: { $gt: currentSequence },
  })
    .select("passengerCount")
    .lean();

  const passengerCount = tickets.reduce(
    (total, ticket) => total + Number(ticket.passengerCount || 0),
    0
  );

  bus.currentPassengerCount = Math.min(
    Number(bus.capacity || 0),
    Math.max(0, passengerCount)
  );

  bus.crowdLastUpdated = new Date();

  await bus.save();

  return bus.currentPassengerCount;
}

// Validate capacity at every relevant point along the journey.
async function assertCapacityForTicket(
  bus,
  boardingSequence,
  destinationSequence,
  requestedCount
) {
  if (!Number.isFinite(bus.capacity) || bus.capacity < 1) {
    throw createError("The assigned bus has an invalid capacity.", 409);
  }

  const activeTickets = await Ticket.find({
    bus: bus._id,
    status: "Active",
  })
    .select(
      "boardingStopSequence destinationStopSequence passengerCount"
    )
    .lean();

  const candidateSequences = new Set([boardingSequence]);

  for (const ticket of activeTickets) {
    if (
      ticket.boardingStopSequence >= boardingSequence &&
      ticket.boardingStopSequence < destinationSequence
    ) {
      candidateSequences.add(ticket.boardingStopSequence);
    }

    if (
      ticket.destinationStopSequence >= boardingSequence &&
      ticket.destinationStopSequence < destinationSequence
    ) {
      candidateSequences.add(ticket.destinationStopSequence);
    }
  }

  for (const sequence of candidateSequences) {
    const onboard = activeTickets.reduce((total, ticket) => {
      const isOnboard =
        ticket.boardingStopSequence <= sequence &&
        ticket.destinationStopSequence > sequence;

      return total + (
        isOnboard ? Number(ticket.passengerCount || 0) : 0
      );
    }, 0);

    if (onboard + requestedCount > bus.capacity) {
      throw createError(
        `This ticket would exceed bus capacity (${bus.capacity}) between route stops.`,
        409
      );
    }
  }
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

      if (
        bus.crowdUpdateMode !== "manual" &&
        bus.tripStatus === "In Progress"
      ) {
        await recalculateCrowd(bus);
      }

      return res.json({
        success: true,
        bus,
        routeConfigured: getSortedStops(bus).length >= 2,
        message:
          getSortedStops(bus).length >= 2
            ? "Assigned bus loaded successfully."
            : "Assigned bus has no configured route stops.",
        crowd: {
          passengerCount: bus.currentPassengerCount || 0,
          availableSeats: Math.max(
            0,
            Number(bus.capacity || 0) -
              Number(bus.currentPassengerCount || 0)
          ),
          mode: bus.crowdUpdateMode || "tickets",
        },
      });
    } catch (error) {
      console.error("Get conductor bus error:", error);

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to load assigned bus.",
      });
    }
  }
);

// PATCH /api/tickets/current-stop
router.patch(
  "/current-stop",
  authenticate,
  authorize("Conductor"),
  async (req, res) => {
    try {
      const userId = req.user._id || req.user.id;
      const sequence = req.body?.sequence;

      if (!Number.isInteger(sequence) || sequence < 0) {
        return res.status(400).json({
          success: false,
          message: "A valid route stop sequence is required.",
        });
      }

      const { bus } = await getConductorAndBus(userId);

      if (bus.tripStatus !== "In Progress") {
        return res.status(409).json({
          success: false,
          message: "Start the trip before updating its current stop.",
        });
      }

      const stops = getSortedStops(bus);

      if (stops.length < 2) {
        return res.status(409).json({
          success: false,
          message: "Configure at least two route stops before updating progress.",
        });
      }

      const stop = stops.find(
        (item) => Number(item.sequence) === sequence
      );

      if (!stop) {
        return res.status(400).json({
          success: false,
          message: "Select a stop from the assigned bus route.",
        });
      }

      if (
        bus.currentStopSequence != null &&
        sequence < bus.currentStopSequence
      ) {
        return res.status(409).json({
          success: false,
          message: "The current stop cannot move backwards.",
        });
      }

      bus.currentStopSequence = sequence;
      bus.currentStopName = stop.name;

      await bus.save();

      if (bus.crowdUpdateMode !== "manual") {
        await recalculateCrowd(bus);
      }

      return res.json({
        success: true,
        message: `Current stop updated to ${stop.name}.`,
        bus,
      });
    } catch (error) {
      console.error("Update current stop error:", error);

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to update current stop.",
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
      } = req.body || {};

      if (
        typeof boardingStop !== "string" ||
        !boardingStop.trim() ||
        typeof destinationStop !== "string" ||
        !destinationStop.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Boarding stop and destination stop are required.",
        });
      }

      if (
        typeof passengerCount !== "number" ||
        !Number.isInteger(passengerCount) ||
        passengerCount < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Passenger count must be a positive whole number.",
        });
      }

      const { user, bus } = await getConductorAndBus(userId);

      if (bus.tripStatus !== "In Progress") {
        return res.status(409).json({
          success: false,
          message: "Start the bus trip before issuing tickets.",
        });
      }

      const stops = getSortedStops(bus);

      if (stops.length < 2) {
        return res.status(409).json({
          success: false,
          message: "This bus needs at least two configured route stops.",
        });
      }

      const boarding = stops.find(
        (stop) => stop.name === boardingStop.trim()
      );

      const destination = stops.find(
        (stop) => stop.name === destinationStop.trim()
      );

      if (!boarding || !destination) {
        return res.status(400).json({
          success: false,
          message: "Select stops from this bus's configured route.",
        });
      }

      if (
        bus.currentStopSequence != null &&
        boarding.sequence < bus.currentStopSequence
      ) {
        return res.status(400).json({
          success: false,
          message: "Boarding stop cannot be behind the bus's current stop.",
        });
      }

      if (destination.sequence <= boarding.sequence) {
        return res.status(400).json({
          success: false,
          message: "Destination must come after the boarding stop.",
        });
      }

      const { ticket, passengerTotal } = await withBusIssueLock(
        bus._id.toString(),
        async () => {
          await assertCapacityForTicket(
            bus,
            boarding.sequence,
            destination.sequence,
            passengerCount
          );

          const createdTicket = await Ticket.create({
            ticketNumber: `VC-${randomUUID()
              .slice(0, 12)
              .toUpperCase()}`,
            bus: bus._id,
            conductor: user._id,
            boardingStop: boarding.name,
            boardingStopSequence: boarding.sequence,
            destinationStop: destination.name,
            destinationStopSequence: destination.sequence,
            passengerCount,
            status: "Active",
          });

          const total = await recalculateCrowd(bus);

          return {
            ticket: createdTicket,
            passengerTotal: total,
          };
        }
      );

      return res.status(201).json({
        success: true,
        message: "Ticket issued successfully.",
        ticket,
        crowd: {
          passengerCount: passengerTotal,
          availableSeats: Math.max(
            0,
            bus.capacity - passengerTotal
          ),
          mode: bus.crowdUpdateMode || "tickets",
        },
      });
    } catch (error) {
      console.error("Issue ticket error:", error);

      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to issue ticket.",
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
        message: error.message || "Failed to load ticket history.",
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
      const { passengerCount, reason } = req.body || {};

      if (
        !Number.isInteger(passengerCount) ||
        passengerCount < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Passenger count must be a non-negative whole number.",
        });
      }

      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          message: "Please provide a reason for the crowd correction.",
        });
      }

      if (String(reason).trim().length > 300) {
        return res.status(400).json({
          success: false,
          message: "Reason cannot exceed 300 characters.",
        });
      }

      const { bus } = await getConductorAndBus(userId);

      if (bus.tripStatus !== "In Progress") {
        return res.status(409).json({
          success: false,
          message: "Crowd correction is available only during an active trip.",
        });
      }

      if (passengerCount > bus.capacity) {
        return res.status(400).json({
          success: false,
          message: `Passenger count cannot exceed bus capacity (${bus.capacity}).`,
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
        message: "Crowd count corrected manually.",
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
        message: error.message || "Failed to update crowd count.",
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

      if (bus.tripStatus !== "In Progress") {
        return res.status(409).json({
          success: false,
          message: "Ticket-based crowd calculation can be resumed only during an active trip.",
        });
      }

      if (getSortedStops(bus).length === 0) {
        return res.status(409).json({
          success: false,
          message: "Configure the bus route stops before resuming ticket-based crowd calculation.",
        });
      }

      bus.crowdUpdateMode = "tickets";
      await bus.save();

      const passengerTotal = await recalculateCrowd(bus);

      return res.json({
        success: true,
        message: "Crowd count is now calculated from active tickets.",
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
        message: error.message || "Failed to resume ticket calculation.",
      });
    }
  }
);

module.exports = router;
