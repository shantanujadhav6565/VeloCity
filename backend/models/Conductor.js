
const mongoose = require("mongoose");

const conductorSchema = new mongoose.Schema(
  {
    conductorCode: {
      type: String,
      required: [true, "Conductor code is required"],
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: [true, "Conductor name is required"],
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

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

module.exports = mongoose.model("Conductor", conductorSchema);
