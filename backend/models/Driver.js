
const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    // Unique driver ID
    driverCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Driver full name
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Driver contact number
    phone: {
      type: String,
      default: "",
      trim: true,
    },

    // Driver availability
    status: {
      type: String,
      enum: ["Available", "On Duty", "Inactive"],
      default: "Available",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Driver", driverSchema);
