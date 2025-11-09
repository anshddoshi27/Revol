#!/usr/bin/env python3
"""
Tithi Development Seed Script

This script creates minimal seed data for E2E testing:
- 1 tenant (status='active')
- 1 service (30min, $100)
- Availability for next 7 days (10:00-16:00 weekdays)
- 1 customer

Usage:
    python seed_dev.py
"""

import os
import sys
import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.models.system import Theme
from app.models.availability import AvailabilityRule, AvailabilityException


def create_seed_data():
    """Create minimal seed data for E2E testing."""
    app = create_app('development')
    
    with app.app_context():
        # Create database tables if they don't exist
        db.create_all()
        
        # Check if seed data already exists
        existing_tenant = Tenant.query.filter_by(slug='salonx').first()
        if existing_tenant:
            print("✅ Seed data already exists (tenant 'salonx' found)")
            return
        
        print("🌱 Creating seed data...")
        
        # 1. Create tenant
        tenant = Tenant(
            id=uuid.UUID('01234567-89ab-cdef-0123-456789abcdef'),
            slug='salonx',
            name='SalonX',
            email='owner@salonx.com',
            status='active',
            tz='America/New_York',
            trust_copy_json={
                'tagline': 'Your trusted neighborhood salon',
                'guarantee': '100% satisfaction guaranteed'
            },
            is_public_directory=True,
            public_blurb='Modern salon services with experienced professionals',
            billing_json={'plan': 'pro', 'trial_days': 30}
        )
        db.session.add(tenant)
        
        # 2. Create theme
        theme = Theme(
            tenant_id=tenant.id,
            brand_color='#2563eb',
            logo_url='https://example.com/logo.png',
            theme_json={
                'layout': 'modern',
                'typography': 'sans-serif',
                'accent_color': '#f59e0b'
            }
        )
        db.session.add(theme)
        
        # 3. Create staff resource
        resource = Resource(
            id=uuid.UUID('11111111-1111-1111-1111-111111111111'),
            tenant_id=tenant.id,
            type='staff',
            name='Sarah Johnson',
            tz='America/New_York',
            capacity=1,
            is_active=True,
            metadata={
                'specialties': ['haircuts', 'styling'],
                'experience_years': 5
            }
        )
        db.session.add(resource)
        
        # 4. Create service
        service = Service(
            id=uuid.UUID('22222222-2222-2222-2222-222222222222'),
            tenant_id=tenant.id,
            slug='haircut-basic',
            name='Basic Haircut',
            description='Professional haircut and styling for all hair types',
            duration_min=30,  # 30 minutes as requested
            price_cents=10000,  # $100 as requested
            buffer_before_min=15,
            buffer_after_min=15,
            category='haircuts',
            active=True,
            metadata={
                'requires_consultation': False,
                'includes_wash': True
            }
        )
        db.session.add(service)
        
        # 5. Create customer
        customer = Customer(
            id=uuid.UUID('33333333-3333-3333-3333-333333333333'),
            tenant_id=tenant.id,
            email='customer@example.com',
            display_name='Test Customer',
            phone='+1234567890',
            marketing_opt_in=True,
            is_first_time=True
        )
        db.session.add(customer)
        
        # 6. Create availability for next 7 days (10:00-16:00 weekdays)
        today = datetime.now().date()
        for i in range(7):
            current_date = today + timedelta(days=i)
            # Skip weekends (Saturday=5, Sunday=6)
            if current_date.weekday() < 5:  # Monday=0, Friday=4
                availability_rule = AvailabilityRule(
                    tenant_id=tenant.id,
                    resource_id=resource.id,
                    day_of_week=current_date.weekday(),
                    start_time='10:00:00',
                    end_time='16:00:00',
                    is_active=True,
                    rule_type='recurring'
                )
                db.session.add(availability_rule)
        
        # 7. Create user and membership for admin access
        user = User(
            id=uuid.UUID('44444444-4444-4444-4444-444444444444'),
            email='admin@salonx.com',
            display_name='SalonX Admin'
        )
        db.session.add(user)
        
        membership = Membership(
            tenant_id=tenant.id,
            user_id=user.id,
            role='owner'
        )
        db.session.add(membership)
        
        # Commit all changes
        db.session.commit()
        
        print("✅ Seed data created successfully!")
        print(f"   - Tenant: {tenant.slug} ({tenant.name})")
        print(f"   - Service: {service.name} (${service.price_cents/100:.2f}, {service.duration_min}min)")
        print(f"   - Resource: {resource.name}")
        print(f"   - Customer: {customer.display_name} ({customer.email})")
        print(f"   - Availability: 10:00-16:00 weekdays for next 7 days")
        print(f"   - Admin user: {user.email}")


if __name__ == '__main__':
    create_seed_data()
