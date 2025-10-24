# Tithi E2E Quickstart Guide

This guide helps you run the core V1 flow end-to-end in 5 simple steps to verify everything works correctly.

## 🚀 Run the E2E in 5 Steps

### Step 1: Copy Environment Configuration
```bash
cd backend
cp .env.example .env
# Edit .env with your actual values (see below for required fields)
```

### Step 2: Install Dependencies
```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements.txt
```

### Step 3: Run Database Migrations
```bash
# Create database tables
python -c "from app import create_app; from app.extensions import db; app = create_app('development'); app.app_context().push(); db.create_all()"
```

### Step 4: Seed Development Data
```bash
# Create seed data (tenant, service, customer, availability)
python seed_dev.py
```

### Step 5: Run E2E Tests
```bash
# Run the happy path E2E test
python -m pytest tests/test_happy_path_e2e.py -v -s

# Run tenancy isolation test
python -m pytest tests/test_tenancy_isolation.py -v -s
```

## 🔧 Required Environment Variables

For the E2E tests to work, you need these minimum values in your `.env` file:

```bash
# App essentials
APP_URL=http://localhost:5000
DB_URL=sqlite:///instance/dev.db
JWT_SECRET=dev-jwt-secret-key-change-in-production
ENV=development

# Stripe (use test keys)
STRIPE_SECRET_KEY=sk_test_51...your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_51...your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_...your_webhook_secret_here

# Email (console output for dev)
EMAIL_PROVIDER=console
SMTP_HOST=localhost
SMTP_USER=
SMTP_PASS=

# SMS (optional for E2E)
TWILIO_ACCOUNT_SID=AC...your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=...your_twilio_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
```

## 📋 What the E2E Tests Verify

### Happy Path E2E Test (`test_happy_path_e2e.py`)
1. ✅ **Tenant Resolution**: Resolves tenant config from slug
2. ✅ **Service Retrieval**: Gets service details and pricing
3. ✅ **Booking Creation**: Creates booking for valid time slot
4. ✅ **Payment Processing**: Creates Stripe PaymentIntent and simulates success
5. ✅ **Booking Confirmation**: Updates booking status to 'confirmed'
6. ✅ **Notification Delivery**: Sends confirmation notification
7. ✅ **Template Rendering**: Verifies placeholders in notification body

### Tenancy Isolation Test (`test_tenancy_isolation.py`)
1. ✅ **Data Isolation**: Tenant B cannot read Tenant A's data
2. ✅ **Query Scoping**: All queries properly scoped by tenant_id
3. ✅ **Cross-Tenant Prevention**: No data leakage between tenants
4. ✅ **Data Integrity**: Maintains referential integrity across tenants

## 🎯 Expected Results

After running the tests, you should see:

```
✅ Step 1: Tenant resolved successfully
✅ Step 2: Service retrieved successfully
✅ Step 3: Booking created successfully
✅ Step 4a: PaymentIntent created successfully
✅ Step 4b: Payment confirmed successfully
✅ Step 5: Booking confirmed successfully
✅ Step 6: Notification sent successfully
✅ Step 7: Notification template placeholders verified
🎉 Happy path E2E test completed successfully!
```

## 🐛 Troubleshooting

### Common Issues

1. **Database not found**: Run migrations first
2. **Stripe errors**: Use test keys, not live keys
3. **Import errors**: Make sure you're in the backend directory
4. **Permission errors**: Check file permissions on .env file

### Debug Mode

Run tests with more verbose output:
```bash
python -m pytest tests/test_happy_path_e2e.py -v -s --tb=short
```

### Check Seed Data

Verify seed data was created:
```bash
python -c "
from app import create_app
from app.extensions import db
from app.models.core import Tenant
from app.models.business import Customer, Service, Resource

app = create_app('development')
with app.app_context():
    tenant = Tenant.query.filter_by(slug='salonx').first()
    if tenant:
        print(f'✅ Tenant: {tenant.slug} ({tenant.name})')
        print(f'✅ Customers: {Customer.query.filter_by(tenant_id=tenant.id).count()}')
        print(f'✅ Services: {Service.query.filter_by(tenant_id=tenant.id).count()}')
        print(f'✅ Resources: {Resource.query.filter_by(tenant_id=tenant.id).count()}')
    else:
        print('❌ No seed data found. Run: python seed_dev.py')
"
```

## 🚀 Next Steps

Once the E2E tests pass:

1. **Start the server**: `python index.py`
2. **Test API endpoints**: Visit `http://localhost:5000/api/docs`
3. **Create real bookings**: Use the API to create actual bookings
4. **Monitor logs**: Check for any errors or warnings

## 📚 Additional Resources

- **API Documentation**: `http://localhost:5000/api/docs`
- **Database Schema**: Check `backend/app/models/` for model definitions
- **Service Layer**: Check `backend/app/services/` for business logic
- **Configuration**: Check `backend/app/config.py` for environment settings

---

**Note**: This is a lean, focused E2E test suite designed to verify the core V1 flow works end-to-end. It's not a comprehensive test suite but rather a "smoke test" to catch critical issues early.
