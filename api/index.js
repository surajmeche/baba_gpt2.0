// api/index.js - Vercel serverless function entry point

// Import the Express app from backend
const { app } = require('../backend/server.js');

// Export the Express app as a serverless function
module.exports = app;
