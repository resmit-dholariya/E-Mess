// addAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/admin"); // Path to your Admin model
const connectdb = require("./db");

const createAdmin = async () => {
  await connectdb();

  // Create a new admin
  const admin = new Admin({
    username: "admin",
    password: "123", // Replace with your desired password
  });

  // Save the admin
  try {
    await admin.save();
    console.log("Admin added successfully");
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
