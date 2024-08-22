const { ToWords } = require("to-words"); //npm i to-words
const toWords = new ToWords();

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
