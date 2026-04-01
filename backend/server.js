require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Environment validation
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('ERROR: Missing required environment variables:', missingVars.join(', '));
    console.error('Please ensure your environment variables are set: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    // Don't exit on Vercel, just log the error
    if (!process.env.VERCEL) {
        process.exit(1);
    }
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');

// Middleware stack
// 1. CORS - Allow cross-origin requests from frontend
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5501', 'http://127.0.0.1:5501'],
    credentials: true
}));

// 2. JSON Body Parser - Parse incoming JSON request bodies (10MB limit for images)
app.use(express.json({ limit: '10mb' }));

// 3. Content-Type Validation Middleware - Validate Content-Type for POST/PUT requests
app.use((req, res, next) => {
    // Only validate Content-Type for requests with bodies (POST, PUT, PATCH)
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        
        // Allow requests without Content-Type header (express.json will handle)
        // But reject if Content-Type is present and not application/json
        if (contentType && !contentType.includes('application/json')) {
            return res.status(415).json({
                error: {
                    message: 'Unsupported Media Type: Content-Type must be application/json',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
    next();
});

// 4. Request Logger - Log all incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// 5. Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        error: {
            message: 'Route not found',
            timestamp: new Date().toISOString()
        }
    });
});

// Error Handler - Catch and format errors
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal server error',
            timestamp: new Date().toISOString()
        }
    });
});

// Start server (only in local development, not on Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Backend server running on port ${PORT}`);
        console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
        console.log(`Server started at ${new Date().toISOString()}`);
    });
}

module.exports = { app };
