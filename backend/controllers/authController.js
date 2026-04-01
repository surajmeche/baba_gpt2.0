// controllers/authController.js
const supabase = require('../config/supabaseClient');

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
    try {
        const { email, password, name } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                error: {
                    message: 'Missing required fields: email and password are required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid email format',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validate password strength (minimum 6 characters)
        if (password.length < 6) {
            return res.status(400).json({
                error: {
                    message: 'Password must be at least 6 characters long',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Create user with Supabase Auth
        const { data, error } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-confirm email for development
            user_metadata: {
                name: name || email.split('@')[0]
            }
        });

        if (error) {
            // Handle duplicate email error
            if (error.message.includes('already') || error.message.includes('exists') || error.status === 422) {
                return res.status(409).json({
                    error: {
                        message: 'Email already registered',
                        timestamp: new Date().toISOString()
                    }
                });
            }
            
            // Log the actual error for debugging
            console.error('Registration error:', error);
            
            throw error;
        }

        // Return success response
        res.status(201).json({
            data: {
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.user_metadata.name
                },
                message: 'User registered successfully'
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                error: {
                    message: 'Missing required fields: email and password are required',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Sign in with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            // Handle invalid credentials
            if (error.message.includes('Invalid login credentials')) {
                return res.status(401).json({
                    error: {
                        message: 'Invalid email or password',
                        timestamp: new Date().toISOString()
                    }
                });
            }
            throw error;
        }

        // Return success response with user data and session
        res.status(200).json({
            data: {
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.user_metadata.name
                },
                session: {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    message: 'Missing or invalid authorization header',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const token = authHeader.substring(7);

        // Sign out the user
        const { error } = await supabase.auth.admin.signOut(token);

        if (error) {
            throw error;
        }

        res.status(200).json({
            data: {
                message: 'Logged out successfully'
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    message: 'Missing or invalid authorization header',
                    timestamp: new Date().toISOString()
                }
            });
        }

        const token = authHeader.substring(7);

        // Get user from token
        const { data, error } = await supabase.auth.getUser(token);

        if (error) {
            return res.status(401).json({
                error: {
                    message: 'Invalid or expired token',
                    timestamp: new Date().toISOString()
                }
            });
        }

        res.status(200).json({
            data: {
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.user_metadata.name,
                    created_at: data.user.created_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res, next) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({
                error: {
                    message: 'Missing required field: refresh_token',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Refresh the session
        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refresh_token
        });

        if (error) {
            return res.status(401).json({
                error: {
                    message: 'Invalid or expired refresh token',
                    timestamp: new Date().toISOString()
                }
            });
        }

        res.status(200).json({
            data: {
                session: {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout,
    getCurrentUser,
    refreshToken
};
