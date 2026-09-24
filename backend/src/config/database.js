const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB Atlas connected successfully ✅");
  } catch (error) {
    console.error("MongoDB connection failed ❌");
    console.error(error.message);

    throw error;
  }
};

module.exports = connectDB;