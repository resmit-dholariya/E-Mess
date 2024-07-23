// models/monthlyFees.js
const mongoose = require("mongoose");

const monthlyFeesSchema = new mongoose.Schema({
  month: {
    type: String,
    required: true,
  },
  year: {
    type: String,
    required: true,
  },
  feeAmount: {
    type: Number,
    required: true,
  },
  pendingCount: {
    type: Number,
    default: 0,
  },
  paidDate: {
    type: Date,
    default: null,
  },
});

const MonthlyFees = mongoose.model("MonthlyFees", monthlyFeesSchema);
module.exports = MonthlyFees;
