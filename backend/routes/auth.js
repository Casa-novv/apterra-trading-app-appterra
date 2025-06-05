const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DemoAccount = require('../models/DemoAccount'); // Add this at the top
const router = express.Router();

// Register route
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body; // Note: Expecting email, password, and name
  try {
    // Check if the user already exists (by email)
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ msg: 'User already exists' });
    }
    // Hash the password before saving
    const hashed = await bcrypt.hash(password, 10);
    // Create and save the new user
    const user = new User({ email, name, password: hashed });
    await user.save();

    // --- Create demo account for new user ---
    await DemoAccount.create({ user: user._id });

    res.json({ msg: 'User registered' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body; // Now expecting email and password
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