# Tithi Backend Makefile
# Provides convenient commands for development and E2E testing

.PHONY: help install migrate seed test e2e clean

# Default target
help:
	@echo "Tithi Backend Development Commands"
	@echo "=================================="
	@echo ""
	@echo "Setup Commands:"
	@echo "  install     Install Python dependencies"
	@echo "  migrate     Run database migrations"
	@echo "  seed        Create development seed data"
	@echo ""
	@echo "Testing Commands:"
	@echo "  test        Run all tests"
	@echo "  e2e         Run E2E tests (happy path + tenancy isolation)"
	@echo "  test-happy  Run only happy path E2E test"
	@echo "  test-tenant Run only tenancy isolation test"
	@echo ""
	@echo "Development Commands:"
	@echo "  dev         Start development server"
	@echo "  clean       Clean up temporary files"
	@echo ""
	@echo "Quick Start:"
	@echo "  make install && make migrate && make seed && make e2e"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	pip install -r requirements.txt
	@echo "✅ Dependencies installed"

# Run database migrations
migrate:
	@echo "🗄️  Running database migrations..."
	python -c "from app import create_app; from app.extensions import db; app = create_app('development'); app.app_context().push(); db.create_all()"
	@echo "✅ Database migrations completed"

# Create seed data
seed:
	@echo "🌱 Creating seed data..."
	python seed_dev.py
	@echo "✅ Seed data created"

# Run all tests
test:
	@echo "🧪 Running all tests..."
	python -m pytest tests/ -v
	@echo "✅ All tests completed"

# Run E2E tests
e2e:
	@echo "🧪 Running E2E tests..."
	python -m pytest tests/test_happy_path_e2e.py tests/test_tenancy_isolation.py -v -s
	@echo "✅ E2E tests completed"

# Run only happy path E2E test
test-happy:
	@echo "🧪 Running happy path E2E test..."
	python -m pytest tests/test_happy_path_e2e.py -v -s
	@echo "✅ Happy path test completed"

# Run only tenancy isolation test
test-tenant:
	@echo "🧪 Running tenancy isolation test..."
	python -m pytest tests/test_tenancy_isolation.py -v -s
	@echo "✅ Tenancy isolation test completed"

# Start development server
dev:
	@echo "🚀 Starting development server..."
	python index.py

# Clean up temporary files
clean:
	@echo "🧹 Cleaning up temporary files..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type f -name "*.log" -delete
	@echo "✅ Cleanup completed"

# Quick start: install, migrate, seed, and test
quickstart: install migrate seed e2e
	@echo "🎉 Quick start completed successfully!"
	@echo "You can now start the server with: make dev"
