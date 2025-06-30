require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    console.log('MongoDB URI:', process.env.MONGO_URI ? 'Set' : 'Not set');
    
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI not found in .env file');
      return;
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ MongoDB connection successful!');
    console.log('Host:', conn.connection.host);
    console.log('Database:', conn.connection.name);
    console.log('Ready state:', conn.connection.readyState);

    await mongoose.connection.close();
    console.log('✅ Connection closed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.error('🔒 Your IP (197.248.68.197) needs to be whitelisted in MongoDB Atlas');
      console.error('📝 Steps to fix:');
      console.error('   1. Go to MongoDB Atlas dashboard');
      console.error('   2. Click "Network Access" in the left sidebar');
      console.error('   3. Click "Add IP Address"');
      console.error('   4. Add 197.248.68.197 or click "Allow Access from Anywhere" for testing');
    }
    
    if (error.message.includes('authentication')) {
      console.error('🔐 Authentication failed. Check your username/password in the MongoDB URI');
    }

    process.exit(1);
  }
}

testConnection();