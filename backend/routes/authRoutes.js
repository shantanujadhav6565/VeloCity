
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const User = require("../models/User");
const Driver = require("../models/Driver");
const Conductor = require("../models/Conductor");

const authenticate = require("../middleware/auth");
const authorize = require("../middleware/authorize");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

function validPhone(phone) {
  return (
    typeof phone === "string" &&
    /^\+[1-9]\d{7,14}$/.test(phone.trim())
  );
}

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72
  );
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "2h",
      issuer: "transitpulse-api",
      audience: "transitpulse-client",
    }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    phone: user.phone,
    role: user.role,
    driverId: user.driver || null,
    conductorId: user.conductor || null,
    approvalStatus: user.approvalStatus || "Approved",
  };
}

// ========================================
// POST /api/auth/register
// Passenger signup only
// ========================================
router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { firstName, phone, password } = req.body;

    if (
      typeof firstName !== "string" ||
      firstName.trim().length < 2 ||
      firstName.trim().length > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "First name must be between 2 and 50 characters",
      });
    }

    if (!validPhone(phone) || !validPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Use an international phone number and a password of 8–72 bytes",
      });
    }

    const normalizedPhone = phone.trim();

    const existingUser = await User.findOne({
      phone: normalizedPhone,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this phone number already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      firstName: firstName.trim(),
      phone: normalizedPhone,
      password: hashedPassword,
      role: "Passenger",
      isActive: true,
      approvalStatus: "Approved",
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Passenger registered successfully",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this phone number already exists",
      });
    }

    next(error);
  }
});

// ========================================
// POST /api/auth/driver-signup
// Driver signup: waits for Admin approval
// ========================================
router.post(
  "/driver-signup",
  registerLimiter,
  async (req, res, next) => {
    try {
      const { firstName, phone, password } = req.body;

      if (
        typeof firstName !== "string" ||
        firstName.trim().length < 2 ||
        firstName.trim().length > 50
      ) {
        return res.status(400).json({
          success: false,
          message: "Name must be between 2 and 50 characters",
        });
      }

      if (!validPhone(phone) || !validPassword(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Use an international phone number and a password of 8–72 bytes",
        });
      }

      const normalizedPhone = phone.trim();

      const existingUser = await User.findOne({
        phone: normalizedPhone,
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "An account with this phone number already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await User.create({
        firstName: firstName.trim(),
        phone: normalizedPhone,
        password: hashedPassword,
        role: "Driver",
        driver: null,
        isActive: true,
        approvalStatus: "Pending",
      });

      return res.status(201).json({
        success: true,
        message:
          "Driver signup submitted. Please wait for Admin approval.",
        user: publicUser(user),
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "An account with this phone number already exists",
        });
      }

      next(error);
    }
  }
);

// ========================================
// POST /api/auth/login
// Login by first name and password
// ========================================
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { firstName, password } = req.body;

    if (
      typeof firstName !== "string" ||
      firstName.trim().length < 2 ||
      typeof password !== "string" ||
      password.length === 0 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid first name and password are required",
      });
    }

    const user = await User.findOne({
      firstName: firstName.trim(),
    }).select("+password");

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid first name or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid first name or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is disabled",
      });
    }

    if (
      user.role === "Driver" &&
      user.approvalStatus !== "Approved"
    ) {
      const message =
        user.approvalStatus === "Rejected"
          ? "Your Driver application was rejected. Please contact Admin."
          : "Your Driver account is waiting for Admin approval.";

      return res.status(403).json({
        success: false,
        approvalStatus: user.approvalStatus || "Pending",
        message,
      });
    }

    if (user.role === "Driver" && !user.driver) {
      return res.status(403).json({
        success: false,
        message: "Driver account is not configured yet",
      });
    }

    if (user.role === "Conductor" && !user.conductor) {
      return res.status(403).json({
        success: false,
        message: "Conductor account is not configured yet",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// GET /api/auth/me
// ========================================
router.get("/me", authenticate, (req, res) => {
  return res.status(200).json({
    success: true,
    user: publicUser(req.user),
  });
});

// ========================================
// GET /api/auth/driver-requests
// Admin: view pending Driver applications
// ========================================
router.get(
  "/driver-requests",
  authenticate,
  authorize("Admin"),
  async (req, res, next) => {
    try {
      const users = await User.find({
        role: "Driver",
        approvalStatus: "Pending",
      }).select("firstName phone role approvalStatus createdAt");

      return res.status(200).json({
        success: true,
        requests: users,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ========================================
// PATCH /api/auth/driver-requests/:id/approve
// Admin approves and assigns a driver code
// ========================================
router.patch(
  "/driver-requests/:id/approve",
  authenticate,
  authorize("Admin"),
  async (req, res, next) => {
    let createdDriverId = null;

    try {
      const { driverCode } = req.body;

      if (
        typeof driverCode !== "string" ||
        !driverCode.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "A unique driver code is required",
        });
      }

      const user = await User.findOne({
        _id: req.params.id,
        role: "Driver",
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Driver application not found",
        });
      }

      if (user.approvalStatus !== "Pending") {
        return res.status(409).json({
          success: false,
          message: "This application has already been reviewed",
        });
      }

      const existingDriver = await Driver.findOne({
        $or: [
          { phone: user.phone },
          { driverCode: driverCode.trim() },
        ],
      });

      if (existingDriver) {
        return res.status(409).json({
          success: false,
          message: "Phone number or driver code already exists",
        });
      }

      const driver = await Driver.create({
        driverCode: driverCode.trim(),
        name: user.firstName,
        phone: user.phone,
        status: "Available",
      });

      createdDriverId = driver._id;

      user.driver = driver._id;
      user.approvalStatus = "Approved";
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Driver approved successfully",
        user: publicUser(user),
        driver,
      });
    } catch (error) {
      if (createdDriverId) {
        await Driver.findByIdAndDelete(createdDriverId).catch(
          () => {}
        );
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Phone number or driver code already exists",
        });
      }

      next(error);
    }
  }
);

// ========================================
// PATCH /api/auth/driver-requests/:id/reject
// Admin rejects a pending application
// ========================================
router.patch(
  "/driver-requests/:id/reject",
  authenticate,
  authorize("Admin"),
  async (req, res, next) => {
    try {
      const user = await User.findOne({
        _id: req.params.id,
        role: "Driver",
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Driver application not found",
        });
      }

      if (user.approvalStatus !== "Pending") {
        return res.status(409).json({
          success: false,
          message: "This application has already been reviewed",
        });
      }

      user.approvalStatus = "Rejected";
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Driver application rejected",
        user: publicUser(user),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ========================================
// POST /api/auth/drivers
// Admin directly creates an approved Driver
// ========================================
router.post(
  "/drivers",
  authenticate,
  authorize("Admin"),
  async (req, res, next) => {
    let createdDriverId = null;

    try {
      const { driverCode, name, phone, password } = req.body;

      if (
        typeof driverCode !== "string" ||
        !driverCode.trim() ||
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 50 ||
        !validPhone(phone) ||
        !validPassword(password)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Driver code, valid name, phone and password are required",
        });
      }

      const normalizedPhone = phone.trim();

      const [existingUser, existingDriver] = await Promise.all([
        User.findOne({ phone: normalizedPhone }),
        Driver.findOne({
          $or: [
            { phone: normalizedPhone },
            { driverCode: driverCode.trim() },
          ],
        }),
      ]);

      if (existingUser || existingDriver) {
        return res.status(409).json({
          success: false,
          message: "Phone number or driver code already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const driver = await Driver.create({
        driverCode: driverCode.trim(),
        name: name.trim(),
        phone: normalizedPhone,
        status: "Available",
      });

      createdDriverId = driver._id;

      const user = await User.create({
        firstName: name.trim(),
        phone: normalizedPhone,
        password: hashedPassword,
        role: "Driver",
        driver: driver._id,
        isActive: true,
        approvalStatus: "Approved",
      });

      return res.status(201).json({
        success: true,
        message: "Approved Driver account created successfully",
        driver,
        user: publicUser(user),
      });
    } catch (error) {
      if (createdDriverId) {
        await Driver.findByIdAndDelete(createdDriverId).catch(
          () => {}
        );
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Phone number or driver code already exists",
        });
      }

      next(error);
    }
  }
);

// ========================================
// POST /api/auth/conductors
// Admin creates an approved Conductor
// ========================================
router.post(
  "/conductors",
  authenticate,
  authorize("Admin"),
  async (req, res, next) => {
    let createdConductorId = null;

    try {
      const { conductorCode, name, phone, password } = req.body;

      if (
        typeof conductorCode !== "string" ||
        !conductorCode.trim() ||
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 50 ||
        !validPhone(phone) ||
        !validPassword(password)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Conductor code, valid name, phone and password are required",
        });
      }

      const normalizedPhone = phone.trim();
      const normalizedCode = conductorCode.trim();

      const [existingUser, existingConductor] = await Promise.all([
        User.findOne({ phone: normalizedPhone }),
        Conductor.findOne({
          $or: [
            { phone: normalizedPhone },
            { conductorCode: normalizedCode },
          ],
        }),
      ]);

      if (existingUser || existingConductor) {
        return res.status(409).json({
          success: false,
          message: "Phone number or conductor code already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const conductor = await Conductor.create({
        conductorCode: normalizedCode,
        name: name.trim(),
        phone: normalizedPhone,
        status: "Available",
      });

      createdConductorId = conductor._id;

      const user = await User.create({
        firstName: name.trim(),
        phone: normalizedPhone,
        password: hashedPassword,
        role: "Conductor",
        conductor: conductor._id,
        isActive: true,
        approvalStatus: "Approved",
      });

      return res.status(201).json({
        success: true,
        message: "Conductor account created successfully",
        conductor,
        user: {
          id: user._id,
          firstName: user.firstName,
          phone: user.phone,
          role: user.role,
          conductorId: user.conductor,
          approvalStatus: user.approvalStatus,
        },
      });
    } catch (error) {
      if (createdConductorId) {
        await Conductor.findByIdAndDelete(createdConductorId).catch(
          () => {}
        );
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Phone number or conductor code already exists",
        });
      }

      next(error);
    }
  }
);

module.exports = router;
