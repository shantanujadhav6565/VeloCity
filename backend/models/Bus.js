
const mongoose = require("mongoose");

const routeStopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Stop name is required"],
      trim: true,
    },
    sequence: {
      type: Number,
      required: [true, "Stop sequence is required"],
      min: [0, "Stop sequence cannot be negative"],
    },
  },
  { _id: false }
);

const locationHistorySchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const tripHistorySchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },
    driverName: {
      type: String,
      default: "",
    },
    driverCode: {
      type: String,
      default: "",
    },
    busNumber: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      required: true,
    },
    destination: {
      type: String,
      required: true,
    },
    route: {
      type: String,
      required: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
    },
    tripStatus: {
      type: String,
      enum: ["Completed"],
      default: "Completed",
    },
  },
  { _id: true }
);

// Records the conductor's manual crowd corrections.
const manualCrowdUpdateSchema = new mongoose.Schema(
  {
    passengerCount: {
      type: Number,
      required: true,
      min: [0, "Passenger count cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Passenger count must be a whole number",
      },
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [300, "Reason cannot exceed 300 characters"],
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const busSchema = new mongoose.Schema(
  {
    busNumber: {
      type: String,
      required: [true, "Bus number is required"],
      unique: true,
      trim: true,
    },

    source: {
      type: String,
      required: [true, "Source is required"],
      trim: true,
    },

    destination: {
      type: String,
      required: [true, "Destination is required"],
      trim: true,
    },

    route: {
      type: String,
      required: [true, "Route is required"],
      trim: true,
    },

    busImage: {
      type: String,
      default: "",
    },

    // Admin configures the maximum passenger capacity.
    capacity: {
      type: Number,
      default: 50,
      required: true,
      min: [1, "Bus capacity must be at least 1"],
      validate: {
        validator: Number.isInteger,
        message: "Bus capacity must be a whole number",
      },
    },

    // Admin configures stops in travel order.
    routeStops: {
      type: [routeStopSchema],
      default: [],
      validate: {
        validator: function (stops) {
          if (!Array.isArray(stops)) return false;

          const sequences = stops.map((stop) => stop.sequence);
          const names = stops.map((stop) =>
            stop.name.trim().toLowerCase()
          );

          return (
            new Set(sequences).size === sequences.length &&
            new Set(names).size === names.length
          );
        },
        message:
          "Route stops must have unique sequence numbers and unique names",
      },
    },

    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },

    // Reference to the assigned conductor profile.
    assignedConductor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conductor",
      default: null,
    },

    tripStatus: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"],
      default: "Not Started",
    },

    tripStartedAt: {
      type: Date,
      default: null,
    },

    tripEndedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Running", "Delayed", "Stopped"],
      default: "Stopped",
    },

    // Latest known bus GPS position.
    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    sourceLatitude: {
      type: Number,
      default: null,
    },

    sourceLongitude: {
      type: Number,
      default: null,
    },

    destinationLatitude: {
      type: Number,
      default: null,
    },

    destinationLongitude: {
      type: Number,
      default: null,
    },

    lastLocationUpdate: {
      type: Date,
      default: null,
    },

    locationHistory: {
      type: [locationHistorySchema],
      default: [],
    },

    // Current onboard passenger count.
    // Ticket routes will update this in a later step.
    currentPassengerCount: {
      type: Number,
      default: 0,
      min: [0, "Passenger count cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Passenger count must be a whole number",
      },
    },

    // Last time the crowd count was updated.
    crowdLastUpdated: {
      type: Date,
      default: null,
    },

    // "tickets" means calculated from issued tickets.
    // "manual" means corrected by the conductor.
    crowdUpdateMode: {
      type: String,
      enum: ["tickets", "manual"],
      default: "tickets",
    },

    // Most recent manual correction, if any.
    manualCrowdUpdate: {
      type: manualCrowdUpdateSchema,
      default: null,
    },

    // Current stop sequence refers to routeStops[].sequence.
    currentStopSequence: {
      type: Number,
      default: null,
      min: [0, "Stop sequence cannot be negative"],
    },

    currentStopName: {
      type: String,
      default: "",
      trim: true,
    },

    tripHistory: {
      type: [tripHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Derived crowd information; these values are not stored separately.
busSchema.virtual("availableSeats").get(function () {
  return Math.max(this.capacity - this.currentPassengerCount, 0);
});

busSchema.virtual("crowdPercentage").get(function () {
  if (!this.capacity) return 0;

  return Math.round(
    (this.currentPassengerCount / this.capacity) * 100
  );
});

busSchema.virtual("crowdStatus").get(function () {
  if (!this.capacity) return "Unknown";

  const percentage =
    (this.currentPassengerCount / this.capacity) * 100;

  if (percentage >= 100) return "Full";
  if (percentage < 40) return "Low";
  if (percentage < 75) return "Medium";
  return "High";
});

busSchema.set("toJSON", { virtuals: true });
busSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Bus", busSchema);
