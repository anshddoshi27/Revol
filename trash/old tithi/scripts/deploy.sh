#!/bin/bash

# Tithi Deployment Script
# Supports blue-green deployments with rollback capabilities

set -e

# Configuration
VERSION=${1:-latest}
ENVIRONMENT=${2:-production}
CONFIG_FILE=${3:-/opt/tithi/config/deployment.json}
BACKUP_DIR=${4:-/opt/tithi/backups}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check if docker-compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed"
        exit 1
    fi
    
    # Check if nginx is installed
    if ! command -v nginx &> /dev/null; then
        log_error "Nginx is not installed"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    BACKUP_FILE="${BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    mkdir -p "$BACKUP_DIR"
    
    tar -czf "$BACKUP_FILE" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.log' \
        /opt/tithi/
    
    log_info "Backup created: $BACKUP_FILE"
    echo "$BACKUP_FILE"
}

# Build Docker image
build_image() {
    log_info "Building Docker image for version $VERSION..."
    
    cd /opt/tithi/backend
    
    docker build -t "tithi-backend:$VERSION" .
    
    if [ $? -eq 0 ]; then
        log_info "Docker image built successfully"
    else
        log_error "Failed to build Docker image"
        exit 1
    fi
}

# Deploy to environment
deploy_to_environment() {
    local env=$1
    local version=$2
    
    log_info "Deploying to $env environment..."
    
    # Update docker-compose file
    COMPOSE_FILE="/opt/tithi/docker-compose.$env.yml"
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    # Update image version in compose file
    sed -i "s/tithi-backend:latest/tithi-backend:$version/g" "$COMPOSE_FILE"
    
    # Deploy using docker-compose
    docker-compose -f "$COMPOSE_FILE" up -d
    
    if [ $? -eq 0 ]; then
        log_info "Deployed to $env environment successfully"
    else
        log_error "Failed to deploy to $env environment"
        exit 1
    fi
}

# Run health checks
run_health_checks() {
    local env=$1
    local port=$([ "$env" = "blue" ] && echo "5000" || echo "5001")
    local max_attempts=30
    local attempt=1
    
    log_info "Running health checks for $env environment..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:$port/health/live" > /dev/null; then
            log_info "Health check passed for $env environment"
            return 0
        fi
        
        log_warn "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Health checks failed for $env environment"
    return 1
}

# Switch traffic
switch_traffic() {
    local env=$1
    local port=$([ "$env" = "blue" ] && echo "5000" || echo "5001")
    
    log_info "Switching traffic to $env environment..."
    
    # Update nginx configuration
    cat > /etc/nginx/sites-available/tithi << EOF
upstream tithi_backend {
    server localhost:$port;
}

server {
    listen 80;
    server_name tithi.com;
    
    location / {
        proxy_pass http://tithi_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    # Test nginx configuration
    nginx -t
    
    if [ $? -eq 0 ]; then
        # Reload nginx
        nginx -s reload
        log_info "Traffic switched to $env environment successfully"
    else
        log_error "Nginx configuration test failed"
        exit 1
    fi
}

# Get current environment
get_current_environment() {
    if curl -s -f "http://localhost:5000/health/live" > /dev/null; then
        echo "blue"
    elif curl -s -f "http://localhost:5001/health/live" > /dev/null; then
        echo "green"
    else
        echo "blue"  # Default
    fi
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."
    
    local current_env=$(get_current_environment)
    local target_env=$([ "$current_env" = "blue" ] && echo "green" || echo "blue")
    
    log_info "Rolling back from $current_env to $target_env"
    
    # Switch traffic back
    switch_traffic "$target_env"
    
    # Run health checks
    run_health_checks "$target_env"
    
    log_info "Rollback completed successfully"
}

# Main deployment function
deploy() {
    log_info "Starting deployment of version $VERSION to $ENVIRONMENT"
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    BACKUP_FILE=$(create_backup)
    
    # Build image
    build_image
    
    # Get current environment
    CURRENT_ENV=$(get_current_environment)
    TARGET_ENV=$([ "$CURRENT_ENV" = "blue" ] && echo "green" || echo "blue")
    
    log_info "Current environment: $CURRENT_ENV, Target environment: $TARGET_ENV"
    
    # Deploy to target environment
    deploy_to_environment "$TARGET_ENV" "$VERSION"
    
    # Run health checks
    if run_health_checks "$TARGET_ENV"; then
        # Switch traffic
        switch_traffic "$TARGET_ENV"
        
        # Final health check
        run_health_checks "$TARGET_ENV"
        
        log_info "Deployment completed successfully!"
        log_info "Version $VERSION is now live on $TARGET_ENV environment"
    else
        log_error "Health checks failed, rolling back..."
        rollback_deployment
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 <version> [environment] [config_file] [backup_dir]"
    echo ""
    echo "Arguments:"
    echo "  version      Docker image version to deploy (default: latest)"
    echo "  environment  Target environment (default: production)"
    echo "  config_file  Deployment configuration file (default: /opt/tithi/config/deployment.json)"
    echo "  backup_dir   Backup directory (default: /opt/tithi/backups)"
    echo ""
    echo "Examples:"
    echo "  $0 v1.2.3"
    echo "  $0 v1.2.3 production"
    echo "  $0 v1.2.3 production /opt/tithi/config/deploy.json"
}

# Main script
main() {
    case "${1:-}" in
        -h|--help)
            show_usage
            exit 0
            ;;
        rollback)
            rollback_deployment
            exit 0
            ;;
        *)
            deploy
            ;;
    esac
}

# Run main function
main "$@"
