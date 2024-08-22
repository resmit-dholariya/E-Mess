const Student = require("../models/studentModel");
const MonthlyFees = require("../models/monthlyFeesModel");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const passport = require("passport");
const mongoose = require("mongoose");
const { ToWords } = require("to-words");
const toWords = new ToWords();

exports.getLoginPage = (req, res) => {
  res.render("adminLogin", { message: req.flash("error") });
};

exports.postLogin = passport.authenticate("admin-local", {
  successRedirect: "/admin/dashboard",
  failureRedirect: "/admin/login",
  failureFlash: true,
});

exports.getAdminPage = async (req, res) => {
  try {
    // Aggregation pipeline to calculate pendingMonthCount server-side and include serialNumber
    const students = await Student.aggregate([
      {
        $project: {
          fullName: 1,
          roomNumber: 1,
          batch: 1,
          mobileNumber: 1,
          pendingFees: 1,
          serialNumber: 1, // Include serialNumber
          pendingMonthCount: {
            $size: {
              $filter: {
                input: {
                  $objectToArray: { $ifNull: ["$pendingFees", {}] }, // Ensure pendingFees is not null
                },
                as: "item",
                cond: { $eq: ["$$item.v", true] },
              },
            },
          },
        },
      },
      {
        $sort: { roomNumber: 1 }, // Sort by roomNumber in ascending order
      },
    ]);

    res.render("adminDashboard", { students });
  } catch (err) {
    console.error("Error fetching admin page data:", err);
    res.status(500).send("Server Error");
  }
};

exports.getAddStudentPage = (req, res) => {
  res.render("adminAddStudent");
};

exports.addStudent = async (req, res) => {
  const {
    serialNumber,
    fullName,
    roomNumber,
    branch,
    batch,
    gender,
    mobileNumber,
    enrollmentNumber,
    username,
    password,
  } = req.body;

  try {
    const newStudent = new Student({
      serialNumber,
      fullName,
      roomNumber,
      branch,
      batch,
      gender,
      mobileNumber,
      enrollmentNumber,
      username,
      password,
      pendingFees: new Map(),
      paymentDateTime: new Map(),
      paymentMethod: new Map(),
      receiptNumber: new Map(),
    });

    await newStudent.save();
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.getViewStudentPage = async (req, res) => {
  try {
    // Fetch the student details along with pending fees and payment date/time
    const student = await Student.findById(req.params.studentId)
      .select(
        "fullName serialNumber roomNumber branch batch gender mobileNumber enrollmentNumber pendingFees paymentDateTime"
      )
      .lean(); // Use .lean() for faster performance

    // Fetch the list of monthly fees
    const monthlyFees = await MonthlyFees.find({})
      .select("month year feeAmount")
      .lean();

    // Pass the data to the template
    res.render("adminViewStudent", { student, monthlyFees });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    // Find the student to delete
    const student = await Student.findById(req.params.studentId);

    if (!student) {
      console.error(`Student with ID ${req.params.studentId} not found`);
      return res.status(404).send("Student not found");
    }

    // Collect bulk update operations for pending fees
    const bulkOperations = [];

    for (const [feeKey, isPending] of student.pendingFees.entries()) {
      if (isPending) {
        const [month, year] = feeKey.split(" ");

        bulkOperations.push({
          updateOne: {
            filter: { month, year },
            update: { $inc: { pendingCount: -1 } },
          },
        });
      }
    }

    // Execute bulk operations if there are pending fees
    if (bulkOperations.length > 0) {
      const result = await MonthlyFees.bulkWrite(bulkOperations);
    }

    // Delete the student
    await Student.findByIdAndDelete(req.params.studentId);

    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(`Server Error: ${err.message}`);
    res.status(500).send("Server Error");
  }
};

exports.getAddMonthlyFeesPage = async (req, res) => {
  try {
    // Define the months and years arrays
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

    // Fetch only required fields from the database
    const monthlyFees = await MonthlyFees.find(
      {},
      "month year feeAmount pendingCount"
    ).lean();

    // Calculate total pending amount and grand total
    let grandTotal = 0;
    const feesWithPendingAmount = monthlyFees.map((fee) => {
      const pendingAmount = fee.feeAmount * fee.pendingCount;
      grandTotal += pendingAmount;
      return { ...fee, pendingAmount };
    });

    // Get error message from query parameters if present
    const errorMessage = req.query.error || "";

    // Render the page with the calculated data and months/years
    res.render("adminAddFees", {
      feesWithPendingAmount,
      grandTotal,
      errorMessage,
      months,
      years, // Pass the years array to the template
    });
  } catch (err) {
    console.error(`Error fetching monthly fees: ${err.message}`);
    res.status(500).send("Server Error");
  }
};

exports.addMonthlyFees = async (req, res) => {
  const { month, year, feeAmount } = req.body;

  try {
    // Validate inputs
    if (!month || !year || !feeAmount || isNaN(feeAmount)) {
      return res.status(400).send("Invalid input data");
    }

    // Check if the monthly fees already exist
    const existingFees = await MonthlyFees.findOne({ month, year });

    if (existingFees) {
      return res.redirect(
        "/admin/add-monthly-fees?error=Fees for this month already exist"
      );
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create new MonthlyFees entry
      const newMonthlyFees = new MonthlyFees({
        month,
        year,
        feeAmount,
        pendingCount: 0,
      });
      await newMonthlyFees.save({ session });

      // Use bulk update to set pending fees for all students
      const updateResult = await Student.updateMany(
        {},
        { $set: { [`pendingFees.${month} ${year}`]: true } },
        { session }
      );

      // Update the newly created MonthlyFees with the count of students
      newMonthlyFees.pendingCount = updateResult.modifiedCount;
      await newMonthlyFees.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      res.redirect("/admin/add-monthly-fees");
    } catch (error) {
      // Abort the transaction in case of error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.markFeeAsPaid = async (req, res) => {
  const { studentId, feeKey } = req.params;
  const { paymentMethod } = req.body;

  try {
    // Validate payment method
    if (!["Online", "Cash"].includes(paymentMethod)) {
      console.error(`Invalid payment method: ${paymentMethod}`);
      return res.status(400).send("Invalid payment method");
    }

    const [month, year] = feeKey.split(" ");

    // Update the student's payment status
    const studentUpdateResult = await Student.updateOne(
      { _id: studentId },
      {
        $set: {
          [`pendingFees.${feeKey}`]: false,
          [`paymentDateTime.${feeKey}`]: new Date(),
          [`paymentMethod.${feeKey}`]: paymentMethod,
        },
      }
    );

    if (studentUpdateResult.modifiedCount === 0) {
      console.error(
        `Student with ID ${studentId} not found or feeKey ${feeKey} not found`
      );
      return res.status(404).send("Student or fee not found");
    }

    // Update the monthly fees record
    const monthlyFeesUpdateResult = await MonthlyFees.findOneAndUpdate(
      { month, year },
      {
        $inc: { pendingCount: -1, receiptsGenerated: 1 },
      },
      { new: true }
    );

    if (!monthlyFeesUpdateResult) {
      console.error(`MonthlyFees entry for ${month} ${year} not found`);
      return res.status(404).send("MonthlyFees entry not found");
    }

    // Update the student's receipt number for the given feeKey
    await Student.updateOne(
      { _id: studentId },
      {
        $set: {
          [`receiptNumber.${feeKey}`]:
            monthlyFeesUpdateResult.receiptsGenerated,
        },
      }
    );

    // Redirect to the student view page after successful updates
    res.redirect(`/admin/view-student/${studentId}`);
  } catch (error) {
    console.error("Error in markFeeAsPaid:", error);
    res.status(500).send("Server Error");
  }
};

exports.deleteMonthlyFees = async (req, res) => {
  const { feeId } = req.params;

  try {
    // Find the monthly fee entry
    const monthlyFee = await MonthlyFees.findById(feeId);

    if (!monthlyFee) {
      return res.status(404).send("Monthly fee not found");
    }

    const feeKey = `${monthlyFee.month} ${monthlyFee.year}`;

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Use bulk update operation to remove the fee entry from all students
      await Student.updateMany(
        {},
        {
          $unset: {
            [`pendingFees.${feeKey}`]: "",
            [`paymentDateTime.${feeKey}`]: "",
            [`paymentMethod.${feeKey}`]: "",
            [`receiptNumber.${feeKey}`]: "",
          },
        },
        { session }
      );

      // Delete the monthly fee entry
      await MonthlyFees.findByIdAndDelete(feeId, { session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      res.redirect("/admin/add-monthly-fees");
    } catch (transactionError) {
      // Abort the transaction on error
      await session.abortTransaction();
      session.endSession();
      console.error("Transaction error:", transactionError);
      res.status(500).send("Server Error");
    }
  } catch (err) {
    console.error("Error in deleteMonthlyFees:", err);
    res.status(500).send("Server Error");
  }
};

exports.generateReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).send("Month and year are required");
    }

    // Fetch students with pending fees for the specified month and year
    const feeKey = `${month} ${year}`;
    const students = await Student.find({
      [`pendingFees.${feeKey}`]: true,
    })
      .select("fullName roomNumber batch mobileNumber gender")
      .lean(); // Use .lean() for better performance with large datasets

    if (students.length === 0) {
      return res
        .status(404)
        .send("No pending fees for the specified month and year");
    }

    // Separate students by gender
    const boys = students.filter(
      (student) => student.gender.toLowerCase() === "male"
    );
    const girls = students.filter(
      (student) => student.gender.toLowerCase() === "female"
    );

    // Sort students by room number
    boys.sort((a, b) => a.roomNumber - b.roomNumber);
    girls.sort((a, b) => a.roomNumber - b.roomNumber);

    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Function to add a sheet with students
    const addSheetWithStudents = (sheetName, students) => {
      const worksheet = workbook.addWorksheet(sheetName);

      // Define and add title rows
      const titleRows = [
        "GOVERNMENT ENGINEERING COLLEGE MODASA",
        "HOSTEL BLOCK - E",
        "MESS FACILITY MONTHLY REPORT",
        `MONTH: ${month} ${year}`,
        `GENDER: ${sheetName}`,
      ];

      titleRows.forEach((text, index) => {
        const row = worksheet.addRow([text]);
        row.font = { size: index < 4 ? 14 : 12, bold: index < 4 }; // Larger font size and bold for the first 4 rows
        row.alignment = { horizontal: "center", wrapText: true };
        worksheet.mergeCells(row.number, 1, row.number, 4); // Merge cells for title rows
      });

      // Add empty rows for spacing
      worksheet.addRow([]);
      worksheet.addRow([]);

      // Add description row
      worksheet.addRow([
        "The following students are requested to pay the fees by the end of this month",
      ]);

      // Add another empty row
      worksheet.addRow([]);

      // Add table headers
      const headerRow = worksheet.addRow([
        "Full Name",
        "Room Number",
        "Batch",
        "Mobile Number",
      ]);

      // Style table header
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Add data rows
      students.forEach((student) => {
        const row = worksheet.addRow([
          student.fullName,
          student.roomNumber,
          student.batch,
          student.mobileNumber,
        ]);

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Set column widths
      worksheet.columns = [
        { width: 40 }, // Wider width for "Full Name"
        { width: 15 },
        { width: 10 },
        { width: 20 },
      ];
    };

    // Add sheets for boys and girls
    addSheetWithStudents("Boys", boys);
    addSheetWithStudents("Girls", girls);

    // Set response headers and write the file to the response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${month}_${year}_pending_fees.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).send("Error generating report");
  }
};

exports.downloadAllStudents = async (req, res) => {
  try {
    // Fetch all students with necessary fields
    const students = await Student.find(
      {},
      "fullName roomNumber batch mobileNumber pendingFees gender"
    ).lean();

    // Separate students by gender
    const boys = students.filter(
      (student) => student.gender.toLowerCase() === "male"
    );
    const girls = students.filter(
      (student) => student.gender.toLowerCase() === "female"
    );

    // Sort students by room number
    boys.sort((a, b) => a.roomNumber - b.roomNumber);
    girls.sort((a, b) => a.roomNumber - b.roomNumber);

    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Function to add a sheet with students
    const addSheetWithStudents = (sheetName, students) => {
      const worksheet = workbook.addWorksheet(sheetName);

      // Define the title rows
      const titleRows = [
        "GOVERNMENT ENGINEERING COLLEGE MODASA",
        "HOSTEL BLOCK - E",
        "MESS FACILITY STUDENTS LIST",
        `GENDER: ${sheetName}`,
      ];

      // Define the number of columns to merge for title rows
      const numColumns = 5; // Adjust based on your table width

      // Add title rows with merged columns
      titleRows.forEach((text, index) => {
        const row = worksheet.addRow([text]);
        row.font = { size: 14, bold: true }; // Larger text size and bold
        row.alignment = { horizontal: "center", wrapText: true };
        worksheet.mergeCells(row.number, 1, row.number, numColumns); // Merge columns for the title rows
      });

      // Add an empty row
      worksheet.addRow([]);

      // Add table headers
      const headerRow = worksheet.addRow([
        "Full Name",
        "Room Number",
        "Batch",
        "Mobile Number",
        "Pending Months",
      ]);

      // Style table header
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Process each student and add data rows
      students.forEach((student) => {
        const pendingMonthCount = student.pendingFees
          ? Object.values(student.pendingFees).filter((isPending) => isPending)
              .length
          : 0;

        const row = worksheet.addRow([
          student.fullName,
          student.roomNumber,
          student.batch,
          student.mobileNumber,
          pendingMonthCount,
        ]);

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Set column widths
      worksheet.columns = [
        { width: 30 }, // Full Name
        { width: 15 }, // Room Number
        { width: 10 }, // Batch
        { width: 20 }, // Mobile Number
        { width: 15 }, // Pending Months
      ];
    };

    // Add sheets for boys and girls
    addSheetWithStudents("Boys", boys);
    addSheetWithStudents("Girls", girls);

    // Set response headers and write the file to the response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=student_details.xlsx`
    );

    // Write workbook to response stream
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating student details report:", error);
    res.status(500).send("Error generating student details report");
  }
};

exports.downloadBasicStudents = async (req, res) => {
  try {
    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Helper function to create a worksheet with student details
    const addStudentWorksheet = (sheetName, students) => {
      const worksheet = workbook.addWorksheet(sheetName);

      // Define title rows and merge columns
      const titleRows = [
        "GOVERNMENT ENGINEERING COLLEGE MODASA",
        "HOSTEL BLOCK - E",
        "MESS FACILITY STUDENTS LIST",
      ];
      const numColumns = 5; // Adjust based on your table width

      titleRows.forEach((text, index) => {
        const row = worksheet.addRow([text]);
        row.font = { size: 14, bold: true }; // Larger text size and bold
        row.alignment = { horizontal: "center", wrapText: true };
        worksheet.mergeCells(row.number, 1, row.number, numColumns); // Merge columns for title rows
      });

      worksheet.addRow([]); // Add an empty row

      // Add table headers
      const headerRow = worksheet.addRow([
        "Full Name",
        "Room Number",
        "Batch",
        "", // Placeholder for Extra Column 1
        "", // Placeholder for Extra Column 2
      ]);

      // Style table header
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Add data rows
      students.forEach((student) => {
        const row = worksheet.addRow([
          student.fullName,
          student.roomNumber,
          student.batch,
          "", // Placeholder for Extra Column 1
          "", // Placeholder for Extra Column 2
        ]);

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Set column widths
      worksheet.columns = [
        { width: 30 }, // Full Name
        { width: 15 }, // Room Number
        { width: 10 }, // Batch
        { width: 20 }, // Extra Column 1
        { width: 20 }, // Extra Column 2
      ];
    };

    // Retrieve all students and include gender
    const students = await Student.find(
      {},
      "fullName roomNumber batch gender"
    ).lean();

    // Separate students by gender and sort by room number
    const maleStudents = students
      .filter((student) => student.gender.toLowerCase() === "male")
      .sort((a, b) => a.roomNumber - b.roomNumber);

    const femaleStudents = students
      .filter((student) => student.gender.toLowerCase() === "female")
      .sort((a, b) => a.roomNumber - b.roomNumber);

    // Add separate worksheets for male and female students
    addStudentWorksheet("Male Students", maleStudents);
    addStudentWorksheet("Female Students", femaleStudents);

    // Set response headers and write the file to the response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=basic_student_details.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating basic student details report:", error);
    res.status(500).send("Error generating basic student details report");
  }
};

exports.downloadReceipt = async (req, res) => {
  try {
    const { studentId, month, year } = req.params;
    const feeKey = `${month} ${year}`;

    // Fetch student and monthly fees data concurrently
    const [student, monthlyFees] = await Promise.all([
      Student.findById(studentId).lean(),
      MonthlyFees.findOne({ month, year }).lean(),
    ]);

    if (!student) {
      console.error(`Student with ID ${studentId} not found`);
      return res.status(404).send("Student not found");
    }

    if (!monthlyFees) {
      console.error(`MonthlyFees entry for ${month} ${year} not found`);
      return res.status(400).send("Monthly fees entry not found");
    }

    const paymentDate = student.paymentDateTime?.[feeKey];

    if (!paymentDate) {
      console.error(`Payment date not found for feeKey ${feeKey}`);
      return res.status(400).send("Payment date not found for the feeKey");
    }

    const doc = new PDFDocument({ size: [420, 298], margin: 10 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt_${student.fullName}_${feeKey}.pdf`
    );
    doc.pipe(res);

    // Title Section - Bold
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(9)
      .text("Ranawat Sawaisingh (Mess Contractor)", {
        align: "center",
      });

    doc
      .font("Helvetica-Bold")
      .moveDown(0.5)
      .fontSize(12)
      .text("GOVERNMENT ENGINEERING COLLEGE HOSTEL", {
        align: "center",
      })
      .fontSize(8)
      .text("Modasa, Dist - Arvalli", { align: "center" })
      .moveDown(0.5);

    doc
      .moveTo(doc.x, doc.y)
      .lineTo(doc.page.width - 10, doc.y)
      .stroke();

    const startX = 10;
    let startY = doc.y + 10;
    const rowHeight = 18;
    const rowSpacing = 6;

    // Draw Table Cell Function with Bold Labels
    const drawTableCell = (x, y, text, width, bold = false) => {
      doc.rect(x, y, width, rowHeight).stroke();
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").text(text, x + 5, y + 5, {
        width: width - 10,
        align: "left",
      });
    };

    function formatDateTime(date) {
      const dateOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
      const timeOptions = { hour: "2-digit", minute: "2-digit", hour12: true };

      const formattedDate = new Date(date).toLocaleDateString(
        "en-GB",
        dateOptions
      );
      const formattedTime = new Date(date).toLocaleTimeString(
        "en-US",
        timeOptions
      );

      return `${formattedDate} ${formattedTime}`;
    }

    drawTableCell(startX, startY, "Receipt No.", 55, true);
    drawTableCell(
      startX + 55,
      startY,
      student.receiptNumber?.[feeKey] || "0",
      45
    );
    drawTableCell(startX + 110, startY, "Sr. No.", 40, true);
    drawTableCell(startX + 150, startY, student.serialNumber, 70);
    drawTableCell(startX + 230, startY, "Receipt Date", 65, true);
    drawTableCell(startX + 295, startY, formatDateTime(paymentDate), 105);

    startY += rowHeight + rowSpacing;
    drawTableCell(startX, startY, "Room No.", 55, true);
    drawTableCell(startX + 55, startY, student.roomNumber, 45);
    drawTableCell(startX + 110, startY, "Branch", 40, true);
    drawTableCell(startX + 150, startY, student.branch, 70);
    drawTableCell(startX + 230, startY, "Month", 65, true);
    drawTableCell(startX + 295, startY, `${month} ${year}`, 105);

    startY += rowHeight + rowSpacing;
    drawTableCell(startX, startY, "Student Name", 82, true);
    drawTableCell(startX + 82, startY, student.fullName, 318);

    startY += rowHeight + rowSpacing;
    drawTableCell(startX, startY, "Enrollment No.", 82, true);
    drawTableCell(startX + 82, startY, student.enrollmentNumber, 115);
    drawTableCell(startX + 205, startY, "Mobile No.", 80, true);
    drawTableCell(startX + 285, startY, student.mobileNumber, 115);

    startY += rowHeight + rowSpacing;
    drawTableCell(startX, startY, "Amount", 82, true);
    drawTableCell(startX + 82, startY, monthlyFees.feeAmount, 115);
    drawTableCell(startX + 205, startY, "Payment Mode", 80, true);
    drawTableCell(startX + 285, startY, student.paymentMethod?.[feeKey], 115);

    startY += rowHeight + rowSpacing;
    drawTableCell(startX, startY, "Amount (in Words)", 82, true);
    drawTableCell(
      startX + 82,
      startY,
      `${toWords.convert(monthlyFees.feeAmount)} Rupees Only`,
      318
    );

    // Move down the signature section by increasing startY
    startY += rowHeight + rowSpacing + 40; // Add additional space by increasing this value

    doc.font("Helvetica-Bold").text("SIGNATURE", startX + 300, startY);

    doc.font("Helvetica").text("Sawaisingh Ranawat", startX + 287, startY + 10);
    doc
      .font("Helvetica")
      .text("(Hostel Mess Contractor)", startX + 280, startY + 20);

    doc.end();
  } catch (err) {
    console.error("Error in downloadReceipt:", err);
    res.status(500).send("Server Error");
  }
};

exports.getFeesCollectionReportPage = (req, res) => {
  res.render("adminFeesCollectionReport", { message: req.flash("error") });
};

exports.generateFeesCollectionReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Fetch students with paymentDateTime and paymentMethod fields
    const students = await Student.find(
      {},
      "fullName batch roomNumber mobileNumber paymentDateTime paymentMethod gender"
    );

    // Separate payments by method and gender
    const payments = {
      Online: { Male: [], Female: [] },
      Cash: { Male: [], Female: [] },
    };

    for (const student of students) {
      for (const [feeKey, paymentDate] of student.paymentDateTime) {
        const paymentDateObj = new Date(paymentDate);

        // Check if payment date is within the specified range
        if (paymentDateObj >= start && paymentDateObj <= end) {
          const paymentMethod = student.paymentMethod.get(feeKey);
          const [month, year] = feeKey.split(" ");
          const monthlyFees = await MonthlyFees.findOne({ month, year }).select(
            "feeAmount"
          );
          const amount = monthlyFees ? monthlyFees.feeAmount : 0;

          const feeDetails = {
            fullName: student.fullName,
            batch: student.batch,
            roomNumber: student.roomNumber,
            mobileNumber: student.mobileNumber,
            paymentDate: paymentDateObj,
            month: feeKey,
            amount: amount,
          };

          // Add payment details to the corresponding payment method and gender array
          if (payments[paymentMethod]) {
            const genderKey =
              student.gender.toLowerCase() === "male" ? "Male" : "Female";
            payments[paymentMethod][genderKey].push(feeDetails);
          }
        }
      }
    }

    // Sort payments by room number
    const sortByRoomNumber = (data) => {
      return data.sort((a, b) => a.roomNumber - b.roomNumber);
    };

    // Format date
    const formatDate = (date, format) => {
      const options =
        format === "MMM"
          ? { day: "2-digit", month: "short", year: "numeric" }
          : { day: "2-digit", month: "2-digit", year: "numeric" };
      return new Intl.DateTimeFormat("en-GB", options).format(date);
    };

    const formattedStartDate = formatDate(start, "MMM");
    const formattedEndDate = formatDate(end, "MMM");

    const titleRows = [
      "GOVERNMENT ENGINEERING COLLEGE MODASA",
      "HOSTEL BLOCK - E",
      "FEE COLLECTION REPORT",
      `INTERVAL: ${formattedStartDate} TO ${formattedEndDate}`,
    ];

    const workbook = new ExcelJS.Workbook();

    // Function to add a sheet with students
    const addSheetWithStudents = (sheetName, students) => {
      const worksheet = workbook.addWorksheet(sheetName);

      // Define the title rows
      titleRows.forEach((title, index) => {
        const cell = worksheet.getCell(`A${index + 1}`);
        cell.value = title;
        cell.alignment = { horizontal: "center" };
        worksheet.mergeCells(`A${index + 1}:G${index + 1}`);
      });

      worksheet.addRow([]);
      worksheet.addRow([
        "Full Name",
        "Batch",
        "Room Number",
        "Mobile Number",
        "Payment Date",
        "Month",
        "Amount",
      ]);

      // Style table header
      worksheet.getRow(2).eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Add rows and set column widths
      const columnWidths = [25, 10, 15, 15, 20, 15, 20];
      columnWidths.forEach(
        (width, index) => (worksheet.getColumn(index + 1).width = width)
      );

      if (students.length > 0) {
        // Sort students by room number
        const sortedStudents = sortByRoomNumber(students);

        sortedStudents.forEach((payment) =>
          worksheet.addRow([
            payment.fullName,
            payment.batch,
            payment.roomNumber,
            payment.mobileNumber,
            payment.paymentDate,
            payment.month,
            payment.amount,
          ])
        );

        worksheet.addRow([]);
        const totalRow = worksheet.addRow([]);
        totalRow.getCell(6).value = "Total";
        totalRow.getCell(7).value = students.reduce(
          (sum, payment) => sum + payment.amount,
          0
        );

        // Add borders to total row
        worksheet.eachRow({ includeEmpty: true }, (row) => {
          row.eachCell({ includeEmpty: true }, (cell) => {
            if (row.number === totalRow.number) {
              if (cell.col === 6 || cell.col === 7) {
                cell.border = {
                  top: { style: "thin" },
                  left: { style: "thin" },
                  bottom: { style: "thin" },
                  right: { style: "thin" },
                };
              }
            } else {
              cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              };
            }
          });
        });
      } else {
        worksheet.addRow(["No data available for the selected date range"]);
      }
    };

    // Add sheets for different categories
    addSheetWithStudents(
      "Online Payments Boys",
      sortByRoomNumber(payments.Online.Male)
    );
    addSheetWithStudents(
      "Cash Payments Boys",
      sortByRoomNumber(payments.Cash.Male)
    );
    addSheetWithStudents(
      "Online Payments Girls",
      sortByRoomNumber(payments.Online.Female)
    );
    addSheetWithStudents(
      "Cash Payments Girls",
      sortByRoomNumber(payments.Cash.Female)
    );

    // Set response headers and write the file to the response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Fee_Collection_Report_${formattedStartDate}_to_${formattedEndDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating fee collection report:", error);
    res.status(500).send("Server Error");
  }
};

exports.updateRoomNumber = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const newRoomNumber = req.body.newRoomNumber;

    // Validate the new room number
    if (!newRoomNumber || typeof newRoomNumber !== "string") {
      return res.status(400).send("Invalid room number");
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).send("Student not found");
    }

    student.roomNumber = newRoomNumber;
    await student.save();

    // Optionally, redirect with a success message or render a success page
    res.redirect(
      `/admin/view-student/${studentId}?success=Room number updated`
    );
  } catch (err) {
    console.error("Error updating room number:", err);
    res.status(500).send("Server Error");
  }
};

exports.updateEnrollmentNumber = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const newEnrollmentNumber = req.body.newEnrollmentNumber;

    // Validate the new enrollment number
    if (!newEnrollmentNumber || typeof newEnrollmentNumber !== "string") {
      return res.status(400).send("Invalid enrollment number");
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).send("Student not found");
    }

    student.enrollmentNumber = newEnrollmentNumber;
    await student.save();

    // Optionally, redirect with a success message or render a success page
    res.redirect(
      `/admin/view-student/${studentId}?success=Enrollment number updated`
    );
  } catch (err) {
    console.error("Error updating enrollment number:", err);
    res.status(500).send("Server Error");
  }
};

exports.searchStudents = async (req, res) => {
  const query = req.query.query?.trim(); // Trim the query to remove extra spaces

  // Attempt to parse the query as a number
  const queryAsNumber = parseFloat(query);

  // Convert the gender query to lowercase for case-insensitive comparison
  const queryGender = query?.toLowerCase();

  // Create the search criteria
  const searchCriteria = {
    $or: [
      { fullName: { $regex: query, $options: "i" } },
      { roomNumber: !isNaN(queryAsNumber) ? queryAsNumber : null },
      { branch: { $regex: query, $options: "i" } },
      { batch: !isNaN(queryAsNumber) ? queryAsNumber : null },
      { gender: { $regex: `^${queryGender}$`, $options: "i" } },
    ].filter((criteria) => criteria !== null), // Remove null criteria
  };

  try {
    // Fetch students based on the search criteria and sort by room number
    const students = await Student.find(searchCriteria)
      .lean() // Return plain JS objects
      .sort({ roomNumber: 1 }); // Sort by roomNumber

    // Calculate pending months count and ensure pendingFees is defined
    const studentsWithPendingCount = students.map((student) => {
      const pendingMonthCount = student.pendingFees
        ? Array.from(Object.values(student.pendingFees)).filter(
            (isPending) => isPending
          ).length
        : 0;

      return {
        ...student,
        pendingMonthCount,
      };
    });

    res.render("adminDashboard", {
      students: studentsWithPendingCount,
    });
  } catch (err) {
    console.error("Error searching students:", err);
    res.status(500).send("Server Error");
  }
};

exports.updateFeeAmount = async (req, res) => {
  const { feeKey, newFeeAmount } = req.body;
  const studentId = req.query.studentId; // Get studentId from query parameters

  try {
    const [month, year] = feeKey.split(" ");

    // Find the fee record and update the amount
    const result = await MonthlyFees.updateOne(
      { month, year },
      { $set: { feeAmount: newFeeAmount } }
    );

    if (result.modifiedCount === 0) {
      throw new Error("Failed to update fee amount");
    }

    // Redirect to the view student page with the student ID
    res.redirect(`/admin/view-student/${studentId}`);
  } catch (err) {
    console.error("Error updating fee amount:", err);
    res.status(500).send("Server Error");
  }
};
