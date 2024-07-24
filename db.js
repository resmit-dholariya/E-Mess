const mongoose = require("mongoose");

const url = process.env.mongo_url;
const connectmongodb = async () => {
  try {
      await mongoose.connect(url);
      console.log("database is connected....")

  } catch (error) {
      console.log("database is not connected")

  }
}
module.exports = connectmongodb;