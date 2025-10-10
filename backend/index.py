#!/usr/bin/env python3
"""
Tithi Backend Entry Point

This is the main entry point for the Tithi backend application.
It creates the Flask application using the factory pattern and starts the server.
"""

import os
import sys
from app import create_app

def main():
    """Main entry point for the Tithi backend."""
    
    # Create the Flask application
    app = create_app()
    
    # Get configuration from environment variables
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5001))  # Use 5001 to avoid port 5000 conflict
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() in ['true', '1', 'yes']
    
    print(f"🚀 Starting Tithi Backend on {host}:{port}")
    print(f"🔧 Debug mode: {debug}")
    print(f"📚 API Documentation: http://{host}:{port}/api/docs")
    print(f"🏥 Health Check: http://{host}:{port}/health")
    
    # Start the Flask development server
    app.run(
        host=host,
        port=port,
        debug=debug,
        threaded=True,
        use_reloader=debug
    )

if __name__ == '__main__':
    main()