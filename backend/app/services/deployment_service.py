"""
Deployment Service
Manages blue-green deployments, rollbacks, and deployment automation
"""

import os
import subprocess
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import structlog
from app.extensions import db
from app.models.deployment import Deployment

logger = structlog.get_logger(__name__)


class DeploymentService:
    """Service for managing deployments and rollbacks."""
    
    def __init__(self):
        self.deployment_config = {
            'blue_port': 5000,
            'green_port': 5001,
            'nginx_config_path': '/etc/nginx/sites-available/tithi',
            'docker_compose_path': '/opt/tithi/docker-compose.yml',
            'backup_path': '/opt/tithi/backups',
            'health_check_endpoint': '/health/live',
            'health_check_timeout': 30,
            'rollback_timeout': 300
        }
    
    def start_blue_green_deployment(self, version: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Start a blue-green deployment."""
        try:
            logger.info("Starting blue-green deployment", version=version)
            
            # Determine current environment (blue or green)
            current_env = self._get_current_environment()
            target_env = 'green' if current_env == 'blue' else 'blue'
            
            # Create deployment record
            deployment = Deployment(
                version=version,
                environment=target_env,
                status='in_progress',
                config=config,
                started_at=datetime.utcnow()
            )
            db.session.add(deployment)
            db.session.commit()
            
            # Deploy to target environment
            deploy_result = self._deploy_to_environment(target_env, version, config)
            
            if not deploy_result['success']:
                deployment.status = 'failed'
                deployment.error_message = deploy_result['error']
                db.session.commit()
                return {
                    'deployment_id': deployment.id,
                    'status': 'failed',
                    'error': deploy_result['error']
                }
            
            # Run health checks
            health_result = self._run_health_checks(target_env)
            
            if not health_result['success']:
                deployment.status = 'failed'
                deployment.error_message = health_result['error']
                db.session.commit()
                return {
                    'deployment_id': deployment.id,
                    'status': 'failed',
                    'error': health_result['error']
                }
            
            # Switch traffic to new environment
            switch_result = self._switch_traffic(target_env)
            
            if not switch_result['success']:
                deployment.status = 'failed'
                deployment.error_message = switch_result['error']
                db.session.commit()
                return {
                    'deployment_id': deployment.id,
                    'status': 'failed',
                    'error': switch_result['error']
                }
            
            # Update deployment status
            deployment.status = 'completed'
            deployment.completed_at = datetime.utcnow()
            db.session.commit()
            
            logger.info("Blue-green deployment completed", 
                       deployment_id=deployment.id,
                       version=version,
                       environment=target_env)
            
            return {
                'deployment_id': deployment.id,
                'status': 'completed',
                'environment': target_env,
                'version': version
            }
            
        except Exception as e:
            logger.error("Blue-green deployment failed", error=str(e), version=version)
            raise
    
    def rollback_deployment(self, deployment_id: int) -> Dict[str, Any]:
        """Rollback to previous deployment."""
        try:
            logger.info("Starting deployment rollback", deployment_id=deployment_id)
            
            # Get current deployment
            current_deployment = db.session.query(Deployment).get(deployment_id)
            if not current_deployment:
                raise ValueError(f"Deployment {deployment_id} not found")
            
            # Get previous successful deployment
            previous_deployment = db.session.query(Deployment).filter(
                Deployment.status == 'completed',
                Deployment.id < deployment_id
            ).order_by(Deployment.id.desc()).first()
            
            if not previous_deployment:
                raise ValueError("No previous deployment found for rollback")
            
            # Create rollback record
            rollback_deployment = Deployment(
                version=previous_deployment.version,
                environment=current_deployment.environment,
                status='rollback_in_progress',
                config=previous_deployment.config,
                started_at=datetime.utcnow(),
                parent_deployment_id=deployment_id
            )
            db.session.add(rollback_deployment)
            db.session.commit()
            
            # Switch traffic back to previous environment
            previous_env = self._get_previous_environment(current_deployment.environment)
            switch_result = self._switch_traffic(previous_env)
            
            if not switch_result['success']:
                rollback_deployment.status = 'rollback_failed'
                rollback_deployment.error_message = switch_result['error']
                db.session.commit()
                return {
                    'rollback_id': rollback_deployment.id,
                    'status': 'failed',
                    'error': switch_result['error']
                }
            
            # Run health checks
            health_result = self._run_health_checks(previous_env)
            
            if not health_result['success']:
                rollback_deployment.status = 'rollback_failed'
                rollback_deployment.error_message = health_result['error']
                db.session.commit()
                return {
                    'rollback_id': rollback_deployment.id,
                    'status': 'failed',
                    'error': health_result['error']
                }
            
            # Update rollback status
            rollback_deployment.status = 'rollback_completed'
            rollback_deployment.completed_at = datetime.utcnow()
            
            # Mark current deployment as rolled back
            current_deployment.status = 'rolled_back'
            current_deployment.rolled_back_at = datetime.utcnow()
            
            db.session.commit()
            
            logger.info("Deployment rollback completed", 
                       rollback_id=rollback_deployment.id,
                       original_deployment_id=deployment_id)
            
            return {
                'rollback_id': rollback_deployment.id,
                'status': 'completed',
                'environment': previous_env,
                'version': previous_deployment.version
            }
            
        except Exception as e:
            logger.error("Deployment rollback failed", error=str(e), deployment_id=deployment_id)
            raise
    
    def get_deployment_status(self, deployment_id: int) -> Dict[str, Any]:
        """Get deployment status and metrics."""
        try:
            deployment = db.session.query(Deployment).get(deployment_id)
            if not deployment:
                raise ValueError(f"Deployment {deployment_id} not found")
            
            # Get deployment metrics
            metrics = self._get_deployment_metrics(deployment)
            
            return {
                'deployment_id': deployment.id,
                'version': deployment.version,
                'environment': deployment.environment,
                'status': deployment.status,
                'started_at': deployment.started_at.isoformat(),
                'completed_at': deployment.completed_at.isoformat() if deployment.completed_at else None,
                'error_message': deployment.error_message,
                'metrics': metrics
            }
            
        except Exception as e:
            logger.error("Failed to get deployment status", error=str(e), deployment_id=deployment_id)
            raise
    
    def list_deployments(self, limit: int = 10) -> List[Dict[str, Any]]:
        """List recent deployments."""
        try:
            deployments = db.session.query(Deployment).order_by(
                Deployment.id.desc()
            ).limit(limit).all()
            
            return [
                {
                    'deployment_id': d.id,
                    'version': d.version,
                    'environment': d.environment,
                    'status': d.status,
                    'started_at': d.started_at.isoformat(),
                    'completed_at': d.completed_at.isoformat() if d.completed_at else None
                }
                for d in deployments
            ]
            
        except Exception as e:
            logger.error("Failed to list deployments", error=str(e))
            raise
    
    def _get_current_environment(self) -> str:
        """Get current active environment."""
        try:
            # Check which port is currently active
            result = subprocess.run(['curl', '-s', f'http://localhost:{self.deployment_config["blue_port"]}/health/live'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return 'blue'
            
            result = subprocess.run(['curl', '-s', f'http://localhost:{self.deployment_config["green_port"]}/health/live'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return 'green'
            
            return 'blue'  # Default to blue
            
        except Exception:
            return 'blue'
    
    def _get_previous_environment(self, current_env: str) -> str:
        """Get previous environment for rollback."""
        return 'green' if current_env == 'blue' else 'blue'
    
    def _deploy_to_environment(self, environment: str, version: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy to specific environment."""
        try:
            logger.info("Deploying to environment", environment=environment, version=version)
            
            # Build Docker image
            build_result = self._build_docker_image(version)
            if not build_result['success']:
                return build_result
            
            # Deploy to environment
            deploy_result = self._deploy_docker_image(environment, version)
            if not deploy_result['success']:
                return deploy_result
            
            # Wait for service to start
            time.sleep(10)
            
            return {'success': True}
            
        except Exception as e:
            logger.error("Deployment to environment failed", error=str(e), environment=environment)
            return {'success': False, 'error': str(e)}
    
    def _build_docker_image(self, version: str) -> Dict[str, Any]:
        """Build Docker image for deployment."""
        try:
            cmd = ['docker', 'build', '-t', f'tithi-backend:{version}', '.']
            result = subprocess.run(cmd, capture_output=True, text=True, cwd='/opt/tithi/backend')
            
            if result.returncode != 0:
                return {'success': False, 'error': result.stderr}
            
            return {'success': True}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _deploy_docker_image(self, environment: str, version: str) -> Dict[str, Any]:
        """Deploy Docker image to environment."""
        try:
            # Update docker-compose.yml with new image
            compose_file = f'/opt/tithi/docker-compose.{environment}.yml'
            self._update_compose_file(compose_file, version)
            
            # Deploy using docker-compose
            cmd = ['docker-compose', '-f', compose_file, 'up', '-d']
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                return {'success': False, 'error': result.stderr}
            
            return {'success': True}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _update_compose_file(self, compose_file: str, version: str):
        """Update docker-compose file with new image version."""
        try:
            with open(compose_file, 'r') as f:
                content = f.read()
            
            # Replace image version
            updated_content = content.replace('tithi-backend:latest', f'tithi-backend:{version}')
            
            with open(compose_file, 'w') as f:
                f.write(updated_content)
                
        except Exception as e:
            logger.error("Failed to update compose file", error=str(e))
            raise
    
    def _run_health_checks(self, environment: str) -> Dict[str, Any]:
        """Run health checks for environment."""
        try:
            port = self.deployment_config['blue_port'] if environment == 'blue' else self.deployment_config['green_port']
            endpoint = f'http://localhost:{port}{self.deployment_config["health_check_endpoint"]}'
            
            # Run health check
            result = subprocess.run(['curl', '-s', '-f', endpoint], 
                                  capture_output=True, text=True, 
                                  timeout=self.deployment_config['health_check_timeout'])
            
            if result.returncode != 0:
                return {'success': False, 'error': f'Health check failed: {result.stderr}'}
            
            # Parse health check response
            health_data = json.loads(result.stdout)
            if not health_data.get('status') == 'healthy':
                return {'success': False, 'error': 'Service is not healthy'}
            
            return {'success': True}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _switch_traffic(self, environment: str) -> Dict[str, Any]:
        """Switch traffic to specified environment."""
        try:
            logger.info("Switching traffic", environment=environment)
            
            # Update nginx configuration
            self._update_nginx_config(environment)
            
            # Reload nginx
            result = subprocess.run(['nginx', '-s', 'reload'], capture_output=True, text=True)
            if result.returncode != 0:
                return {'success': False, 'error': f'Nginx reload failed: {result.stderr}'}
            
            # Wait for traffic to switch
            time.sleep(5)
            
            return {'success': True}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _update_nginx_config(self, environment: str):
        """Update nginx configuration for environment."""
        try:
            port = self.deployment_config['blue_port'] if environment == 'blue' else self.deployment_config['green_port']
            
            # Update nginx config to point to new environment
            nginx_config = f"""
upstream tithi_backend {{
    server localhost:{port};
}}

server {{
    listen 80;
    server_name tithi.com;
    
    location / {{
        proxy_pass http://tithi_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""
            
            with open(self.deployment_config['nginx_config_path'], 'w') as f:
                f.write(nginx_config)
                
        except Exception as e:
            logger.error("Failed to update nginx config", error=str(e))
            raise
    
    def _get_deployment_metrics(self, deployment: Deployment) -> Dict[str, Any]:
        """Get deployment metrics."""
        try:
            # This would integrate with your monitoring system
            # For now, return placeholder metrics
            return {
                'response_time': 0.5,
                'error_rate': 0.01,
                'throughput': 1000,
                'uptime': 99.9
            }
            
        except Exception as e:
            logger.error("Failed to get deployment metrics", error=str(e))
            return {}


# Global deployment service instance
deployment_service = DeploymentService()
