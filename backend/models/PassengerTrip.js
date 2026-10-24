
const mongoose = require("mongoose");

const passengerTripSchema = new mongoose.Schema(
  {
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },

    status: {
      type: String,
      enum: ["Active", "Completed"],
      default: "Active",
      required: true,
    },

    enrolledAt: {
      type: Date,
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Eka passenger chi ekach Active trip database madhye allow kara.
passengerTripSchema.index(
  { passengerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "Active",
    },
  }
);

const PassengerTrip = mongoose.model("PassengerTrip", passengerTripSchema);

module.exports = PassengerTrip;
