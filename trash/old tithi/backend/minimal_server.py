#!/usr/bin/env python3
"""
Minimal Backend Server for Tithi
This is a simplified backend server that handles basic API calls for development.
"""

import os
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# In-memory storage for development
tenants = {}
users = {}
onboarding_data = {}

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "tithi-backend-minimal"
    })

@app.route('/api/v1/auth/register', methods=['POST'])
def register():
    """Register a new user."""
    try:
        data = request.get_json()
        
        # Create user
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": data.get('email'),
            "first_name": data.get('first_name', ''),
            "last_name": data.get('last_name', ''),
            "created_at": datetime.utcnow().isoformat()
        }
        users[user_id] = user
        
        # Create tenant if business data provided
        tenant_id = None
        if data.get('business_name'):
            tenant_id = str(uuid.uuid4())
            tenant = {
                "id": tenant_id,
                "slug": data.get('business_slug', f"business-{tenant_id[:8]}"),
                "name": data.get('business_name'),
                "email": data.get('business_email', data.get('email')),
                "category": data.get('business_category', ''),
                "timezone": data.get('timezone', 'UTC'),
                "created_at": datetime.utcnow().isoformat()
            }
            tenants[tenant_id] = tenant
        
        return jsonify({
            "id": user_id,
            "email": user['email'],
            "tenant_id": tenant_id,
            "slug": tenants[tenant_id]['slug'] if tenant_id else None,
            "message": "Registration successful"
        }), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/v1/auth/signup', methods=['POST'])
def signup():
    """Signup endpoint - alias for register."""
    return register()

@app.route('/api/v1/onboarding/register', methods=['POST'])
def onboarding_register():
    """Register a new business during onboarding."""
    try:
        data = request.get_json()
        
        # Create tenant
        tenant_id = str(uuid.uuid4())
        slug = data.get('business_name', 'business').lower().replace(' ', '-')
        tenant = {
            "id": tenant_id,
            "slug": slug,
            "name": data.get('business_name'),
            "email": data.get('owner_email'),
            "category": data.get('category', ''),
            "timezone": data.get('timezone', 'UTC'),
            "currency": data.get('currency', 'USD'),
            "locale": data.get('locale', 'en_US'),
            "created_at": datetime.utcnow().isoformat()
        }
        tenants[tenant_id] = tenant
        
        return jsonify({
            "id": tenant_id,
            "slug": slug,
            "message": "Business registration successful"
        }), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/v1/onboarding/data', methods=['POST'])
def save_onboarding_data():
    """Save onboarding data."""
    try:
        data = request.get_json()
        tenant_id = data.get('tenant_id')
        
        if tenant_id:
            onboarding_data[tenant_id] = data
            return jsonify({"message": "Onboarding data saved"}), 200
        else:
            return jsonify({"error": "tenant_id is required"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/v1/onboarding/data/<tenant_id>', methods=['GET'])
def get_onboarding_data(tenant_id):
    """Get onboarding data."""
    try:
        if tenant_id in onboarding_data:
            return jsonify(onboarding_data[tenant_id]), 200
        else:
            return jsonify({"error": "Onboarding data not found"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/v1/categories', methods=['GET', 'POST'])
def categories():
    """Handle categories."""
    if request.method == 'GET':
        # Return empty list for now
        return jsonify({"categories": []}), 200
    elif request.method == 'POST':
        # Create a new category
        data = request.get_json()
        category_id = str(uuid.uuid4())
        category = {
            "id": category_id,
            "name": data.get('name'),
            "description": data.get('description', ''),
            "color": data.get('color', '#3B82F6'),
            "created_at": datetime.utcnow().isoformat()
        }
        return jsonify(category), 201

@app.route('/api/v1/services', methods=['GET', 'POST'])
def services():
    """Handle services."""
    if request.method == 'GET':
        # Return empty list for now
        return jsonify({"services": []}), 200
    elif request.method == 'POST':
        # Create a new service
        data = request.get_json()
        service_id = str(uuid.uuid4())
        service = {
            "id": service_id,
            "name": data.get('name'),
            "description": data.get('description', ''),
            "duration_minutes": data.get('duration_minutes', 60),
            "price_cents": data.get('price_cents', 0),
            "category": data.get('category', ''),
            "created_at": datetime.utcnow().isoformat()
        }
        return jsonify(service), 201

@app.route('/api/v1/analytics/events', methods=['POST'])
def analytics_events():
    """Handle analytics events."""
    try:
        data = request.get_json()
        # Just return success for now
        return jsonify({"message": "Event tracked"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/v1/staff', methods=['GET', 'POST'])
def staff():
    """Handle staff members."""
    if request.method == 'GET':
        # Return empty list for now
        return jsonify({"staff": []}), 200
    elif request.method == 'POST':
        # Create a new staff member
        data = request.get_json()
        staff_id = str(uuid.uuid4())
        staff_member = {
            "id": staff_id,
            "name": data.get('name'),
            "role": data.get('role', 'Staff Member'),
            "email": data.get('email', ''),
            "created_at": datetime.utcnow().isoformat()
        }
        return jsonify(staff_member), 201

@app.route('/api/v1/availability', methods=['GET', 'POST'])
def availability():
    """Handle availability."""
    if request.method == 'GET':
        # Return empty list for now
        return jsonify({"availability": []}), 200
    elif request.method == 'POST':
        # Save availability data
        data = request.get_json()
        return jsonify({"message": "Availability saved"}), 201

if __name__ == '__main__':
    print("🚀 Starting Minimal Tithi Backend Server")
    print("🔧 Running on http://localhost:5001")
    print("📚 Health Check: http://localhost:5001/health")
    
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True,
        threaded=True
    )