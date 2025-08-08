# Synthex Docker Setup Guide

This guide provides comprehensive instructions for running Synthex using Docker in both development and production environments.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2.0+
- Make (optional, for easier commands)
- Git

## Quick Start

### Development Environment

1. **Clone and setup:**
```bash
git clone https://github.com/CleanExpo/Synthex.git
cd Synthex
cp .env.example .env
```

2. **Start development environment:**
```bash
# Using Make (recommended)
make dev

# Or using Docker Compose directly
docker-compose up -d
```

3. **Access services:**
- **Application**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Database**: localhost:5432
- **Redis**: localhost:6379

### Production Environment

1. **Setup environment variables:**
```bash
cp .env.example .env.production
# Edit .env.production with production values
```

2. **Start production environment:**
```bash
# Using Make
make prod

# Or using Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

## Architecture Overview

### Development Stack
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Nginx    │────│  Synthex    │────│ PostgreSQL  │
│   (Proxy)   │    │    App      │    │ Database    │
│   Port 80   │    │  Port 3000  │    │ Port 5432   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                  ┌─────────────┐
                  │    Redis    │
                  │   Cache     │
                  │ Port 6379   │
                  └─────────────┘
```

### Production Stack
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Nginx     │    │  Synthex    │    │ External    │
│ Load Balancer│────│ App (x2)    │────│ Database    │
│ Ports 80/443│    │             │    │ (Managed)   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │
┌─────────────┐    ┌─────────────┐
│ Prometheus  │    │   Grafana   │
│ Monitoring  │    │ Dashboard   │
│ Port 9090   │    │ Port 3001   │
└─────────────┘    └─────────────┘
```

## Services Overview

### Application Services
- **app**: Main Synthex application (Node.js/TypeScript)
- **postgres**: PostgreSQL database (development only)
- **redis**: Redis cache and session store
- **nginx**: Reverse proxy and load balancer

### Monitoring Services
- **prometheus**: Metrics collection and alerting
- **grafana**: Metrics visualization and dashboards
- **loki**: Log aggregation (production only)
- **promtail**: Log collection agent (production only)

## Environment Configuration

### Development (.env)
```bash
NODE_ENV=development
DATABASE_URL=postgresql://synthex_user:synthex_pass@postgres:5432/synthex_dev
REDIS_URL=redis://:synthex_redis_pass@redis:6379
JWT_SECRET=your_jwt_secret_here
API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here
```

### Production (.env.production)
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@external-db:5432/synthex_prod
REDIS_URL=redis://external-redis:6379
JWT_SECRET=super_secure_jwt_secret
API_KEY=production_api_key
OPENAI_API_KEY=production_openai_key
GRAFANA_PASSWORD=secure_grafana_password
```

## Commands Reference

### Using Make (Recommended)

```bash
# View all available commands
make help

# Development
make build          # Build Docker images
make dev            # Start development environment
make logs           # View all service logs
make shell          # Open shell in app container

# Database operations
make db-migrate     # Run database migrations
make db-seed        # Seed database with initial data

# Maintenance
make stop           # Stop all services
make clean          # Clean up containers and volumes
make health         # Check service health

# Testing
make test           # Run tests in container
```

### Using Docker Compose Directly

```bash
# Development
docker-compose up -d
docker-compose logs -f
docker-compose down

# Production
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml logs -f
docker-compose -f docker-compose.prod.yml down

# Individual services
docker-compose restart app
docker-compose exec app npm test
docker-compose exec app sh
```

## Development Workflow

### 1. Initial Setup
```bash
# Clone repository
git clone https://github.com/CleanExpo/Synthex.git
cd Synthex

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start development environment
make dev
```

### 2. Development Process
```bash
# View logs while developing
make logs

# Run tests
make test

# Access database
docker-compose exec postgres psql -U synthex_user -d synthex_dev

# Access Redis
docker-compose exec redis redis-cli -a synthex_redis_pass
```

### 3. Code Changes
- Code changes are automatically reflected (hot reload)
- Database changes require migration: `make db-migrate`
- Environment changes require restart: `make stop && make dev`

## Production Deployment

### 1. Preparation
```bash
# Setup production environment file
cp .env.example .env.production
# Configure with production values

# Build optimized images
docker-compose -f docker-compose.prod.yml build
```

### 2. Deployment
```bash
# Start production services
make prod

# Verify deployment
make health

# Monitor logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Scaling
```bash
# Scale application instances
docker-compose -f docker-compose.prod.yml up -d --scale app=4
```

## Monitoring and Observability

### Prometheus Metrics
- **Application metrics**: http://localhost:9090
- **Custom metrics**: Available at `/metrics` endpoint
- **Alerting rules**: Configured in `monitoring/prometheus.yml`

### Grafana Dashboards
- **Access**: http://localhost:3001 (admin/admin)
- **Pre-configured dashboards**: Application performance, system metrics
- **Custom dashboards**: Can be added via UI or provisioning

### Log Management
- **Development**: `docker-compose logs`
- **Production**: Loki + Promtail for centralized logging
- **Log retention**: Configurable per environment

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check port usage
netstat -an | grep :3000

# Stop conflicting services
docker-compose down
```

#### Database Connection Issues
```bash
# Check database logs
docker-compose logs postgres

# Reset database
make clean
make dev
make db-migrate
```

#### Memory Issues
```bash
# Check resource usage
docker stats

# Increase Docker memory limit in Docker Desktop
```

### Health Checks

#### Application Health
```bash
curl http://localhost:3000/health
```

#### Database Health
```bash
docker-compose exec postgres pg_isready -U synthex_user
```

#### Redis Health
```bash
docker-compose exec redis redis-cli -a synthex_redis_pass ping
```

## Security Considerations

### Development
- Default passwords are used for convenience
- Services are exposed on localhost only
- SSL/TLS not configured by default

### Production
- Use strong, unique passwords
- Configure SSL/TLS certificates
- Implement proper firewall rules
- Regular security updates

## Performance Tuning

### Database Optimization
- Configure PostgreSQL for production workload
- Implement connection pooling
- Regular maintenance and vacuuming

### Redis Configuration
- Configure appropriate memory limits
- Set up persistence for critical data
- Implement clustering for high availability

### Application Scaling
- Use multiple app instances behind load balancer
- Implement horizontal pod autoscaling
- Monitor resource usage and scale accordingly

## Backup and Recovery

### Database Backups
```bash
# Create backup
docker-compose exec postgres pg_dump -U synthex_user synthex_dev > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U synthex_user synthex_dev < backup.sql
```

### Volume Backups
```bash
# Backup volumes
docker run --rm -v synthex_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data

# Restore volumes
docker run --rm -v synthex_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker Build and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Build and test
      run: |
        make build
        make test
    
    - name: Deploy to production
      run: make prod
```

## Support

For issues and questions:
- Check the [troubleshooting section](#troubleshooting)
- Review Docker logs: `make logs`
- Create an issue on GitHub
- Consult the main README.md for application-specific guidance
