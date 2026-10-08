const mongoose = require("mongoose");

// ==========================================
// LEGACY CLEANUP
// An older version of Impressa had a UNIQUE index on `phone`.
// Removing `unique: true` from the schema does NOT remove the
// index from MongoDB, so duplicate phone numbers kept failing.
// This drops ONLY a single-field unique index on `phone`.
// The username index and all other indexes are left alone.
// ==========================================

const dropLegacyPhoneUniqueIndex = async () => {
  try {
    const User = require("../models/User");

    const indexes = await User.collection.indexes();

    const legacyPhoneIndexes = indexes.filter(
      (index) =>
        index.unique &&
        index.key &&
        Object.keys(index.key).length === 1 &&
        Object.prototype.hasOwnProperty.call(index.key, "phone")
    );

    for (const index of legacyPhoneIndexes) {
      await User.collection.dropIndex(index.name);

      console.log(
        `Dropped legacy unique phone index "${index.name}" ✅`
      );
    }
  } catch (error) {
    // Collection doesn't exist yet (fresh database) — nothing to clean up
    if (
      error.code === 26 ||
      error.codeName === "NamespaceNotFound"
    ) {
      return;
    }

    console.error(
      "Could not check legacy phone index ⚠️",
      error.message
    );
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB Atlas connected successfully ✅");

    await dropLegacyPhoneUniqueIndex();
  } catch (error) {
    console.error("MongoDB connection failed ❌");
    console.error(error.message);

    throw error;
  }
};

module.exports = connectDB;