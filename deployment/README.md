# SYNTHEX Deployment Guide

## Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start local server
cd public
python -m http.server 8000
# Visit http://localhost:8000
```

### Docker Deployment

1. **Prerequisites**
   - Docker installed and running
   - Node.js 22.x installed
   - Git repository access

2. **Deploy to Staging**
   ```powershell
   # Windows
   .\deployment\deploy.ps1 -Environment staging
   
   # Linux/Mac
   ./deployment/deploy.sh staging
   ```

3. **Deploy to Production**
   ```powershell
   # Windows
   .\deployment\deploy.ps1 -Environment production -EnableFeatureFlags
   
   # Linux/Mac
   FEATURE_FLAGS_ENABLED=true ./deployment/deploy.sh production
   ```

## Deployment Structure

```
deployment/
├── docker-compose.yml      # Docker services configuration
├── nginx.conf             # Web server configuration
├── Dockerfile             # API container definition
├── deploy.ps1            # Windows deployment script
├── deploy.sh             # Linux/Mac deployment script
├── feature-flags.js      # Feature flag management
├── rollout-script.js     # Gradual rollout controller
├── monitoring-dashboard.html # Real-time monitoring
└── testing-checklist.md  # Pre-deployment checklist
```

## Services

### Web Server (Nginx)
- Port: 80 (HTTP), 443 (HTTPS)
- Serves static files from `/public`
- Proxies API requests to backend
- Includes rate limiting and security headers

### API Server (Node.js)
- Port: 3000
- Handles backend logic
- WebSocket support for real-time features
- Health check endpoint: `/health`

## Feature Flags

Control feature rollout through `feature-flags.js`:

```javascript
// Enable a feature
const flags = new FeatureFlags();
flags.updateRollout('instagramOptimizer', 50); // 50% rollout

// Check if enabled
if (flags.isEnabled('instagramOptimizer', userId)) {
  // Feature is enabled for this user
}
```

## Monitoring

Access the monitoring dashboard at:
- Staging: http://staging.synthex.com/deployment/monitoring-dashboard.html
- Production: http://synthex.com/deployment/monitoring-dashboard.html

Key metrics:
- Error rate (< 5%)
- Page load time (< 3s)
- API latency (< 500ms)
- Memory usage (< 80%)

## Rollback

If issues occur, rollback immediately:

```powershell
# Windows - Automatic rollback
.\deployment\deploy.ps1 -Environment production
# Script will auto-rollback on failure

# Manual rollback
docker-compose -f deployment/docker-compose.yml down
# Restore from backups/ directory
```

## Environment Variables

Create `.env` file in root:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=your_database_url
ANTHROPIC_API_KEY=your_api_key
JWT_SECRET=your_jwt_secret
```

## SSL/HTTPS Setup

1. Place SSL certificates in `deployment/ssl/`:
   - `cert.pem` - SSL certificate
   - `key.pem` - Private key

2. Update `nginx.conf` to enable HTTPS:
   ```nginx
   server {
       listen 443 ssl;
       ssl_certificate /etc/nginx/ssl/cert.pem;
       ssl_certificate_key /etc/nginx/ssl/key.pem;
   }
   ```

## Troubleshooting

### Docker containers not starting
```bash
# Check logs
docker-compose logs -f synthex-web
docker-compose logs -f synthex-api

# Restart services
docker-compose restart
```

### Build failures
```bash
# Clean and rebuild
npm run clean
npm run build:prod
```

### Port conflicts
```bash
# Check ports
netstat -an | findstr :80
netstat -an | findstr :3000

# Stop conflicting services or change ports in docker-compose.yml
```

## Support

For deployment issues:
1. Check logs in `logs/` directory
2. Review monitoring dashboard
3. Contact DevOps team

## Next Steps

1. Set up CI/CD pipeline
2. Configure CDN for static assets
3. Implement automated backups
4. Set up alert notifications
5. Configure auto-scaling
