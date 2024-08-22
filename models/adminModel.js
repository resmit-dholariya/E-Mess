const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Add other fields as needed
});

// Method to hash password before saving
adminSchema.pre("save", async function (next) {
  if (this.isModified("password") || this.isNew) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Method to compare given password with the hashed password
adminSchema.methods.validPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;
