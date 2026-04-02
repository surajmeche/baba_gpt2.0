require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

// Environment validation handled by config/supabaseClient.js

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const geminiRoutes = require('./routes/geminiRoutes');

// Middleware stack
// 1. CORS - Allow cross-origin requests from frontend
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:5501',
            'http://127.0.0.1:5501',
            'http://localhost:3000'
        ];
        
        // Allow any Vercel deployment URL
        if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        callback(null, true); // Allow all origins for now
    },
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
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Router consolidated
const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
    const supabase = require('./config/supabaseClient');
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        supabase_connected: !!supabase,
        gemini_key_set: !!process.env.GEMINI_API_KEY,
        gemini_key_length: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
        node_version: process.version,
        env_keys: Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('SUPABASE') || k === 'PORT')
    });
});

// Database diagnostic endpoint - tests actual DB connectivity
apiRouter.get('/health/db-test', async (req, res) => {
    const supabase = require('./config/supabaseClient');
    const results = {
        timestamp: new Date().toISOString(),
        supabase_client: !!supabase,
        tests: {}
    };

    if (!supabase) {
        results.tests.connection = { status: 'FAIL', error: 'Supabase client is null' };
        return res.json(results);
    }

    // Test 1: Query chats table
    try {
        const { data, error } = await supabase.from('chats').select('id').limit(1);
        results.tests.chats_table = error 
            ? { status: 'FAIL', error: error.message, code: error.code, details: error.details }
            : { status: 'OK', row_count: data ? data.length : 0 };
    } catch (e) {
        results.tests.chats_table = { status: 'CRASH', error: e.message };
    }

    // Test 2: Query messages table
    try {
        const { data, error } = await supabase.from('messages').select('id').limit(1);
        results.tests.messages_table = error
            ? { status: 'FAIL', error: error.message, code: error.code, details: error.details }
            : { status: 'OK', row_count: data ? data.length : 0 };
    } catch (e) {
        results.tests.messages_table = { status: 'CRASH', error: e.message };
    }

    // Test 3: Try inserting & deleting a test chat
    try {
        const testId = '00000000-0000-0000-0000-000000000000';
        const { data, error } = await supabase
            .from('chats')
            .insert([{ user_id: testId, title: 'DB_TEST_CHAT' }])
            .select()
            .single();
        if (error) {
            results.tests.insert_chat = { status: 'FAIL', error: error.message, code: error.code, details: error.details, hint: error.hint };
        } else {
            results.tests.insert_chat = { status: 'OK', inserted_id: data.id };
            // Clean up test row
            await supabase.from('chats').delete().eq('id', data.id);
        }
    } catch (e) {
        results.tests.insert_chat = { status: 'CRASH', error: e.message };
    }

    res.json(results);
});

// Mount Routes to API Router
apiRouter.use('/auth', authRoutes);
apiRouter.use('/chats', chatRoutes);
apiRouter.use('/messages', messageRoutes);
apiRouter.use('/gemini', geminiRoutes);

// Mount API Router to App with /api prefix (for local/standard) and / fallback (for Vercel)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Handle root path separately to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
        if (err) {
            console.error('Failed to send index.html:', err.message);
            res.status(500).send('Frontend files not found. Please ensure the frontend directory is deployed.');
        }
    });
});

// 404 handler for undefined API routes
app.use('/api', (req, res) => {
    res.status(404).json({
        error: {
            message: 'API route not found',
            timestamp: new Date().toISOString()
        }
    });
});

// Error Handler - Catch and format errors
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        details: err.details,
        hint: err.hint,
        path: req.path,
        method: req.method
    });
    
    // If it's a Supabase connection error (usually occurs if supabase is null)
    if (err.message && err.message.includes('Supabase')) {
        return res.status(503).json({
            error: {
                message: 'Database connection unavailable. Please check environment variables.',
                timestamp: new Date().toISOString()
            }
        });
    }

    // If it's a null reference on supabase client
    if (err.message && (err.message.includes('Cannot read properties of null') || err.message.includes('Cannot read property'))) {
        return res.status(503).json({
            error: {
                message: 'Database client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.',
                debug: err.message,
                timestamp: new Date().toISOString()
            }
        });
    }

    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal server error',
            code: err.code || undefined,
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
