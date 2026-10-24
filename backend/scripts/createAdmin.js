
require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function createAdmin() {
  try {
    const phone = process.env.ADMIN_PHONE?.trim();
    const firstName = process.env.ADMIN_FIRST_NAME?.trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!firstName) {
      throw new Error("Set ADMIN_FIRST_NAME in .env");
    }

    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      throw new Error("Set a valid ADMIN_PHONE in .env");
    }

    if (
      !password ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new Error(
        "ADMIN_PASSWORD must be at least 8 characters and at most 72 bytes"
      );
    }

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });

    console.log("MongoDB connected successfully.");

    let admin = await User.findOne({ phone });

    if (admin && admin.role !== "Admin") {
      throw new Error(
        "This phone belongs to a non-admin user. Use a different ADMIN_PHONE."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    if (admin) {
      admin.firstName = firstName;
      admin.password = hashedPassword;
      admin.isActive = true;
      admin.role = "Admin";
      await admin.save();

      console.log("Existing Admin account updated successfully.");
    } else {
      await User.create({
        firstName,
        phone,
        password: hashedPassword,
        role: "Admin",
        isActive: true,
        approvalStatus: "Approved",
      });

      console.log("Admin account created successfully.");
    }
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

createAdmin();
