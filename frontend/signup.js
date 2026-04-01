// signup.js - User registration with Supabase Authentication API

const API_BASE_URL = (window.location.port !== '3000' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? 'http://localhost:3000/api' 
    : '/api';

// Handle signup form submission
document.getElementById('signup-form').addEventListener('submit', async function(e) {
    e.preventDefault(); // Prevent actual form submission

    const nameInput = document.getElementById('name').value;
    const emailInput = document.getElementById('email').value;
    const passInput = document.getElementById('password').value;
    const confirmPassInput = document.getElementById('confirm-password').value;
    const btn = document.getElementById('signup-btn');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');

    // Validate inputs
    if (!emailInput || !passInput) {
        showError('Please enter both email and password');
        return;
    }

    if (passInput.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }

    if (passInput !== confirmPassInput) {
        showError('Passwords do not match');
        return;
    }

    // Show loading UI
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';

    try {
        // Call register API
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: emailInput,
                password: passInput,
                name: nameInput || emailInput.split('@')[0]
            })
        });

        const result = await response.json();

        if (!response.ok) {
            // Handle error response
            throw new Error(result.error?.message || 'Registration failed');
        }

        // Show success message
        showSuccess('Account created successfully! Redirecting to login...');

        // Redirect to login page after 2 seconds
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    } catch (error) {
        console.error('Signup error:', error);
        showError(error.message || 'Registration failed. Please try again.');
        
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
    let errorDiv = document.getElementById('signup-error');
    
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'signup-error';
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
        
        const form = document.getElementById('signup-form');
        form.insertBefore(errorDiv, form.firstChild);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Show success message
function showSuccess(message) {
    // Check if success element exists, if not create it
    let successDiv = document.getElementById('signup-success');
    
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.id = 'signup-success';
        successDiv.style.cssText = `
            color: #34c759;
            background-color: rgba(52, 199, 89, 0.1);
            border: 1px solid rgba(52, 199, 89, 0.3);
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-size: 14px;
            text-align: center;
        `;
        
        const form = document.getElementById('signup-form');
        form.insertBefore(successDiv, form.firstChild);
    }
    
    successDiv.textContent = message;
    successDiv.style.display = 'block';
}

// Auto-redirect to chat if the user is already logged in
if (localStorage.getItem('babaGPT_isLoggedIn') === 'true') {
    window.location.href = 'index.html';
}
