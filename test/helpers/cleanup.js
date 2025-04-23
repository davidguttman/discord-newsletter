const mongoose = require("../../lib/mongo");

async function cleanup() {
  try {
    const mongoose = require("mongoose");

    // Only attempt to drop collections if connected
    if (mongoose.connection.readyState === 1) {
      const collections = await mongoose.connection.db.collections();
      for (const collection of collections) {
        try {
          await collection.drop();
        } catch (err) {
          // Ignore "ns not found" errors, which occur if the collection was already dropped
          if (err.message !== "ns not found") {
            console.warn(
              `Error dropping collection ${collection.collectionName}:`,
              err.message
            );
          }
        }
      }
    }

    if (mongoose.connection) {
      await mongoose.connection.close();
    }
  } catch (err) {
    console.error("Error during cleanup:", err);
  }
}

// Ensure cleanup happens on process exit
process.on("exit", cleanup);

module.exports = cleanup;
