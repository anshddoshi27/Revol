#!/bin/bash

# Tithi Production Monitoring Setup Script
# This script sets up the complete monitoring stack for production deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="/opt/tithi/monitoring"
PROMETHEUS_VERSION="2.45.0"
GRAFANA_VERSION="10.0.0"
ALERTMANAGER_VERSION="0.25.0"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        error "curl is not installed. Please install curl first."
        exit 1
    fi
    
    # Check available disk space (minimum 10GB)
    available_space=$(df / | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 10485760 ]; then
        warning "Less than 10GB disk space available. Monitoring stack may not work properly."
    fi
    
    success "System requirements check passed"
}

# Create monitoring directory structure
create_directories() {
    log "Creating monitoring directory structure..."
    
    sudo mkdir -p "$MONITORING_DIR"/{prometheus,grafana,alertmanager,logs}
    sudo mkdir -p "$MONITORING_DIR"/prometheus/{data,rules}
    sudo mkdir -p "$MONITORING_DIR"/grafana/{data,provisioning/{dashboards,datasources}}
    sudo mkdir -p "$MONITORING_DIR"/alertmanager/{data,templates}
    
    # Set proper permissions
    sudo chown -R $(whoami):$(whoami) "$MONITORING_DIR"
    sudo chmod -R 755 "$MONITORING_DIR"
    
    success "Directory structure created"
}

# Download and setup Prometheus
setup_prometheus() {
    log "Setting up Prometheus..."
    
    # Download Prometheus
    cd /tmp
    wget -q "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz"
    tar xzf "prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz"
    
    # Copy binaries
    sudo cp "prometheus-${PROMETHEUS_VERSION}.linux-amd64/prometheus" /usr/local/bin/
    sudo cp "prometheus-${PROMETHEUS_VERSION}.linux-amd64/promtool" /usr/local/bin/
    sudo chmod +x /usr/local/bin/prometheus /usr/local/bin/promtool
    
    # Create Prometheus configuration
    cat > "$MONITORING_DIR/prometheus/prometheus.yml" << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'tithi-backend'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 10s

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF
    
    # Create systemd service
    sudo tee /etc/systemd/system/prometheus.service > /dev/null << EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/prometheus \\
    --config.file=$MONITORING_DIR/prometheus/prometheus.yml \\
    --storage.tsdb.path=$MONITORING_DIR/prometheus/data \\
    --web.console.libraries=/usr/local/bin/prometheus/console_libraries \\
    --web.console.templates=/usr/local/bin/prometheus/consoles \\
    --web.enable-lifecycle \\
    --web.enable-admin-api

[Install]
WantedBy=multi-user.target
EOF
    
    # Create prometheus user
    sudo useradd --no-create-home --shell /bin/false prometheus || true
    sudo chown -R prometheus:prometheus "$MONITORING_DIR/prometheus"
    
    success "Prometheus setup completed"
}

# Download and setup Grafana
setup_grafana() {
    log "Setting up Grafana..."
    
    # Download Grafana
    cd /tmp
    wget -q "https://dl.grafana.com/oss/release/grafana-${GRAFANA_VERSION}.linux-amd64.tar.gz"
    tar xzf "grafana-${GRAFANA_VERSION}.linux-amd64.tar.gz"
    
    # Copy binaries
    sudo cp -r "grafana-${GRAFANA_VERSION}"/* /usr/local/bin/
    sudo chmod +x /usr/local/bin/grafana-server /usr/local/bin/grafana-cli
    
    # Create Grafana configuration
    cat > "$MONITORING_DIR/grafana/grafana.ini" << EOF
[server]
http_port = 3000
domain = localhost

[database]
type = sqlite3
path = $MONITORING_DIR/grafana/data/grafana.db

[security]
admin_user = admin
admin_password = \${GRAFANA_ADMIN_PASSWORD}

[log]
mode = console
level = info

[paths]
data = $MONITORING_DIR/grafana/data
logs = $MONITORING_DIR/logs
plugins = $MONITORING_DIR/grafana/plugins
provisioning = $MONITORING_DIR/grafana/provisioning
EOF
    
    # Create datasource configuration
    cat > "$MONITORING_DIR/grafana/provisioning/datasources/prometheus.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    editable: true
EOF
    
    # Create systemd service
    sudo tee /etc/systemd/system/grafana.service > /dev/null << EOF
[Unit]
Description=Grafana
Wants=network-online.target
After=network-online.target

[Service]
User=grafana
Group=grafana
Type=simple
ExecStart=/usr/local/bin/grafana-server \\
    --config=$MONITORING_DIR/grafana/grafana.ini \\
    --homepath=/usr/local/bin

[Install]
WantedBy=multi-user.target
EOF
    
    # Create grafana user
    sudo useradd --no-create-home --shell /bin/false grafana || true
    sudo chown -R grafana:grafana "$MONITORING_DIR/grafana"
    
    success "Grafana setup completed"
}

# Download and setup AlertManager
setup_alertmanager() {
    log "Setting up AlertManager..."
    
    # Download AlertManager
    cd /tmp
    wget -q "https://github.com/prometheus/alertmanager/releases/download/v${ALERTMANAGER_VERSION}/alertmanager-${ALERTMANAGER_VERSION}.linux-amd64.tar.gz"
    tar xzf "alertmanager-${ALERTMANAGER_VERSION}.linux-amd64.tar.gz"
    
    # Copy binaries
    sudo cp "alertmanager-${ALERTMANAGER_VERSION}.linux-amd64/alertmanager" /usr/local/bin/
    sudo cp "alertmanager-${ALERTMANAGER_VERSION}.linux-amd64/amtool" /usr/local/bin/
    sudo chmod +x /usr/local/bin/alertmanager /usr/local/bin/amtool
    
    # Create AlertManager configuration
    cat > "$MONITORING_DIR/alertmanager/alertmanager.yml" << EOF
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@tithi.com'

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default-receiver'

receivers:
  - name: 'default-receiver'
    slack_configs:
      - api_url: '\${SLACK_WEBHOOK_URL}'
        channel: '#tithi-alerts'
        title: 'Tithi Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        
  - name: 'critical-receiver'
    slack_configs:
      - api_url: '\${SLACK_WEBHOOK_URL}'
        channel: '#tithi-critical'
        title: 'CRITICAL: Tithi Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        
    pagerduty_configs:
      - service_key: '\${PAGERDUTY_SERVICE_KEY}'
        description: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
EOF
    
    # Create systemd service
    sudo tee /etc/systemd/system/alertmanager.service > /dev/null << EOF
[Unit]
Description=AlertManager
Wants=network-online.target
After=network-online.target

[Service]
User=alertmanager
Group=alertmanager
Type=simple
ExecStart=/usr/local/bin/alertmanager \\
    --config.file=$MONITORING_DIR/alertmanager/alertmanager.yml \\
    --storage.path=$MONITORING_DIR/alertmanager/data \\
    --web.external-url=http://localhost:9093

[Install]
WantedBy=multi-user.target
EOF
    
    # Create alertmanager user
    sudo useradd --no-create-home --shell /bin/false alertmanager || true
    sudo chown -R alertmanager:alertmanager "$MONITORING_DIR/alertmanager"
    
    success "AlertManager setup completed"
}

# Setup monitoring rules
setup_monitoring_rules() {
    log "Setting up monitoring rules..."
    
    # Copy alert rules
    cp "$(dirname "$0")/../monitoring/prometheus-alerts.yml" "$MONITORING_DIR/prometheus/rules/"
    
    # Validate rules
    promtool check rules "$MONITORING_DIR/prometheus/rules/prometheus-alerts.yml"
    
    success "Monitoring rules setup completed"
}

# Setup Grafana dashboards
setup_grafana_dashboards() {
    log "Setting up Grafana dashboards..."
    
    # Copy dashboard configuration
    cp "$(dirname "$0")/../monitoring/grafana-dashboard.json" "$MONITORING_DIR/grafana/provisioning/dashboards/"
    
    # Create dashboard provisioning configuration
    cat > "$MONITORING_DIR/grafana/provisioning/dashboards/dashboards.yml" << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: $MONITORING_DIR/grafana/provisioning/dashboards
EOF
    
    success "Grafana dashboards setup completed"
}

# Create monitoring environment file
create_env_file() {
    log "Creating monitoring environment file..."
    
    cat > "$MONITORING_DIR/.env" << EOF
# Monitoring Configuration
GRAFANA_ADMIN_PASSWORD=changeme123
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
PAGERDUTY_SERVICE_KEY=your_pagerduty_service_key
SENTRY_DSN=your_sentry_dsn
RELEASE_VERSION=1.0.0

# Prometheus Configuration
PROMETHEUS_RETENTION=30d
PROMETHEUS_SCRAPE_INTERVAL=15s

# Grafana Configuration
GRAFANA_PORT=3000
GRAFANA_DOMAIN=localhost

# AlertManager Configuration
ALERTMANAGER_PORT=9093
ALERTMANAGER_SMTP_HOST=localhost
ALERTMANAGER_SMTP_PORT=587
ALERTMANAGER_SMTP_FROM=alerts@tithi.com
EOF
    
    success "Environment file created"
}

# Enable and start services
start_services() {
    log "Starting monitoring services..."
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable services
    sudo systemctl enable prometheus
    sudo systemctl enable grafana
    sudo systemctl enable alertmanager
    
    # Start services
    sudo systemctl start prometheus
    sudo systemctl start grafana
    sudo systemctl start alertmanager
    
    # Wait for services to start
    sleep 10
    
    # Check service status
    if systemctl is-active --quiet prometheus; then
        success "Prometheus started successfully"
    else
        error "Failed to start Prometheus"
    fi
    
    if systemctl is-active --quiet grafana; then
        success "Grafana started successfully"
    else
        error "Failed to start Grafana"
    fi
    
    if systemctl is-active --quiet alertmanager; then
        success "AlertManager started successfully"
    else
        error "Failed to start AlertManager"
    fi
}

# Verify monitoring stack
verify_monitoring() {
    log "Verifying monitoring stack..."
    
    # Check Prometheus
    if curl -s http://localhost:9090/api/v1/status/config > /dev/null; then
        success "Prometheus is responding"
    else
        error "Prometheus is not responding"
    fi
    
    # Check Grafana
    if curl -s http://localhost:3000/api/health > /dev/null; then
        success "Grafana is responding"
    else
        error "Grafana is not responding"
    fi
    
    # Check AlertManager
    if curl -s http://localhost:9093/api/v1/status > /dev/null; then
        success "AlertManager is responding"
    else
        error "AlertManager is not responding"
    fi
    
    success "Monitoring stack verification completed"
}

# Create monitoring status script
create_status_script() {
    log "Creating monitoring status script..."
    
    cat > "$MONITORING_DIR/status.sh" << 'EOF'
#!/bin/bash

echo "=== Tithi Monitoring Stack Status ==="
echo

echo "Prometheus Status:"
systemctl status prometheus --no-pager -l
echo

echo "Grafana Status:"
systemctl status grafana --no-pager -l
echo

echo "AlertManager Status:"
systemctl status alertmanager --no-pager -l
echo

echo "Service URLs:"
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3000 (admin/changeme123)"
echo "AlertManager: http://localhost:9093"
echo

echo "Disk Usage:"
du -sh /opt/tithi/monitoring/*
echo

echo "Log Files:"
tail -n 10 /opt/tithi/monitoring/logs/*
EOF
    
    chmod +x "$MONITORING_DIR/status.sh"
    
    success "Status script created"
}

# Main execution
main() {
    log "Starting Tithi monitoring stack setup..."
    
    check_root
    check_requirements
    create_directories
    setup_prometheus
    setup_grafana
    setup_alertmanager
    setup_monitoring_rules
    setup_grafana_dashboards
    create_env_file
    start_services
    verify_monitoring
    create_status_script
    
    success "Tithi monitoring stack setup completed successfully!"
    
    echo
    echo "=== Access Information ==="
    echo "Prometheus: http://localhost:9090"
    echo "Grafana: http://localhost:3000 (admin/changeme123)"
    echo "AlertManager: http://localhost:9093"
    echo
    echo "=== Next Steps ==="
    echo "1. Update the .env file with your actual configuration values"
    echo "2. Import the Grafana dashboard from the provisioning directory"
    echo "3. Configure Slack/PagerDuty webhooks for alerting"
    echo "4. Run the status script: $MONITORING_DIR/status.sh"
    echo
    echo "=== Important Notes ==="
    echo "- Change the default Grafana admin password"
    echo "- Configure proper SSL certificates for production"
    echo "- Set up log rotation for monitoring logs"
    echo "- Configure firewall rules for monitoring ports"
    echo
}

# Run main function
main "$@"
