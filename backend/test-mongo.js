// test-mongo.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('❌ MONGO_URI not found in .env');
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

(async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Connected & pinged successfully!');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  } finally {
    await client.close();
    console.log('🔌 Disconnected.');
  }
})();