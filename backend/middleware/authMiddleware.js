// middleware/authMiddleware.js
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware to verify JWT token and authenticate user
 * Adds user object to req.user if authentication is successful
 */
const authenticateUser = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    message: 'Authentication required: Missing or invalid authorization header',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token with Supabase
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                error: {
                    message: 'Authentication failed: Invalid or expired token',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Attach user to request object
        req.user = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata.name,
            created_at: data.user.created_at
        };

        next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(500).json({
            error: {
                message: 'Internal server error during authentication',
                timestamp: new Date().toISOString()
            }
        });
    }
};

/**
 * Optional authentication middleware
 * Adds user object to req.user if token is valid, but doesn't block request if not
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token provided, continue without user
            req.user = null;
            return next();
        }

        const token = authHeader.substring(7);

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            // Invalid token, continue without user
            req.user = null;
            return next();
        }

        // Attach user to request object
        req.user = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata.name,
            created_at: data.user.created_at
        };

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        req.user = null;
        next();
    }
};

module.exports = {
    authenticateUser,
    optionalAuth
};
