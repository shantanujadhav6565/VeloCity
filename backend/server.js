
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const Bus = require("./models/Bus");
const Driver = require("./models/Driver");
const Conductor = require("./models/Conductor");
const User = require("./models/User");
const Ticket = require("./models/Ticket");
const authRoutes = require("./routes/authRoutes");
const driverRoutes = require("./routes/driverRoutes");
const passengerTripRoute = require("./routes/passengerTripRoute");
const conductorRoutes = require("./routes/conductorRoutes");
const ticketRoutes = require("./routes/ticketRoutes");

const authenticate = require("./middleware/auth");
const authorize = require("./middleware/authorize");

const app = express();
const PORT = process.env.PORT || 5000;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function syncConductorAvailability(conductorId, session) {
  if (!conductorId) return null;

  const conductor = await Conductor.findById(conductorId).session(session);
  if (!conductor || conductor.status === "Inactive") return conductor?.status || null;

  const assignment = await Bus.exists({ assignedConductor: conductorId }).session(session);
  conductor.status = assignment ? "On Duty" : "Available";
  await conductor.save({ session });
  return conductor.status;
}

async function syncDriverAvailability(driverId, session) {
  if (!driverId) return null;

  const driver = await Driver.findById(driverId).session(session);
  if (!driver || driver.status === "Inactive") return driver?.status || null;

  const assignment = await Bus.exists({ assignedDriver: driverId }).session(session);
  driver.status = assignment ? "On Duty" : "Available";
  await driver.save({ session });
  return driver.status;
}

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ==================================================
// AUTHENTICATION AND OTHER ROUTES
// ==================================================

app.use("/api/auth", authRoutes);

app.use("/api/passenger-trips", passengerTripRoute);

app.use("/api/conductors", conductorRoutes);

// Ticket routes.
// The ticketRoutes file must export an Express router.
app.use("/api/tickets", ticketRoutes);

// ADMIN: DRIVER MANAGEMENT ROUTES
app.use(
  "/api/drivers",
  authenticate,
  authorize("Admin"),
  driverRoutes
);

// ==================================================
// HOME ROUTE
// ==================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to VeloCity API",
    status: "Backend is running",
  });
});

// ==================================================
// GET ALL BUSES
// ==================================================

app.get("/api/buses", async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate("assignedDriver", "driverCode name status")
      .populate("assignedConductor", "conductorCode name status")
      .sort({ createdAt: -1 });

    await Promise.all(buses.map(async (bus) => {
      if (bus.tripStatus !== "In Progress" || bus.crowdUpdateMode === "manual") return;
      const stops = [...(bus.routeStops || [])].sort((a, b) => a.sequence - b.sequence);
      if (!stops.length) return;
      const sequence = bus.currentStopSequence ?? stops[0].sequence;
      const tickets = await Ticket.find({ bus: bus._id, status: "Active", boardingStopSequence: { $lte: sequence }, destinationStopSequence: { $gt: sequence } }).select("passengerCount").lean();
      bus.currentPassengerCount = Math.min(bus.capacity, tickets.reduce((sum, ticket) => sum + ticket.passengerCount, 0));
    }));

    res.status(200).json({
      success: true,
      count: buses.length,
      buses,
    });
  } catch (error) {
    console.error("Fetch buses error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch buses",
    });
  }
});

// ==================================================
// GET BUS BY ID
// ==================================================

app.get("/api/buses/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID",
      });
    }

    const bus = await Bus.findById(id)
      .populate("assignedDriver", "driverCode name status")
      .populate("assignedConductor", "conductorCode name status");

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
      });
    }

    if (bus.tripStatus === "In Progress" && bus.crowdUpdateMode !== "manual" && bus.routeStops.length) {
      const sequence = bus.currentStopSequence ?? [...bus.routeStops].sort((a, b) => a.sequence - b.sequence)[0].sequence;
      const tickets = await Ticket.find({ bus: bus._id, status: "Active", boardingStopSequence: { $lte: sequence }, destinationStopSequence: { $gt: sequence } }).select("passengerCount").lean();
      bus.currentPassengerCount = Math.min(bus.capacity, tickets.reduce((sum, ticket) => sum + ticket.passengerCount, 0));
    }

    res.status(200).json({
      success: true,
      bus,
    });
  } catch (error) {
    console.error("Fetch bus error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch bus",
    });
  }
});

// ==================================================
// ADMIN: ADD BUS
// ==================================================

app.post(
  "/api/buses",
  authenticate,
  authorize("Admin"),
  async (req, res) => {
    try {
      const {
        busNumber,
        source,
        destination,
        route,
        sourceLatitude,
        sourceLongitude,
        destinationLatitude,
        destinationLongitude,
        busImage,
      } = req.body;

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
          success: false,
          message:
            "busNumber, source, destination and route are required",
        });
      }

      const bus = await Bus.create({
        busNumber: busNumber.trim(),
        source: source.trim(),
        destination: destination.trim(),
        route: route.trim(),
        status: "Stopped",
        tripStatus: "Not Started",
        sourceLatitude: sourceLatitude ?? null,
        sourceLongitude: sourceLongitude ?? null,
        destinationLatitude: destinationLatitude ?? null,
        destinationLongitude: destinationLongitude ?? null,
        latitude: null,
        longitude: null,
        busImage: typeof busImage === "string" ? busImage : "",
      });

      res.status(201).json({
        success: true,
        message: "Bus added successfully",
        bus,
      });
    } catch (error) {
      console.error("Add bus error:", error.message);

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "This bus number already exists",
        });
      }

      res.status(400).json({
        success: false,
        message: "Failed to add bus",
      });
    }
  }
);

// ==================================================
// ADMIN: UPDATE BUS DETAILS
// ==================================================

app.put(
  "/api/buses/:id",
  authenticate,
  authorize("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bus ID",
        });
      }

      const details = { ...req.body };

      [
        "_id",
        "__v",
        "assignedDriver",
        "assignedConductor",
        "tripStatus",
        "tripStartedAt",
        "tripEndedAt",
        "tripHistory",
        "status",
        "latitude",
        "longitude",
        "lastLocationUpdate",
        "locationHistory",
        "currentPassengerCount",
        "crowdLastUpdated",
        "crowdUpdateMode",
        "manualCrowdUpdate",
        "currentStopSequence",
        "currentStopName",
      ].forEach((field) => delete details[field]);

      const bus = await Bus.findByIdAndUpdate(id, details, {
        new: true,
        runValidators: true,
      }).populate("assignedDriver", "driverCode name status");

      if (!bus) {
        return res.status(404).json({
          success: false,
          message: "Bus not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Bus updated successfully",
        bus,
      });
    } catch (error) {
      console.error("Update bus error:", error.message);

      res.status(400).json({
        success: false,
        message: "Failed to update bus",
      });
    }
  }
);

// ==================================================
// ADMIN: ASSIGN DRIVER TO BUS
// ==================================================

app.patch(
  "/api/buses/:id/assign-driver",
  authenticate,
  authorize("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { driverId } = req.body;

      if (
        !mongoose.isValidObjectId(id) ||
        !mongoose.isValidObjectId(driverId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid bus ID and driverId are required",
        });
      }

      const bus = await Bus.findById(id);

      if (!bus) {
        return res.status(404).json({
          success: false,
          message: "Bus not found",
        });
      }

      if (bus.tripStatus === "In Progress") {
        return res.status(409).json({
          success: false,
          message: "Cannot change driver during an active trip",
        });
      }

      const driver = await Driver.findById(driverId);

      if (!driver || driver.status === "Inactive") {
        return res.status(404).json({
          success: false,
          message: "Active driver not found",
        });
      }

      const existingBus = await Bus.findOne({
        assignedDriver: driver._id,
        _id: { $ne: bus._id },
      });

      if (existingBus) {
        return res.status(409).json({
          success: false,
          message: "This driver is already assigned to another bus",
        });
      }

      if (
        bus.assignedDriver &&
        bus.assignedDriver.toString() !== driver._id.toString()
      ) {
        await Driver.findByIdAndUpdate(bus.assignedDriver, {
          status: "Available",
        });
      }

      bus.assignedDriver = driver._id;
      bus.tripStatus = "Not Started";
      bus.tripStartedAt = null;
      bus.tripEndedAt = null;

      await bus.save();

      driver.status = "On Duty";
      await driver.save();

      const updatedBus = await Bus.findById(bus._id).populate(
        "assignedDriver",
        "driverCode name status"
      );

      res.status(200).json({
        success: true,
        message: "Driver assigned successfully",
        bus: updatedBus,
      });
    } catch (error) {
      console.error("Assign driver error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to assign driver",
      });
    }
  }
);

// ADMIN: assign or replace an approved, available Conductor for a bus.
app.patch(
  "/api/buses/:id/assign-conductor",
  authenticate,
  authorize("Admin"),
  async (req, res) => {
    const { id } = req.params;
    const conductorId = req.body?.conductorId;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(conductorId)) {
      return res.status(400).json({
        success: false,
        message: "Valid bus ID and conductorId are required",
      });
    }

    const session = await mongoose.startSession();
    let updatedBus;

    try {
      await session.withTransaction(async () => {
        const bus = await Bus.findById(id).session(session);
        if (!bus) throw httpError(404, "Bus not found");
        if (bus.tripStatus === "In Progress") {
          throw httpError(409, "Cannot change assignment during an active trip");
        }

        const conductor = await Conductor.findById(conductorId).session(session);
        if (!conductor || conductor.status === "Inactive") {
          throw httpError(404, "Available Conductor not found");
        }

        const linkedUser = await User.findOne({
          conductor: conductor._id,
          role: "Conductor",
          approvalStatus: "Approved",
          isActive: true,
        }).session(session);
        if (!linkedUser) {
          throw httpError(409, "Conductor must have an approved active login");
        }

        const alreadyAssignedHere =
          bus.assignedConductor?.toString() === conductor._id.toString();
        if (alreadyAssignedHere) {
          updatedBus = await Bus.findById(bus._id)
            .populate("assignedDriver", "driverCode name status")
            .populate("assignedConductor", "conductorCode name status")
            .session(session);
          return;
        }

        if (conductor.status !== "Available") {
          throw httpError(409, "This Conductor is not available for assignment");
        }

        const otherBus = await Bus.findOne({
          assignedConductor: conductor._id,
          _id: { $ne: bus._id },
        }).session(session);
        if (otherBus) {
          throw httpError(409, "This Conductor is already assigned to another bus");
        }

        const previousConductorId = bus.assignedConductor;
        bus.assignedConductor = conductor._id;
        bus.tripStatus = "Not Started";
        bus.tripStartedAt = null;
        // Keep the latest completion timestamp and tripHistory until the next trip starts.
        await bus.save({ session });

        if (previousConductorId) {
          await syncConductorAvailability(previousConductorId, session);
        }

        conductor.status = "On Duty";
        await conductor.save({ session });

        updatedBus = await Bus.findById(bus._id)
          .populate("assignedDriver", "driverCode name status")
          .populate("assignedConductor", "conductorCode name status")
          .session(session);
      });

      return res.json({
        success: true,
        message: "Conductor assigned successfully",
        bus: updatedBus,
      });
    } catch (error) {
      console.error("Assign Conductor error:", error.message);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to assign Conductor",
      });
    } finally {
      await session.endSession();
    }
  }
);

app.delete(
  "/api/buses/:id/assign-conductor",
  authenticate,
  authorize("Admin"),
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid bus ID" });
    }

    const session = await mongoose.startSession();
    let updatedBus;

    try {
      await session.withTransaction(async () => {
        const bus = await Bus.findById(req.params.id).session(session);
        if (!bus) throw httpError(404, "Bus not found");
        if (bus.tripStatus === "In Progress") {
          throw httpError(409, "End the active trip before unassigning the Conductor");
        }

        const previousId = bus.assignedConductor;
        bus.assignedConductor = null;
        await bus.save({ session });
        if (previousId) await syncConductorAvailability(previousId, session);

        updatedBus = await Bus.findById(bus._id)
          .populate("assignedDriver", "driverCode name status")
          .populate("assignedConductor", "conductorCode name status")
          .session(session);
      });

      return res.json({
        success: true,
        message: "Conductor assignment removed",
        bus: updatedBus,
      });
    } catch (error) {
      console.error("Unassign Conductor error:", error.message);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to remove Conductor assignment",
      });
    } finally {
      await session.endSession();
    }
  }
);

// ==================================================
// ADMIN: REMOVE DRIVER ASSIGNMENT
// ==================================================

app.delete(
  "/api/buses/:id/assign-driver",
  authenticate,
  authorize("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bus ID",
        });
      }

      const bus = await Bus.findById(id);

      if (!bus) {
        return res.status(404).json({
          success: false,
          message: "Bus not found",
        });
      }

      if (bus.tripStatus === "In Progress") {
        return res.status(409).json({
          success: false,
          message: "End the active trip before unassigning the driver",
        });
      }

      const previousDriverId = bus.assignedDriver;

      bus.assignedDriver = null;
      bus.tripStatus = "Not Started";
      bus.tripStartedAt = null;
      bus.tripEndedAt = null;

      await bus.save();

      if (previousDriverId) {
        await Driver.findByIdAndUpdate(previousDriverId, {
          status: "Available",
        });
      }

      res.status(200).json({
        success: true,
        message: "Driver assignment removed",
        bus,
      });
    } catch (error) {
      console.error("Unassign driver error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to remove driver assignment",
      });
    }
  }
);

// ==================================================
// DRIVER: START BUS TRIP
// ==================================================

app.patch(
  "/api/buses/:id/start-trip",
  authenticate,
  authorize("Driver", "Conductor"),
  async (req, res) => {
    const { id } = req.params;
    const profileId = req.user.role === "Driver" ? req.user.driver : req.user.conductor;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid bus ID" });
    }
    if (!mongoose.isValidObjectId(profileId)) {
      return res.status(403).json({
        success: false,
        message: `No ${req.user.role.toLowerCase()} profile is linked to this account`,
      });
    }

    const session = await mongoose.startSession();
    let startedBus;

    try {
      await session.withTransaction(async () => {
        const bus = await Bus.findById(id).session(session);
        if (!bus) throw httpError(404, "Bus not found");

        const assignedProfile = req.user.role === "Driver"
          ? bus.assignedDriver
          : bus.assignedConductor;
        if (assignedProfile?.toString() !== profileId.toString()) {
          throw httpError(403, "You are not assigned to this bus");
        }
        if (bus.tripStatus === "In Progress") {
          throw httpError(409, "Trip is already in progress");
        }

        bus.tripStatus = "In Progress";
        bus.status = "Running";
        bus.tripStartedAt = new Date();
        bus.tripEndedAt = null;
        const firstRouteStop = [...(bus.routeStops || [])]
          .sort((a, b) => a.sequence - b.sequence)[0];
        if (firstRouteStop) {
          bus.currentStopSequence = firstRouteStop.sequence;
          bus.currentStopName = firstRouteStop.name;
        }
        await bus.save({ session });

        const profile = req.user.role === "Driver"
          ? await Driver.findById(profileId).session(session)
          : await Conductor.findById(profileId).session(session);
        if (!profile || profile.status === "Inactive") {
          throw httpError(409, "Your profile is unavailable for duty");
        }
        profile.status = "On Duty";
        await profile.save({ session });

        startedBus = await Bus.findById(bus._id)
          .populate("assignedDriver", "driverCode name status")
          .populate("assignedConductor", "conductorCode name status")
          .session(session);
      });

      return res.status(200).json({
        success: true,
        message: "Trip started successfully",
        bus: startedBus,
      });
    } catch (error) {
      console.error("Start trip error:", error.message);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to start trip",
      });
    } finally {
      await session.endSession();
    }
  }
);

// ==================================================
// DRIVER: END BUS TRIP
// ==================================================

app.patch(
  "/api/buses/:id/end-trip",
  authenticate,
  authorize("Driver", "Conductor"),
  async (req, res) => {
    const { id } = req.params;
    const profileId = req.user.role === "Driver" ? req.user.driver : req.user.conductor;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid bus ID" });
    }
    if (!mongoose.isValidObjectId(profileId)) {
      return res.status(403).json({
        success: false,
        message: `No ${req.user.role.toLowerCase()} profile is linked to this account`,
      });
    }

    const session = await mongoose.startSession();
    let updatedBus;
    let durationMinutes = 0;
    let profileStatus = null;
    let endedAt;

    try {
      await session.withTransaction(async () => {
        const bus = await Bus.findById(id).session(session);
        if (!bus) throw httpError(404, "Bus not found");

        const assignedProfile = req.user.role === "Driver"
          ? bus.assignedDriver
          : bus.assignedConductor;
        if (assignedProfile?.toString() !== profileId.toString()) {
          throw httpError(403, "You are not assigned to this bus");
        }
        if (bus.tripStatus !== "In Progress") {
          throw httpError(409, "There is no active trip to end");
        }

        const [driver, conductor] = await Promise.all([
          bus.assignedDriver
            ? Driver.findById(bus.assignedDriver).session(session)
            : null,
          bus.assignedConductor
            ? Conductor.findById(bus.assignedConductor).session(session)
            : null,
        ]);
        if (req.user.role === "Driver" && !driver) {
          throw httpError(409, "Assigned driver profile is unavailable");
        }
        if (req.user.role === "Conductor" && !conductor) {
          throw httpError(409, "Assigned conductor profile is unavailable");
        }

        endedAt = new Date();
        const startedAt = bus.tripStartedAt || endedAt;
        durationMinutes = Math.max(
          0,
          Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)
        );

        bus.tripHistory.push({
          busNumber: bus.busNumber || "",
          driver: driver?._id || null,
          driverName: driver?.name || "",
          driverCode: driver?.driverCode || "",
          conductor: conductor?._id || null,
          conductorName: conductor?.name || "",
          conductorCode: conductor?.conductorCode || "",
          source: bus.source || "",
          destination: bus.destination || "",
          route: bus.route || "",
          startedAt,
          endedAt,
          durationMinutes,
          tripStatus: "Completed",
        });

        bus.tripStatus = "Completed";
        bus.status = "Stopped";
        bus.tripEndedAt = endedAt;
        bus.currentPassengerCount = 0;
        bus.crowdLastUpdated = endedAt;
        bus.crowdUpdateMode = "tickets";
        bus.manualCrowdUpdate = null;
        bus.currentStopSequence = null;
        bus.currentStopName = "";

        if (req.user.role === "Driver") {
          bus.assignedDriver = null;
        } else {
          // Release only the conductor who completed this duty; the driver stays assigned.
          bus.assignedConductor = null;
        }

        await Ticket.updateMany(
          { bus: bus._id, status: "Active" },
          { $set: { status: "Completed" } },
          { session }
        );
        await bus.save({ session });

        profileStatus = req.user.role === "Driver"
          ? await syncDriverAvailability(profileId, session)
          : await syncConductorAvailability(profileId, session);

        updatedBus = await Bus.findById(bus._id)
          .populate("assignedDriver", "driverCode name status")
          .populate("assignedConductor", "conductorCode name status")
          .session(session);
      });

      const isConductor = req.user.role === "Conductor";
      const message = isConductor
        ? profileStatus === "Available"
          ? "Duty completed. The bus is available for reassignment, and you are now Available."
          : "Duty completed. The bus is available for reassignment; your other duty remains active."
        : profileStatus === "Available"
          ? "Trip completed. Driver is now available."
          : "Trip completed. Your other bus assignment remains active.";

      return res.status(200).json({
        success: true,
        message,
        durationMinutes,
        endedAt,
        profileStatus,
        bus: updatedBus,
      });
    } catch (error) {
      console.error("End trip error:", error.message);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || "Failed to end trip",
      });
    } finally {
      await session.endSession();
    }
  }
);

// ==================================================
// DRIVER: UPDATE GPS LOCATION
// ==================================================

app.patch(
  "/api/buses/:id/location",
  authenticate,
  authorize("Driver"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bus ID",
        });
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
          success: false,
          message: "Valid numeric latitude and longitude are required",
        });
      }

      if (!req.user.driver) {
        return res.status(403).json({
          success: false,
          message: "No driver profile is linked to this account",
        });
      }

      const bus = await Bus.findById(id);

      if (!bus) {
        return res.status(404).json({
          success: false,
          message: "Bus not found",
        });
      }

      if (
        !bus.assignedDriver ||
        bus.assignedDriver.toString() !== req.user.driver.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this bus",
        });
      }

      if (bus.tripStatus !== "In Progress") {
        return res.status(409).json({
          success: false,
          message: "Start the assigned trip before sharing GPS",
        });
      }

      bus.latitude = latitude;
      bus.longitude = longitude;
      bus.lastLocationUpdate = new Date();

      const lastPoint =
        bus.locationHistory?.[bus.locationHistory.length - 1];

      if (
        !lastPoint ||
        lastPoint.latitude !== latitude ||
        lastPoint.longitude !== longitude
      ) {
        bus.locationHistory.push({
          latitude,
          longitude,
          timestamp: new Date(),
        });
      }

      if (bus.locationHistory.length > 500) {
        bus.locationHistory = bus.locationHistory.slice(-500);
      }

      await bus.save();

      res.status(200).json({
        success: true,
        message: "Bus location updated successfully",
        bus,
      });
    } catch (error) {
      console.error("Update location error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to update bus location",
      });
    }
  }
);

// ==================================================
// ADMIN: DELETE BUS
// ==================================================

app.delete(
  "/api/buses/:id",
  authenticate,
  authorize("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bus ID",
        });
      }

      const bus = await Bus.findById(id);

      if (!bus) {
        return res.status(404).json({
          success: false,
          message: "Bus not found",
        });
      }

      if (bus.tripStatus === "In Progress") {
        return res.status(409).json({
          success: false,
          message: "Cannot delete a bus during an active trip",
        });
      }

      const previousDriverId = bus.assignedDriver;

      await Bus.findByIdAndDelete(id);

      if (previousDriverId) {
        await Driver.findByIdAndUpdate(previousDriverId, {
          status: "Available",
        });
      }

      res.status(200).json({
        success: true,
        message: "Bus deleted successfully",
      });
    } catch (error) {
      console.error("Delete bus error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to delete bus",
      });
    }
  }
);

// ==================================================
// 404 HANDLER
// ==================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// ==================================================
// GLOBAL ERROR HANDLER
// ==================================================

app.use((err, req, res, next) => {
  console.error("Unexpected server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// ==================================================
// START SERVER
// ==================================================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`VeloCity backend running on port ${PORT}`);
      console.log(`Home API: http://localhost:${PORT}/`);
      console.log(`Buses API: http://localhost:${PORT}/api/buses`);
      console.log(`Drivers API: http://localhost:${PORT}/api/drivers`);
      console.log(`Auth API: http://localhost:${PORT}/api/auth`);
      console.log(
        `Passenger Trips API: http://localhost:${PORT}/api/passenger-trips`
      );
      console.log(
        `Conductors API: http://localhost:${PORT}/api/conductors`
      );
      console.log(
        `Tickets API: http://localhost:${PORT}/api/tickets`
      );
    });
  } catch (error) {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
