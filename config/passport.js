const LocalStrategy = require("passport-local").Strategy;
const Admin = require("../models/adminModel");
const Student = require("../models/studentModel");

module.exports = function (passport) {
  // Admin strategy
  passport.use(
    "admin-local",
    new LocalStrategy(
      { usernameField: "username" },
      async (username, password, done) => {
        try {
          const admin = await Admin.findOne({ username });
          if (!admin) {
            return done(null, false, { message: "Incorrect username." });
          }
          const isValidPassword = await admin.validPassword(password);
          if (!isValidPassword) {
            return done(null, false, { message: "Incorrect password." });
          }
          return done(null, admin);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Student strategy
  passport.use(
    "student-local",
    new LocalStrategy(
      { usernameField: "username" },
      async (username, password, done) => {
        try {
          const student = await Student.findOne({ username });
          if (!student) {
            return done(null, false, { message: "Incorrect username." });
          }
          const isMatch = await student.validPassword(password);
          if (!isMatch) {
            return done(null, false, { message: "Incorrect password." });
          }
          return done(null, student);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Student signup strategy
  passport.use(
    "student-signup",
    new LocalStrategy(
      { usernameField: "username", passReqToCallback: true },
      async (req, username, password, done) => {
        try {
          let student = await Student.findOne({ username });
          if (student) {
            return done(null, false, { message: "Username already exists." });
          }
          student = new Student(req.body);
          await student.save();
          return done(null, student);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      let user = await Admin.findById(id);
      if (!user) {
        user = await Student.findById(id);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
