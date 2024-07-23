// addAdmin.js
const mongoose = require("mongoose");
const Admin = require("./models/admin"); // Path to your Admin model

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost/mess-management")
  .then(async () => {
    console.log("Connected to MongoDB");

    // Create a new admin
    const admin = new Admin({
      username: "admin",
      password: "password123", // Replace with your desired password
    });

    // Save the admin
    try {
      await admin.save();
      console.log("Admin added successfully");
    } catch (error) {
      console.error("Error adding admin:", error);
    }

    // Close the connection
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });
