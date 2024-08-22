require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const flash = require("connect-flash");
const studentRoutes = require("./routes/studentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const passportConfig = require("./config/passport");
const connectdb = require("./databaseSetup");

const app = express();

// Database connection

connectdb();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passportConfig(passport);

// View engine
app.set("view engine", "ejs");
app.set("views", "views");

// Routes
app.use("/admin", adminRoutes);
app.use("/student", studentRoutes);

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
