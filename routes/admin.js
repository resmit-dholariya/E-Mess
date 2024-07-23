// routes/admin.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin");
const { ensureAuthenticated } = require("../middleware/auth");

// Login route
router.get("/login", adminController.getLoginPage);
router.post("/login", adminController.postLogin);
router.get("/", ensureAuthenticated, adminController.getAdminPage);
router.get("/add-student", ensureAuthenticated, adminController.getAddStudentPage);
router.post("/add-student", ensureAuthenticated, adminController.addStudent);
router.get("/view-student/:studentId", ensureAuthenticated, adminController.getViewStudentPage);
router.post("/delete-student/:studentId", ensureAuthenticated, adminController.deleteStudent);
router.get("/add-monthly-fees", ensureAuthenticated, adminController.getAddMonthlyFeesPage);
router.post("/add-monthly-fees", ensureAuthenticated, adminController.addMonthlyFees);
router.post("/delete-monthly-fees/:feeId", ensureAuthenticated, adminController.deleteMonthlyFees);
router.get("/generate-report", ensureAuthenticated, adminController.generateReport);
router.get("/download-all-students", ensureAuthenticated, adminController.downloadAllStudents);
router.get("/download-basic-students", ensureAuthenticated, adminController.downloadBasicStudents);
router.post("/mark-fee-as-paid/:studentId/:feeKey", ensureAuthenticated, adminController.markFeeAsPaid);
router.get("/download-receipt/:studentId/:month/:year", ensureAuthenticated, adminController.downloadReceipt);

module.exports = router;
