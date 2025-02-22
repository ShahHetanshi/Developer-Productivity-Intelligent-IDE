const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Function to find an available port
const findAvailablePort = (startPort) => {
  const net = require('net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1)); // Try the next port
      } else {
        reject(err);
      }
    });
    server.on('listening', () => {
      server.close(() => resolve(startPort));
    });
    server.listen(startPort);
  });
};

// Start the server on an available port
findAvailablePort(3000).then((port) => {
  app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
});