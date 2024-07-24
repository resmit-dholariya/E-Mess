const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");

router.get("/login", studentController.getLogin);
router.post("/login", studentController.postLogin);
router.get("/dashboard", studentController.getDashboard);
router.get("/logout", studentController.logout);

module.exports = router;
