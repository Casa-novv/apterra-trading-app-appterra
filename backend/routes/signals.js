const express = require('express');
const router = express.Router();
const Signal = require('../models/Signal'); // Assuming you have a Signal model

// Get all signals
router.get('/', async (req, res) => {
  try {
    const signals = await Signal.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(signals);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch signals', error: error.message });
  }
});

// Create new signal
router.post('/', async (req, res) => {
  try {
    const signal = new Signal(req.body);
    await signal.save();
    res.status(201).json(signal);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create signal', error: error.message });
  }
});

// Update signal status
router.patch('/:id', async (req, res) => {
  try {
    const signal = await Signal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!signal) {
      return res.status(404).json({ message: 'Signal not found' });
    }
    res.json(signal);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update signal', error: error.message });
  }
});

// Delete signal
router.delete('/:id', async (req, res) => {
  try {
    const signal = await Signal.findByIdAndDelete(req.params.id);
    if (!signal) {
      return res.status(404).json({ message: 'Signal not found' });
    }
    res.json({ message: 'Signal deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Failed to delete signal', error: error.message });
  }
});

module.exports = router;