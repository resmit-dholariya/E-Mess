const passport = require("passport");

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
  res.render("studentDashboard", { student: req.user });
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
