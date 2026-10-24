
const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      index: true,
    },

    conductor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    boardingStop: {
      type: String,
      required: [true, "Boarding stop is required"],
      trim: true,
    },

    boardingStopSequence: {
      type: Number,
      required: true,
      min: [0, "Boarding stop sequence cannot be negative"],
    },

    destinationStop: {
      type: String,
      required: [true, "Destination stop is required"],
      trim: true,
    },

    destinationStopSequence: {
      type: Number,
      required: true,
      min: [0, "Destination stop sequence cannot be negative"],
    },

    passengerCount: {
      type: Number,
      required: true,
      default: 1,
      min: [1, "At least one passenger is required"],
      validate: {
        validator: Number.isInteger,
        message: "Passenger count must be a whole number",
      },
    },

    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    status: {
      type: String,
      enum: ["Active", "Cancelled", "Completed"],
      default: "Active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// A ticket must travel forward along the configured route.
ticketSchema.pre("validate", function () {
  if (
    this.boardingStopSequence != null &&
    this.destinationStopSequence != null &&
    this.destinationStopSequence <= this.boardingStopSequence
  ) {
    this.invalidate(
      "destinationStopSequence",
      "Destination must come after the boarding stop"
    );
  }
});

ticketSchema.index({
  bus: 1,
  status: 1,
  boardingStopSequence: 1,
  destinationStopSequence: 1,
});

module.exports = mongoose.model("Ticket", ticketSchema);
