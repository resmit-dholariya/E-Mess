const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const studentSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  roomNumber: {
    type: Number,
    required: true,
  },
  branch: {
    type: String,
    required: true,
  },
  batch: {
    type: Number,
    required: true,
  },
  gender: {
    type: String,
    required: true,
  },
  mobileNumber: {
    type: Number,
    required: true,
  },
  enrollmentNumber: {
    type: Number,
    required: true,
  },
  pendingFees: {
    type: Map,
    of: Boolean,
    default: {},
  },
  paymentDateTime: {
    type: Map,
    of: Date,
    default: {},
  },
});

// Method to hash password before saving
studentSchema.pre("save", async function (next) {
  if (this.isModified("password") || this.isNew) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Method to compare given password with the hashed password
studentSchema.methods.validPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const Student = mongoose.model("Student", studentSchema);

module.exports = Student;
