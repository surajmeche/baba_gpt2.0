// login.js - Updated to use Supabase Authentication API

const API_BASE_URL = 'http://localhost:3000/api';

// Handle login form submission
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault(); // Prevent actual form submission

    const emailInput = document.getElementById('email').value;
    const passInput = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');

    if (!emailInput || !passInput) {
        showError('Please enter both email and password');
        return;
    }

    // Show loading UI
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';

    try {
        // Call login API
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: emailInput,
                password: passInput
            })
        });

        const result = await response.json();

        if (!response.ok) {
            // Handle error response
            throw new Error(result.error?.message || 'Login failed');
        }

        // Store authentication data
        localStorage.setItem('access_token', result.data.session.access_token);
        localStorage.setItem('refresh_token', result.data.session.refresh_token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
        localStorage.setItem('babaGPT_isLoggedIn', 'true');
        localStorage.setItem('babaGPT_userId', result.data.user.id);
        localStorage.setItem('babaGPT_userEmail', result.data.user.email);

        // Redirect to main chat interface
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Login failed. Please try again.');
        
        // Reset button state
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
    }
});

// Show error message
function showError(message) {
    // Check if error element exists, if not create it
    let errorDiv = document.getElementById('login-error');
    
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'login-error';
        errorDiv.style.cssText = `
            color: #ff3b30;
            background-color: rgba(255, 59, 48, 0.1);
            border: 1px solid rgba(255, 59, 48, 0.3);
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-size: 14px;
            text-align: center;
        `;
        
        const form = document.getElementById('login-form');
        form.insertBefore(errorDiv, form.firstChild);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Auto-redirect to chat if the user is already logged in
if (localStorage.getItem('babaGPT_isLoggedIn') === 'true') {
    // Verify token is still valid
    const accessToken = localStorage.getItem('access_token');
    
    if (accessToken) {
        fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        .then(response => {
            if (response.ok) {
                // Token is valid, redirect to chat
                window.location.href = 'index.html';
            } else {
                // Token is invalid, clear storage
                localStorage.clear();
            }
        })
        .catch(() => {
            // Network error or token invalid, clear storage
            localStorage.clear();
        });
    }
}
