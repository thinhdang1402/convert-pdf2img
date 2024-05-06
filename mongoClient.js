const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGO_URI;

const dbName = "nhandan-souvenir";

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to the MongoDB");

    const db = client.db(dbName);
    return db;
  } catch (err) {
    console.error("Error connecting to the MongoDB database:", err);
    throw err;
  }
}

module.exports = { connectToDatabase };
