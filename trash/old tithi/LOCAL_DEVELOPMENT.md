# Tithi Local Development Setup

This guide will help you get the Tithi application running locally for development.

## Prerequisites

- **Python 3.8+** - Backend runs on Flask
- **Node.js 16+** - Frontend runs on React + Vite
- **npm** - Package manager for frontend dependencies

## Quick Start

### Option 1: Automated Startup (Recommended)

Run the startup script to launch both frontend and backend:

```bash
./start-local.sh
```

This will:
- Start the Flask backend on `http://localhost:5000`
- Start the Vite frontend on `http://localhost:5173`
- Handle cleanup when you stop the servers

### Option 2: Manual Startup

#### Backend Setup

```bash
cd backend

# Activate virtual environment
source venv/bin/activate

# Start Flask development server
export FLASK_ENV=development
export FLASK_DEBUG=1
python -m flask run --host=0.0.0.0 --port=5000
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies (if not already installed)
npm install

# Start Vite development server
npm run dev
```

## Application URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api/docs

## Phase 1 Features Available

The following Phase 1 features are implemented and ready to use:

### ✅ T01 - Bootstrap Project & Typed API Client
- Production-grade API client with interceptors
- Authentication, error handling, rate limiting
- Idempotency key management
- Observability hooks

### ✅ T02 - Multi-Tenant Routing & Slug Resolution
- Tenant context management
- Route guards for admin protection
- Slug resolution utilities
- Multi-tenant routing system

### ✅ T02A - Auth & Sign-Up Flow
- Landing page with "Get Started" CTA
- Sign-up form with validation
- Automatic redirect to onboarding
- Authentication flow

### ✅ T03 - Design System Tokens & Status Colors
- Design tokens and utilities
- Status badge component
- Theme application system
- White-label compliance

## Available Routes

### Frontend Routes
- `/` - Landing page
- `/auth/sign-up` - User sign-up form
- `/onboarding/step-1` - Onboarding step 1 (placeholder)

### Backend API Routes
- `POST /auth/signup` - Create new user account
- `POST /auth/login` - Authenticate user
- `POST /onboarding/register` - Register new business
- `GET /onboarding/check-subdomain/{subdomain}` - Check subdomain availability

## Environment Configuration

### Backend Environment Variables

The backend uses the following environment variables (configured in `backend/.env`):

```bash
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=dev-secret-key-change-in-production

# Database
DATABASE_URL=sqlite:///instance/dev.db

# JWT
JWT_SECRET_KEY=dev-jwt-secret-key-change-in-production

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Frontend Environment Variables

The frontend uses the following environment variables (configured in `frontend/.env`):

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api/v1

# Environment
VITE_ENV=development
```

## Development Workflow

1. **Start the application** using the startup script or manual commands
2. **Access the landing page** at http://localhost:5173
3. **Test the sign-up flow** by clicking "Get Started"
4. **Explore the API** using the documentation at http://localhost:5000/api/docs

## Testing

### Frontend Tests
```bash
cd frontend
npm test
```

### Backend Tests
```bash
cd backend
source venv/bin/activate
python -m pytest
```

## Troubleshooting

### Backend Issues
- Ensure virtual environment is activated
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Verify database file exists: `backend/instance/dev.db`

### Frontend Issues
- Ensure Node.js dependencies are installed: `npm install`
- Check that Vite is running on port 5173
- Verify environment variables are set correctly

### Port Conflicts
- Backend default port: 5000
- Frontend default port: 5173
- If ports are in use, modify the startup commands to use different ports

## Next Steps

Phase 1 is complete and ready for development. The next phase will include:
- Onboarding wizard implementation
- Business registration flow
- Service and availability management
- Payment integration

## Support

For issues or questions:
1. Check the logs in the terminal where you started the servers
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Check that ports 5000 and 5173 are available
