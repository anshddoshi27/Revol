#!/bin/bash

# Tithi Local Development Startup Script
# This script starts both the backend and frontend for local development

set -e

echo "🚀 Starting Tithi Local Development Environment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is required but not installed${NC}"
    exit 1
fi

# Node.js and npm checks removed - frontend not available

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Check if directories exist
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Backend directory not found: $BACKEND_DIR${NC}"
    exit 1
fi

# Frontend directory check removed - frontend not available

# Function to start backend
start_backend() {
    echo -e "${BLUE}🔧 Starting Backend Server...${NC}"
    cd "$BACKEND_DIR"
    
    # Activate virtual environment
    if [ -d "venv" ]; then
        source venv/bin/activate
        echo -e "${GREEN}✅ Virtual environment activated${NC}"
    else
        echo -e "${YELLOW}⚠️  Virtual environment not found, using system Python${NC}"
    fi
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}⚠️  .env file not found, using default configuration${NC}"
    fi
    
    # Start Flask development server using the new entry point
    echo -e "${GREEN}🚀 Starting Flask server on http://localhost:5001${NC}"
    export FLASK_ENV=development
    export FLASK_DEBUG=1
    python3 index.py &
    BACKEND_PID=$!
    echo $BACKEND_PID > backend.pid
}

# Frontend startup function removed - frontend not available

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down servers...${NC}"
    
    # Kill backend if running
    if [ -f "$BACKEND_DIR/backend.pid" ]; then
        BACKEND_PID=$(cat "$BACKEND_DIR/backend.pid")
        if kill -0 $BACKEND_PID 2>/dev/null; then
            kill $BACKEND_PID
            echo -e "${GREEN}✅ Backend server stopped${NC}"
        fi
        rm -f "$BACKEND_DIR/backend.pid"
    fi
    
    # Frontend cleanup removed - frontend not available
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start services
start_backend

echo -e "\n${GREEN}🎉 Tithi Backend is now running locally!${NC}"
echo -e "${BLUE}🔧 Backend API: http://localhost:5001${NC}"
echo -e "${BLUE}📚 API Docs: http://localhost:5001/api/docs${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all servers${NC}"

# Wait for user to stop
wait
