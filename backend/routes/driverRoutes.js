
const express = require("express");
const router = express.Router();

const Driver = require("../models/Driver");

// GET all drivers
router.get("/", async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });

    res.status(200).json(drivers);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch drivers",
      error: error.message,
    });
  }
});

// GET driver by ID
router.get("/:id", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    res.status(200).json(driver);
  } catch (error) {
    res.status(400).json({
      message: "Invalid driver ID",
      error: error.message,
    });
  }
});

// CREATE a new driver
router.post("/", async (req, res) => {
  try {
    const { driverCode, name, phone } = req.body;

    if (!driverCode || !name) {
      return res.status(400).json({
        message: "Driver code and name are required",
      });
    }

    const existingDriver = await Driver.findOne({ driverCode });

    if (existingDriver) {
      return res.status(409).json({
        message: "Driver code already exists",
      });
    }

    const driver = await Driver.create({
      driverCode,
      name,
      phone,
    });

    res.status(201).json({
      message: "Driver created successfully",
      driver,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create driver",
      error: error.message,
    });
  }
});

// UPDATE driver details
router.put("/:id", async (req, res) => {
  try {
    const { driverCode, name, phone, status } = req.body;

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { driverCode, name, phone, status },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    res.status(200).json({
      message: "Driver updated successfully",
      driver,
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to update driver",
      error: error.message,
    });
  }
});

// DELETE driver
router.delete("/:id", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    // Do not delete a driver who is still assigned to a bus
    const Bus = require("../models/Bus");
    const assignedBus = await Bus.findOne({
      assignedDriver: driver._id,
    });

    if (assignedBus) {
      return res.status(409).json({
        message: "Unassign this driver from the bus before deleting",
      });
    }

    await Driver.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Driver deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to delete driver",
      error: error.message,
    });
  }
});

module.exports = router;
