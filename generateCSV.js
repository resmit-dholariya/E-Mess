const fs = require("fs");
const { createObjectCsvWriter } = require("csv-writer");
const { faker } = require("@faker-js/faker"); // Updated import

// Function to generate random students with unique usernames
const generateStudents = (num) => {
  const students = new Set();
  while (students.size < num) {
    const username = faker.internet.userName();

    // Ensure the username is unique and not null
    if (
      username &&
      ![...students].some((student) => student.username === username)
    ) {
      students.add({
        username,
        password: faker.internet.password(),
        email: faker.internet.email(),
        fullName: faker.person.fullName(), // Updated method
        roomNumber: faker.number.int({ min: 1, max: 100 }), // Updated method
        branch: faker.helpers.arrayElement([
          "Computer Science",
          "Electrical",
          "Mechanical",
          "Civil",
        ]), // Corrected method
        batch: faker.number.int({ min: 2010, max: 2024 }), // Updated method
        gender: faker.person.gender(), // Updated method
        mobileNumber: faker.phone.number("##########"), // Updated method
        enrollmentNumber: faker.number.int({ min: 1000, max: 9999 }), // Updated method
        pendingFees: JSON.stringify({
          "January 2024": faker.datatype.boolean(),
        }), // Updated method
        paymentDateTime: JSON.stringify({
          "January 2024": faker.date.past().toISOString(),
        }), // Updated method
        paymentMethod: JSON.stringify({
          "January 2024": faker.helpers.arrayElement(["Online", "Cash"]),
        }), // Corrected method
        receiptNumber: JSON.stringify({
          "January 2024": faker.number.int({ min: 10000, max: 99999 }),
        }), // Updated method
      });
    }
  }
  return [...students];
};

// Define the CSV writer
const csvWriter = createObjectCsvWriter({
  path: "students.csv",
  header: [
    { id: "username", title: "Username" },
    { id: "password", title: "Password" },
    { id: "email", title: "Email" },
    { id: "fullName", title: "Full Name" },
    { id: "roomNumber", title: "Room Number" },
    { id: "branch", title: "Branch" },
    { id: "batch", title: "Batch" },
    { id: "gender", title: "Gender" },
    { id: "mobileNumber", title: "Mobile Number" },
    { id: "enrollmentNumber", title: "Enrollment Number" },
    { id: "pendingFees", title: "Pending Fees" },
    { id: "paymentDateTime", title: "Payment DateTime" },
    { id: "paymentMethod", title: "Payment Method" },
    { id: "receiptNumber", title: "Receipt Number" },
  ],
});

// Generate 600 students and write to CSV
const students = generateStudents(600);

csvWriter
  .writeRecords(students)
  .then(() => {
    console.log("CSV file created successfully.");
  })
  .catch((err) => {
    console.error("Error writing CSV file:", err);
  });
