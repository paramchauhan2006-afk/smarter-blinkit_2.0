const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });
const { connectMongoDB, connectNeo4j } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.send('Smarter Blinkit Backend is running...');
});

// Start Server
const startServer = async () => {
  try {
    await connectMongoDB();
    await connectNeo4j();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
