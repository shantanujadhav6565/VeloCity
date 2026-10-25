
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

// ADMIN: assign or replace an approved Conductor for a bus.
app.patch("/api/buses/:id/assign-conductor", authenticate, authorize("Admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { conductorId } = req.body;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(conductorId)) return res.status(400).json({ success: false, message: "Valid bus ID and conductorId are required" });
    const [bus, conductor] = await Promise.all([Bus.findById(id), Conductor.findById(conductorId)]);
    if (!bus) return res.status(404).json({ success: false, message: "Bus not found" });
    if (!conductor || conductor.status === "Inactive") return res.status(404).json({ success: false, message: "Available Conductor not found" });
    if (bus.tripStatus === "In Progress") return res.status(409).json({ success: false, message: "Cannot change assignment during an active trip" });
    const linkedUser = await User.findOne({ conductor: conductor._id, role: "Conductor", approvalStatus: "Approved", isActive: true });
    if (!linkedUser) return res.status(409).json({ success: false, message: "Conductor must have an approved active login" });
    const otherBus = await Bus.findOne({ assignedConductor: conductor._id, _id: { $ne: bus._id } });
    if (otherBus) return res.status(409).json({ success: false, message: "This Conductor is already assigned to another bus" });
    if (bus.assignedConductor && bus.assignedConductor.toString() !== conductor._id.toString()) await Conductor.findByIdAndUpdate(bus.assignedConductor, { status: "Available" });
    bus.assignedConductor = conductor._id;
    bus.tripStatus = "Not Started";
    bus.tripStartedAt = null;
    bus.tripEndedAt = null;
    await bus.save();
    conductor.status = "On Duty";
    await conductor.save();
    const updatedBus = await Bus.findById(bus._id).populate("assignedConductor", "conductorCode name status");
    return res.json({ success: true, message: "Conductor assigned successfully", bus: updatedBus });
  } catch (error) {
    console.error("Assign Conductor error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to assign Conductor" });
  }
});

app.delete("/api/buses/:id/assign-conductor", authenticate, authorize("Admin"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid bus ID" });
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ success: false, message: "Bus not found" });
    if (bus.tripStatus === "In Progress") return res.status(409).json({ success: false, message: "End the active trip before unassigning the Conductor" });
    const previousId = bus.assignedConductor;
    bus.assignedConductor = null;
    await bus.save();
    if (previousId) await Conductor.findByIdAndUpdate(previousId, { status: "Available" });
    return res.json({ success: true, message: "Conductor assignment removed", bus });
  } catch (error) {
    console.error("Unassign Conductor error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to remove Conductor assignment" });
  }
});

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
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bus ID",
        });
      }

      if (req.user.role === "Driver" && !req.user.driver) {
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

      const isAssigned = req.user.role === "Driver"
        ? bus.assignedDriver?.toString() === req.user.driver?.toString()
        : bus.assignedConductor?.toString() === req.user.conductor?.toString();
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this bus",
        });
      }

      if (bus.tripStatus === "In Progress") {
        return res.status(409).json({
          success: false,
          message: "Trip is already in progress",
        });
      }

      bus.tripStatus = "In Progress";
      bus.status = "Running";
      bus.tripStartedAt = new Date();
      bus.tripEndedAt = null;
      const firstRouteStop = [...(bus.routeStops || [])].sort((a, b) => a.sequence - b.sequence)[0];
      if (firstRouteStop) {
        bus.currentStopSequence = firstRouteStop.sequence;
        bus.currentStopName = firstRouteStop.name;
      }

      await bus.save();

      if (req.user.role === "Driver") await Driver.findByIdAndUpdate(req.user.driver, { status: "On Duty" });
      else await Conductor.findByIdAndUpdate(req.user.conductor, { status: "On Duty" });

      res.status(200).json({
        success: true,
        message: "Trip started successfully",
        bus,
      });
    } catch (error) {
      console.error("Start trip error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to start trip",
      });
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
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bus ID",
        });
      }

      if (req.user.role === "Driver" && !req.user.driver) {
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

      const isAssigned = req.user.role === "Driver"
        ? bus.assignedDriver?.toString() === req.user.driver?.toString()
        : bus.assignedConductor?.toString() === req.user.conductor?.toString();
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this bus",
        });
      }

      if (bus.tripStatus !== "In Progress") {
        return res.status(409).json({
          success: false,
          message: "There is no active trip to end",
        });
      }

      const endedAt = new Date();
      const startedAt = bus.tripStartedAt || endedAt;

      const durationMinutes = Math.max(
        0,
        Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)
      );

      const driver = req.user.role === "Driver" ? await Driver.findById(req.user.driver) : null;

      bus.tripHistory.push({
        busNumber: bus.busNumber || "",
        driver: driver?._id || undefined,
        driverName: driver?.name || "",
        driverCode: driver?.driverCode || "",
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
      await Ticket.updateMany({ bus: bus._id, status: "Active" }, { $set: { status: "Completed" } });

      // Drivers are released at trip end; the admin-controlled Conductor
      // assignment remains linked to the bus for the next trip.
      if (req.user.role === "Driver") bus.assignedDriver = null;

      await bus.save();

      if (req.user.role === "Driver") await Driver.findByIdAndUpdate(req.user.driver, { status: "Available" });
      else await Conductor.findByIdAndUpdate(req.user.conductor, { status: "Available" });

      const updatedBus = await Bus.findById(bus._id).populate(
        "assignedDriver",
        "driverCode name status"
      );

      res.status(200).json({
        success: true,
        message: req.user.role === "Driver" ? "Trip completed. Driver is now available." : "Trip completed successfully.",
        durationMinutes,
        bus: updatedBus,
      });
    } catch (error) {
      console.error("End trip error:", error.message);

      res.status(500).json({
        success: false,
        message: "Failed to end trip",
        error: error.message,
      });
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
