const { MongoClient } = require('mongodb');

// ✅ Replace with your actual credentials (and URL-encode special characters in password!)
const uri = "mongodb+srv://casa-novv:2efmygehW80QCuwT@cluster0.ivzcdxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a new MongoClient
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
});

async function run() {
  try {
    console.log("🔍 Attempting to connect...");
    await client.connect();
    console.log("✅ Connected to MongoDB!");
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Ping successful!");
  } catch (err) {
    console.error("❌ Connection error:", err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await client.close();
    console.log("🔌 Connection closed.");
  }
}

run();
