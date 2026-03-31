// script.js

// =========================================
// 1. CONFIGURATION
// =========================================
const API_KEY = 'AIzaSyAUM3jpNrVcEFr33OpMx1yLal3c29f6g5w';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// =========================================
// 2. DOM ELEMENTS SELECTION
// ==========================================
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistoryList = document.getElementById('chat-history-list');
const welcomeScreen = document.getElementById('welcome-screen');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');

// =========================================
// 3. STATE MANAGEMENT
// ==========================================
let state = {
    chats: [], 
    currentChatId: null, 
    isWaitingForResponse: false,
    isMessageRequestInProgress: false, // Track if a message request is in progress
    chatListRefreshQueue: [], // Queue for chat list refresh operations
    isRefreshingChatList: false, // Track if chat list refresh is in progress
    pendingChatFetchController: null, // AbortController for pending chat fetch requests
    pendingMessageFetchController: null // AbortController for pending message fetch requests
};

// ==========================================
// 4. BACKEND API CLIENT
// ==========================================
const BackendAPI = {
    baseURL: 'http://localhost:3000/api',
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
    
    // Get access token from localStorage
    getAccessToken: function() {
        return localStorage.getItem('access_token');
    },
    
    // Get refresh token from localStorage
    getRefreshToken: function() {
        return localStorage.getItem('refresh_token');
    },
    
    // Get user_id from localStorage
    getUserId: function() {
        return localStorage.getItem('babaGPT_userId');
    },
    
    // Get authorization headers
    getAuthHeaders: function() {
        const token = this.getAccessToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },
    
    // Refresh access token
    refreshAccessToken: async function() {
        const refreshToken = this.getRefreshToken();
        
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }
        
        try {
            const response = await fetch(`${this.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refresh_token: refreshToken
                })
            });
            
            if (!response.ok) {
                throw new Error('Token refresh failed');
            }
            
            const result = await response.json();
            
            // Update tokens in localStorage
            localStorage.setItem('access_token', result.data.session.access_token);
            localStorage.setItem('refresh_token', result.data.session.refresh_token);
            
            return result.data.session.access_token;
        } catch (error) {
            // Refresh failed, redirect to login
            console.error('Token refresh failed:', error);
            localStorage.clear();
            window.location.href = 'login.html';
            throw error;
        }
    },
    
    // Retry logic for transient failures
    async retryFetch(fetchFn, retries = this.maxRetries) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await fetchFn();
            } catch (error) {
                // If 401 error, try to refresh token
                if (error.status === 401 && attempt === 1) {
                    console.log('Token expired, refreshing...');
                    try {
                        await this.refreshAccessToken();
                        // Retry the request with new token
                        continue;
                    } catch (refreshError) {
                        throw refreshError;
                    }
                }
                
                // Only retry on network errors or 5xx server errors
                const isNetworkError = error.name === 'TypeError' || error.name === 'AbortError';
                const isServerError = error.status >= 500;
                const isLastAttempt = attempt === retries;
                
                if ((isNetworkError || isServerError) && !isLastAttempt) {
                    console.log(`Retry attempt ${attempt}/${retries} after ${this.retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    continue;
                }
                throw error;
            }
        }
    },
    
    // Response handler with detailed error logging
    handleResponse: async function(response) {
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { error: { message: 'Failed to parse error response' } };
            }
            
            const errorMessage = errorData.error?.message || 'Request failed';
            const error = new Error(errorMessage);
            error.status = response.status;
            error.statusText = response.statusText;
            error.details = errorData;
            
            // Log detailed error information to console
            console.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                message: errorMessage,
                details: errorData,
                timestamp: new Date().toISOString()
            });
            
            throw error;
        }
        return response.json();
    },
    
    // Chat API Methods
    
    // POST /api/chats - Create a new chat
    createChat: async function(title) {
        return this.retryFetch(async () => {
            const response = await fetch(`${this.baseURL}/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify({ title })
            });
            return this.handleResponse(response);
        });
    },
    
    // GET /api/chats - Get all chats for the user
    getChats: async function() {
        return this.retryFetch(async () => {
            const response = await fetch(`${this.baseURL}/chats`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            return this.handleResponse(response);
        });
    },
    
    // GET /api/chats/:chatId - Get a specific chat with messages
    getChat: async function(chatId, signal = null) {
        return this.retryFetch(async () => {
            const fetchOptions = {
                method: 'GET',
                headers: this.getAuthHeaders()
            };
            if (signal) {
                fetchOptions.signal = signal;
            }
            const response = await fetch(`${this.baseURL}/chats/${chatId}`, fetchOptions);
            return this.handleResponse(response);
        });
    },
    
    // PUT /api/chats/:chatId - Update chat title
    updateChat: async function(chatId, title) {
        return this.retryFetch(async () => {
            const response = await fetch(`${this.baseURL}/chats/${chatId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify({ title })
            });
            return this.handleResponse(response);
        });
    },
    
    // DELETE /api/chats/:chatId - Delete a chat
    deleteChat: async function(chatId) {
        return this.retryFetch(async () => {
            const response = await fetch(`${this.baseURL}/chats/${chatId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            return this.handleResponse(response);
        });
    },
    
    // Message API Methods
    
    // POST /api/messages - Create a new message
    createMessage: async function(chatId, role, content, signal = null) {
        return this.retryFetch(async () => {
            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    role: role,
                    content: content
                })
            };
            if (signal) {
                fetchOptions.signal = signal;
            }
            const response = await fetch(`${this.baseURL}/messages`, fetchOptions);
            return this.handleResponse(response);
        });
    },
    
    // GET /api/messages - Get all messages for a chat
    getMessages: async function(chatId) {
        return this.retryFetch(async () => {
            const response = await fetch(`${this.baseURL}/messages?chat_id=${chatId}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            return this.handleResponse(response);
        });
    },
    
    // Migration API Method
    
    // POST /api/chats/migrate - Migrate localStorage data to database
    migrateData: async function(chats) {
        return this.retryFetch(async () => {
            const response = await fetch(`${this.baseURL}/chats/migrate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify({ chats })
            });
            return this.handleResponse(response);
        });
    }
};

// ==========================================
// 4.5 ERROR MESSAGE HELPER
// ==========================================

// Display user-friendly error message
function showErrorMessage(error, context = '') {
    let userMessage = 'An error occurred. Please try again.';
    
    // Map specific error statuses to user-friendly messages
    if (error.status === 400) {
        userMessage = 'Invalid request. Please check your input and try again.';
    } else if (error.status === 404) {
        userMessage = 'The requested item was not found. It may have been deleted.';
    } else if (error.status === 413) {
        userMessage = 'Your message is too large. Please reduce the number or size of images.';
    } else if (error.status === 415) {
        userMessage = 'Invalid request format. Please try again.';
    } else if (error.status >= 500) {
        userMessage = 'Server error. Please try again later.';
    } else if (error.name === 'TypeError' || error.name === 'AbortError') {
        userMessage = 'Connection error. Please check your internet connection and try again.';
    } else if (error.message) {
        userMessage = error.message;
    }
    
    // Log detailed error information to console
    console.error(`Error (${context}):`, {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        details: error.details,
        timestamp: new Date().toISOString()
    });
    
    // Display user-friendly message
    alert(`${context ? context + ': ' : ''}${userMessage}`);
}

// ==========================================
// 5. USER SESSION MANAGEMENT
// ==========================================

// Generate UUID v4 with crypto.randomUUID() and fallback
function generateUUID() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Initialize or retrieve user ID from localStorage
function initializeUser() {
    let userId = localStorage.getItem('babaGPT_userId');
    if (!userId) {
        userId = generateUUID();
        localStorage.setItem('babaGPT_userId', userId);
    }
    return userId;
}

// ==========================================
// 6. DATA MIGRATION FUNCTIONS
// ==========================================

// Transform localStorage format to API format
function prepareMigrationData() {
    const localChats = JSON.parse(localStorage.getItem('babaGPT_chats') || '[]');
    
    return localChats.map(chat => ({
        id: chat.id,
        title: chat.title || 'New Conversation',
        messages: (chat.messages || []).map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' 
                ? {text: msg.content, images: []}
                : msg.content,
            timestamp: msg.timestamp || new Date().toISOString()
        }))
    }));
}

// Show migration modal
function showMigrationModal() {
    const modal = document.getElementById('migration-modal');
    modal.style.display = 'flex';
}

// Hide migration modal
function hideMigrationModal() {
    const modal = document.getElementById('migration-modal');
    modal.style.display = 'none';
}

// Show migration loading status
function showMigrationLoading() {
    const statusDiv = document.getElementById('migration-status');
    statusDiv.style.display = 'flex';
}

// Hide migration loading status
function hideMigrationLoading() {
    const statusDiv = document.getElementById('migration-status');
    statusDiv.style.display = 'none';
}

// Execute migration
async function executeMigration() {
    showMigrationLoading();
    
    try {
        const migrationData = prepareMigrationData();
        const response = await BackendAPI.migrateData(migrationData);
        
        // Success: remove localStorage data and reload chats
        localStorage.removeItem('babaGPT_chats');
        
        // Reload chat list from backend
        const chatsResponse = await BackendAPI.getChats();
        state.chats = chatsResponse.data || [];
        renderSidebar();
        
        hideMigrationModal();
        
        if (state.chats.length > 0) {
            await loadChat(state.chats[0].id);
        } else {
            startNewChat();
        }
    } catch (error) {
        console.error('Migration failed:', error);
        hideMigrationLoading();
        showErrorMessage(error, 'Migration failed');
    }
}

// Check for migration data and show modal if needed
async function checkForMigration() {
    const hasLocalChats = localStorage.getItem('babaGPT_chats');
    
    if (hasLocalChats) {
        showMigrationModal();
        
        // Set up event listeners for migration buttons
        const migrateBtn = document.getElementById('migrate-btn');
        const skipBtn = document.getElementById('skip-migration-btn');
        
        migrateBtn.onclick = async () => {
            await executeMigration();
        };
        
        skipBtn.onclick = () => {
            // Remove migration data and continue
            localStorage.removeItem('babaGPT_chats');
            hideMigrationModal();
            loadChatsFromBackend();
        };
    } else {
        // No migration needed, load chats normally
        loadChatsFromBackend();
    }
}

// Load chats from backend
async function loadChatsFromBackend() {
    try {
        const response = await BackendAPI.getChats();
        state.chats = response.data || [];
        renderSidebar();
        if (state.chats.length > 0) {
            await loadChat(state.chats[0].id);
        } else {
            startNewChat();
        }
    } catch (error) {
        console.error('Failed to load chats:', error);
        showErrorMessage(error, 'Failed to load chats');
        state.chats = [];
        startNewChat();
    }
}

// ==========================================
// 7. INITIALIZATION
// ==========================================
async function init() {
    // Authentication Guard
    if (localStorage.getItem('babaGPT_isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return; // Stop execution
    }

    // Initialize user session
    initializeUser();

    // Check for migration data
    await checkForMigration();
}

// Logout function - clears user session and redirects to login
async function logout() {
    try {
        // Call logout API
        const token = localStorage.getItem('access_token');
        if (token) {
            await fetch(`${BackendAPI.baseURL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
    } catch (error) {
        console.error('Logout API error:', error);
        // Continue with local logout even if API call fails
    }
    
    // Remove all user session data
    localStorage.clear();
    
    // Redirect to login page
    window.location.href = 'login.html';
}

// ==========================================
// 8. UI RENDERING LOGIC
// ==========================================

function renderSidebar() {
    chatHistoryList.innerHTML = ''; 
    state.chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `history-item ${chat.id === state.currentChatId ? 'active' : ''}`;
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = chat.title || 'New Chat';
        titleSpan.style.flex = '1';
        titleSpan.onclick = () => loadChat(chat.id);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-chat-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Delete chat';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        };
        
        div.appendChild(titleSpan);
        div.appendChild(deleteBtn);
        chatHistoryList.appendChild(div);
    });
}

async function deleteChat(chatId) {
    if (!confirm('Are you sure you want to delete this chat?')) {
        return;
    }
    
    try {
        await BackendAPI.deleteChat(chatId);
        
        // Remove from local state
        state.chats = state.chats.filter(c => c.id !== chatId);
        
        // If deleted chat was current, load another or start new
        if (state.currentChatId === chatId) {
            if (state.chats.length > 0) {
                await loadChat(state.chats[0].id);
            } else {
                state.currentChatId = null;
                clearChatWindow();
                welcomeScreen.style.display = 'flex';
            }
        }
        
        renderSidebar();
    } catch (error) {
        console.error('Failed to delete chat:', error);
        showErrorMessage(error, 'Failed to delete chat');
    }
}

async function startNewChat() {
    try {
        // Create chat via backend API
        const response = await BackendAPI.createChat('New Conversation');
        const newChat = response.data;
        
        // Update local state
        state.currentChatId = newChat.id;
        state.chats.unshift({
            id: newChat.id,
            title: newChat.title,
            messages: []
        });
        
        // Update UI
        renderSidebar();
        clearChatWindow();
        welcomeScreen.style.display = 'flex'; 
    } catch (error) {
        console.error('Failed to create new chat:', error);
        showErrorMessage(error, 'Failed to create new chat');
    }
}

async function loadChat(chatId) {
    // Cancel any pending message fetch requests for the previous chat
    if (state.pendingMessageFetchController) {
        state.pendingMessageFetchController.abort();
        state.pendingMessageFetchController = null;
    }
    
    state.currentChatId = chatId;
    renderSidebar(); 
    clearChatWindow();
    
    try {
        // Create new AbortController for this chat fetch
        state.pendingMessageFetchController = new AbortController();
        
        // Fetch chat data from backend API with signal
        const response = await BackendAPI.getChat(chatId, state.pendingMessageFetchController.signal);
        const chatData = response.data;
        
        // Clear the controller after successful fetch
        state.pendingMessageFetchController = null;
        
        // Update local state with fetched data
        const chatIndex = state.chats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
            state.chats[chatIndex] = {
                id: chatData.chat.id,
                title: chatData.chat.title,
                messages: chatData.messages || []
            };
        }
        
        // Display messages
        if (chatData.messages && chatData.messages.length > 0) {
            welcomeScreen.style.display = 'none';
            chatData.messages.forEach(msg => {
                appendMessageToUI(msg);
            });
        } else {
            welcomeScreen.style.display = 'flex';
        }
    } catch (error) {
        // Don't show error if request was aborted (user switched chats)
        if (error.name === 'AbortError') {
            console.log('Chat fetch cancelled due to chat switch');
            return;
        }
        
        console.error('Failed to load chat:', error);
        showErrorMessage(error, 'Failed to load chat');
        // Show welcome screen on error
        welcomeScreen.style.display = 'flex';
    }
    
    if(window.innerWidth <= 768) {
        sidebar.classList.remove('open');
    }
}

function clearChatWindow() {
    const messages = chatMessages.querySelectorAll('.message-wrapper');
    messages.forEach(msg => msg.remove());
}

// Append message supports text content only
function appendMessageToUI(msgObj) {
    if(welcomeScreen) welcomeScreen.style.display = 'none';

    let role = msgObj.role;
    let textContent = "";
    
    if (typeof msgObj.content === 'string') {
        textContent = msgObj.content;
    } else if (msgObj.content) {
        textContent = msgObj.content.text || '';
    }

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role} flex`;

    const inner = document.createElement('div');
    inner.className = 'message-inner';

    const circle = document.createElement('div');
    circle.className = 'message-circle';
    if(role === 'bot') {
        circle.innerHTML = '<i class="fas fa-robot" style="color: white; font-size: 14px;"></i>';
    } else {
        circle.innerHTML = '';
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Add text format
    if (textContent) {
        const textWrapper = document.createElement('div');
        textWrapper.innerHTML = formatMarkdown(textContent);
        contentDiv.appendChild(textWrapper);
    }

    inner.appendChild(circle);
    inner.appendChild(contentDiv);
    wrapper.appendChild(inner);

    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return wrapper;
}

function formatMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function showTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper bot typing-indicator-wrapper';
    wrapper.id = 'typing-indicator-wrapper';
    
    const inner = document.createElement('div');
    inner.className = 'message-inner';

    const circle = document.createElement('div');
    circle.className = 'message-circle';
    circle.innerHTML = '<i class="fas fa-robot" style="color: white; font-size: 14px;"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content typing-indicator';
    contentDiv.innerHTML = '<span></span><span></span><span></span>';

    inner.appendChild(circle);
    inner.appendChild(contentDiv);
    wrapper.appendChild(inner);

    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator-wrapper');
    if (indicator) indicator.remove();
}

// ==========================================
// 9. CORE LOGIC (SENDING & RECEIVING)
// ==========================================

async function handleSend() {
    const text = userInput.value.trim();
    
    if (!text || state.isWaitingForResponse) return;

    // Package the content
    const userContent = {
        text: text,
        images: []
    };

    // 1. Show user message
    await addMessageToStateAndUI('user', userContent);
    
    // Reset input box
    userInput.value = ''; 
    userInput.style.height = 'auto';

    // 2. Set conversation title based on first query
    const currentChat = state.chats.find(c => c.id === state.currentChatId);
    if (currentChat && currentChat.messages.length === 1 && text) {
        const newTitle = text.split(" ").slice(0, 4).join(" ") + "...";
        currentChat.title = newTitle;
        renderSidebar();
        
        try {
            await BackendAPI.updateChat(state.currentChatId, newTitle);
        } catch (error) {
            console.error('Failed to update chat title:', error);
            showErrorMessage(error, 'Failed to update chat title');
        }
    }

    // 3. Prepare for AI response
    state.isWaitingForResponse = true;
    showTypingIndicator();

    // 4. Try to fetch response from API
    try {
        const aiResponse = await fetchDynamicResponse(text);
        removeTypingIndicator();
        await addMessageToStateAndUI('bot', { text: aiResponse, images: [] }, true); 
    } catch (error) {
        removeTypingIndicator();
        console.error("API Error:", error);
        await addMessageToStateAndUI('bot', { text: `**Error:** ${error.message}`, images: [] }, false); 
    } finally {
        state.isWaitingForResponse = false;
    }
}

async function addMessageToStateAndUI(role, contentObj, saveToHistory = true) {
    // Optimistic UI update: show message immediately
    const messageWrapper = appendMessageToUI({ role, content: contentObj });

    if (saveToHistory) {
        const currentChat = state.chats.find(c => c.id === state.currentChatId);
        if (currentChat) {
            // Drop images before saving to prevent hitting 5MB limit
            // and saving token costs on future API history requests!
            const storageContent = {
                text: contentObj.text || "",
                images: [] 
            };
            
            // Add to local state optimistically
            const messageObj = { role, content: storageContent, timestamp: new Date().toISOString() };
            currentChat.messages.push(messageObj);
            
            // Mark message request as in progress
            state.isMessageRequestInProgress = true;
            updateSendButtonState();
            
            try {
                // Save to backend API
                await BackendAPI.createMessage(state.currentChatId, role, storageContent);
            } catch (error) {
                console.error('Failed to save message:', error);
                
                // Rollback: remove message from UI and state
                if (messageWrapper && messageWrapper.parentNode) {
                    messageWrapper.remove();
                }
                currentChat.messages.pop();
                
                showErrorMessage(error, 'Failed to save message');
            } finally {
                // Mark message request as complete
                state.isMessageRequestInProgress = false;
                updateSendButtonState();
            }
        }
    }
}

// ==========================================================
// 10. DYNAMIC API INTEGRATION 
// ==========================================================
async function fetchDynamicResponse(userText) {
    
    const currentChat = state.chats.findIndex(c => c.id === state.currentChatId);
    let historyContents = [];
    
    // Map existing history
    if (currentChat && currentChat.messages) {
        historyContents = currentChat.messages.map(msg => {
            let parts = [];
            
            // Backwards compatibility
            let text = "";
            if (typeof msg.content === 'string') {
                text = msg.content;
            } else if (msg.content) {
                text = msg.content.text || '';
            }
            
            if (text) parts.push({ text: text });

            return {
                role: msg.role === 'user' ? 'user' : 'model',
                parts: parts
            };
        });
    }

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const reqBody = {
        contents: historyContents,
        system_instruction: {
            parts: [{ text: `Your name is 'Baba GPT'. Respond to the user's queries like a pirate. The current date is ${currentDate}. You must use this current date for any questions regarding time, current events, or relative dates.` }]
        }
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reqBody)
        });

        if (!response.ok) {
            let errorMsg = `HTTP Error Status: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData.error && errData.error.message) {
                    errorMsg = errData.error.message;
                }
            } catch (parseErr) {}
            throw new Error(errorMsg);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            return "Sorry, I received a confusing response.";
        }
    } catch(err) {
        throw err;
    }
}

// ==========================================
// 11. EVENT LISTENERS
// ==========================================

userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

userInput.addEventListener('input', function() {
    this.style.height = 'auto'; 
    this.style.height = (this.scrollHeight) + 'px'; 
    updateSendButtonState();
});

sendBtn.addEventListener('click', handleSend);
newChatBtn.addEventListener('click', startNewChat);

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Logout button event listener
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

// Image Upload Events - REMOVED

function updateSendButtonState() {
    const hasText = userInput.value.trim().length > 0;
    const isRequestInProgress = state.isMessageRequestInProgress || state.isWaitingForResponse;
    
    if (hasText && !isRequestInProgress) {
        sendBtn.disabled = false;
        sendBtn.classList.add('active');
    } else {
        sendBtn.disabled = true;
        sendBtn.classList.remove('active');
    }
}

// Go!
init();

// Queue a chat list refresh operation to avoid race conditions
async function queueChatListRefresh() {
    return new Promise((resolve) => {
        state.chatListRefreshQueue.push(resolve);
        processChatListRefreshQueue();
    });
}

// Process queued chat list refresh operations sequentially
async function processChatListRefreshQueue() {
    if (state.isRefreshingChatList || state.chatListRefreshQueue.length === 0) {
        return;
    }
    
    state.isRefreshingChatList = true;
    
    try {
        const response = await BackendAPI.getChats();
        state.chats = response.data || [];
        renderSidebar();
    } catch (error) {
        console.error('Failed to refresh chat list:', error);
    } finally {
        state.isRefreshingChatList = false;
        
        // Resolve the first queued operation
        const resolve = state.chatListRefreshQueue.shift();
        if (resolve) {
            resolve();
        }
        
        // Process next queued operation if any
        if (state.chatListRefreshQueue.length > 0) {
            processChatListRefreshQueue();
        }
    }
}
