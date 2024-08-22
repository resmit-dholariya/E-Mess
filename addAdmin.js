// addAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/adminModel"); // Path to your Admin model
const connectdb = require("./databaseSetup");

const createAdmin = async () => {
  await connectdb();

  try {
    // Check if there are any existing admins
    const existingAdmin = await Admin.findOne();

    if (existingAdmin) {
      console.log("An admin already exists. No new admin created.");
    } else {
      // Create a new admin
      const admin = new Admin({
        username: "admin",
        password: "123", // Replace with your desired password
      });

      // Save the admin
      await admin.save();
      console.log("Admin added successfully");
    }
  } catch (error) {
    console.error("Error adding admin:", error);
  } finally {
    // Close the connection
    mongoose.connection.close();
  }
};

createAdmin().catch((err) => {
  console.error("Error in createAdmin:", err);
});
