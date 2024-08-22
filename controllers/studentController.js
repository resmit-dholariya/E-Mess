const passport = require("passport");
const Student = require("../models/studentModel"); // Make sure this path is correct
const MonthlyFees = require("../models/monthlyFeesModel");

exports.getLogin = (req, res) => {
  res.render("studentLogin", { message: req.flash("error") });
};

exports.postLogin = passport.authenticate("student-local", {
  successRedirect: "/student/dashboard",
  failureRedirect: "/student/login",
  failureFlash: true,
});

exports.getDashboard = async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/student/login");
  }

  try {
    // Retrieve the student data
    const student = await Student.findById(req.user._id);

    if (!student) {
      return res.status(404).send("Student not found");
    }

    // Retrieve all monthly fees
    const monthlyFees = await MonthlyFees.find({});

    // Render the student dashboard with student data and monthly fees
    res.render("studentDashboard", { student, monthlyFees });
  } catch (err) {
    console.error("Error retrieving student data:", err);
    res.status(500).send("Server Error");
  }
};

exports.logout = (req, res) => {
  req.logout(() => {
    try {
      res.redirect("/student/login");
    } catch (error) {
      res.send(error);
    }
  });
};
