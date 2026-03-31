# Baba GPT - Chat Application

A full-stack chat application with authentication, built with Express.js backend and vanilla JavaScript frontend, using Supabase for database and authentication.

## Features

- User authentication (register, login, logout)
- Create and manage chat sessions
- Send and receive messages with AI (Gemini API)
- Persistent chat history
- JWT-based authentication
- Secure API with authentication middleware

## Tech Stack

**Backend:**
- Node.js + Express.js
- Supabase (PostgreSQL database + Auth)
- JWT authentication

**Frontend:**
- Vanilla JavaScript
- HTML5 + CSS3
- Fetch API for HTTP requests

## Project Structure

```
.
├── backend/          # Express.js backend API
│   ├── controllers/  # Request handlers
│   ├── middleware/   # Auth middleware
│   ├── routes/       # API routes
│   ├── supabase/     # Database config & migrations
│   └── server.js     # Main server file
│
├── frontend/         # Frontend static files
│   ├── index.html    # Chat interface
│   ├── login.html    # Login page
│   ├── signup.html   # Registration page
│   ├── script.js     # Chat logic
│   ├── login.js      # Login logic
│   ├── signup.js     # Registration logic
│   └── style.css     # Styles
│
└── vercel.json       # Vercel deployment config
```

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3000
```

## Local Development

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in `backend/.env`

4. Run database migrations:
```bash
npx supabase db push
```

5. Start the backend server:
```bash
npm start
```

Backend will run on http://localhost:3000

### Frontend

The frontend is served by the backend server at http://localhost:3000

## Deployment to Vercel

### Prerequisites
- Vercel account
- Supabase project

### Steps

1. **Fork or clone this repository**

2. **Set up Supabase:**
   - Create a new Supabase project
   - Run the migrations from `backend/supabase/migrations/`
   - Get your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

3. **Deploy to Vercel:**
   - Import your GitHub repository to Vercel
   - Add environment variables in Vercel dashboard:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - Deploy!

4. **Access your app:**
   - Your app will be available at `https://your-project.vercel.app`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh access token

### Chats
- `POST /api/chats` - Create new chat
- `GET /api/chats` - Get all user chats
- `DELETE /api/chats/:id` - Delete chat

### Messages
- `POST /api/messages` - Create message
- `GET /api/messages?chat_id=:id` - Get chat messages

## Database Schema

The database uses PostgreSQL with the following tables:
- `chats` - Chat sessions
- `messages` - Chat messages

See `backend/supabase/migrations/` for the complete schema.

## License

ISC
