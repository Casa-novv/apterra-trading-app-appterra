const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ... your MongoDB and routes setup ...

const server = http.createServer(app);

// --- WebSocket setup ---
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');

  // Send a welcome message
  ws.send(JSON.stringify({ type: 'welcome', message: 'WebSocket connection established!' }));

  // Example: Broadcast a message to all clients every 5 seconds
  const interval = setInterval(() => {
    ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date() }));
  }, 5000);

  ws.on('message', (message) => {
    console.log('Received from client:', message);
    // You can handle incoming messages here
  });

  ws.on('close', () => {
    clearInterval(interval);
    console.log('Client disconnected');
  });
});

// --- Start the server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server and WebSocket running on port ${PORT}`));