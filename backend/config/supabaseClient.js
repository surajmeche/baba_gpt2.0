const { createClient } = require('@supabase/supabase-js');

// Helper to validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check for missing variables without throwing immediately to avoid crashing the whole process at load time
if (!supabaseUrl || !supabaseKey) {
    if (process.env.VERCEL) {
        console.error('CRITICAL: Supabase environment variables are missing on Vercel!');
    } else {
        console.warn('WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment.');
    }
}

// Initialize the Supabase client
// We use a getter or just a static instance that might be null if config is wrong
// but at least it won't crash the entire Node process during the initial 'require' phase.
let supabase = null;

try {
    if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
    }
} catch (error) {
    console.error('Failed to initialize Supabase client:', error.message);
}

module.exports = supabase;
