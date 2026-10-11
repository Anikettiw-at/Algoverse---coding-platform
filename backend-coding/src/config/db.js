const mongoose = require('mongoose');

async function main() {
    // Both env variable names supported + fallback check
    const dbURI = process.env.DB_CONNECT_STRING || process.env.MONGO_URI;

    if (!dbURI) {
        throw new Error("❌ MongoDB connection string is missing in .env file! Check DB_CONNECT_STRING or MONGO_URI.");
    }

    await mongoose.connect(dbURI);
}

module.exports = main;