const mongoose = require("mongoose");

const monthsEnum = [
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

const monthlyFeesSchema = new mongoose.Schema({
  month: {
    type: String,
    enum: monthsEnum,
    required: true,
  },
  year: {
    type: Number,
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
  receiptsGenerated: {
    type: Number,
    default: 0,
  },
});

// Adding indexes for optimized queries
monthlyFeesSchema.index({ month: 1, year: 1, feeAmount: 1, pendingCount: 1 });

const MonthlyFees = mongoose.model("MonthlyFees", monthlyFeesSchema);
module.exports = MonthlyFees;
