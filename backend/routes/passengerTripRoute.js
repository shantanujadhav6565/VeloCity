
const express = require("express");
const mongoose = require("mongoose");

const authenticate = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const PassengerTrip = require("../models/PassengerTrip");
const Bus = require("../models/Bus");

const router = express.Router();

// GET: Passenger chi current active trip milva
router.get(
  "/active",
  authenticate,
  authorize("Passenger"),
  async (req, res, next) => {
    try {
      const trip = await PassengerTrip.findOne({
        passengerId: req.user._id,
        status: "Active",
      }).populate("busId");

      return res.status(200).json({
        success: true,
        trip,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// POST: Passenger eka bus madhye enroll hoto
router.post(
  "/enroll",
  authenticate,
  authorize("Passenger"),
  async (req, res, next) => {
    try {
      const { busId } = req.body;

      // Bus ID validation
      if (!mongoose.isValidObjectId(busId)) {
        return res.status(400).json({
          success: false,
          message: "Valid bus ID is required",
        });
      }

      // Bus database madhye aahe ka check kara
      const bus = await Bus.findById(busId);

      if (!bus) {
        return res.status(404).json({
          success: false,
          message: "Bus not found",
        });
      }

      // Passenger chi existing active trip check kara
      const existingTrip = await PassengerTrip.findOne({
        passengerId: req.user._id,
        status: "Active",
      }).populate("busId");

      if (existingTrip) {
        return res.status(409).json({
          success: false,
          message:
            "You already have an active trip. End it before joining another bus.",
          trip: existingTrip,
        });
      }

      // New trip create kara
      const trip = await PassengerTrip.create({
        passengerId: req.user._id,
        busId: bus._id,
        status: "Active",
      });

      await trip.populate("busId");

      return res.status(201).json({
        success: true,
        message: "Trip enrollment successful",
        trip,
      });
    } catch (error) {
      // Unique index mule concurrent duplicate enrollment block hote
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "You already have an active trip. End it before joining another bus.",
        });
      }

      return next(error);
    }
  }
);

// PATCH: Passenger swatahchi active trip end karto
router.patch(
  "/end",
  authenticate,
  authorize("Passenger"),
  async (req, res, next) => {
    try {
      const trip = await PassengerTrip.findOneAndUpdate(
        {
          passengerId: req.user._id,
          status: "Active",
        },
        {
          $set: {
            status: "Completed",
            endedAt: new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).populate("busId");

      if (!trip) {
        return res.status(404).json({
          success: false,
          message: "You do not have an active trip",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Trip ended successfully",
        trip,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
