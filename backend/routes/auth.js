const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DemoAccount = require('../models/DemoAccount'); // Add this at the top
const router = express.Router();

// Helper function to check database connection
const isDatabaseConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Register route
router.post('/register', async (req, res) => {
  // Check if database is connected
  if (!isDatabaseConnected()) {
    return res.status(503).json({ 
      msg: 'Database not available. Please try again later.',
      error: 'SERVICE_UNAVAILABLE'
    });
  }
  
  try {
    const { username, email, password } = req.body;
    
    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ msg: 'Username already taken' });
    }
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ msg: 'Email already registered' });
    }
    
    // Create user with username
    const user = new User({ username, email, password });
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body; // Now expecting email and password
  
  // Check if database is connected
  if (!isDatabaseConnected()) {
    return res.status(503).json({ 
      msg: 'Database not available. Please try again later.',
      error: 'SERVICE_UNAVAILABLE'
    });
  }
  
  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    // Sign a JWT token with the user's ID
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });
    // Return the token and some user info
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar, // <-- Include avatar here
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Verify route: needed by your front end's verifyToken call
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(401)
      .json({ msg: 'No token provided. Authorization header missing.' });
  }
  // Expecting header like "Bearer <token>"
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ msg: 'Invalid or expired token' });
    }
    res.json({ success: true, user: decoded });
  });
});

module.exports = router;