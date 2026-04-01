// controllers/geminiController.js
// Server-side proxy for Gemini API calls - keeps the API key secure on the backend

/**
 * Proxy chat request to Gemini API
 * POST /api/gemini/chat
 * 
 * Receives the same payload the frontend used to send directly to Gemini,
 * appends the API key server-side, and forwards the request.
 */
const chatProxy = async (req, res, next) => {
    try {
        const { contents, system_instruction } = req.body;

        // Validate required fields
        if (!contents || !Array.isArray(contents)) {
            return res.status(400).json({
                error: {
                    message: 'Missing or invalid required field: contents must be an array',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Get API key from environment variable (never exposed to frontend)
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('CRITICAL: GEMINI_API_KEY is not set in environment variables');
            return res.status(503).json({
                error: {
                    message: 'AI service is currently unavailable. Please try again later.',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Build the Gemini API URL with the secret key
        const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // Forward the request to Gemini API
        const geminiPayload = { contents };
        if (system_instruction) {
            geminiPayload.system_instruction = system_instruction;
        }

        const geminiResponse = await fetch(geminiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(geminiPayload)
        });

        // Parse the response
        const geminiData = await geminiResponse.json();

        // If Gemini returned an error, forward it with appropriate status
        if (!geminiResponse.ok) {
            const errorMessage = geminiData.error?.message || `Gemini API error: ${geminiResponse.status}`;
            console.error('Gemini API error:', {
                status: geminiResponse.status,
                message: errorMessage
            });

            return res.status(geminiResponse.status >= 500 ? 502 : geminiResponse.status).json({
                error: {
                    message: errorMessage,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Forward the successful response to the frontend
        res.status(200).json(geminiData);

    } catch (error) {
        console.error('Gemini proxy error:', error);
        next(error);
    }
};

module.exports = {
    chatProxy
};
