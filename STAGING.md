# SYNTHEX Staging Environment

## Overview
The staging environment is a production-like environment used for testing and validation before deploying to production. It mirrors the production setup but with additional debugging capabilities and relaxed security constraints.

## URLs
- **Staging Site**: https://staging.synthex.social
- **Staging API**: https://staging.synthex.social/api/v1
- **Health Check**: https://staging.synthex.social/api/health

## Features
- ✅ Beta features enabled
- ✅ Debug mode available
- ✅ Enhanced logging
- ✅ Higher rate limits for testing
- ✅ Isolated database
- ✅ Service Worker enabled
- ✅ Performance monitoring
- ❌ Search engine indexing (noindex)

## Deployment

### Automatic Deployment
Pushing to the `staging` branch triggers automatic deployment via GitHub Actions.

```bash
git checkout staging
git merge main
git push origin staging
```

### Manual Deployment

#### Using npm scripts:
```bash
npm run deploy:staging
```

#### Using Vercel CLI:
```bash
vercel --env-file .env.staging --prod
```

#### Using Docker:
```bash
npm run docker:staging:build
npm run docker:staging
```

## Environment Variables
Staging uses `.env.staging` for configuration. Key variables include:

- `NODE_ENV=staging`
- `DATABASE_URL` - Staging database
- `JWT_SECRET` - Staging JWT secret
- `OPENROUTER_API_KEY` - Staging API key
- `ENABLE_BETA_FEATURES=true`
- `ENABLE_DEBUG_MODE=true`

## Testing

### Run Staging Tests
```bash
npm run staging:test
```

### E2E Tests Against Staging
```bash
BASE_URL=https://staging.synthex.social npm run test:e2e
```

### Smoke Tests
```bash
npm run test:e2e -- --grep @smoke
```

## Docker Setup

### Start Staging Environment
```bash
docker-compose -f docker-compose.staging.yml up
```

### Access Services
- **App**: http://localhost:3001
- **Nginx**: http://localhost:8081
- **PostgreSQL**: localhost:5433
- **Redis**: localhost:6380

### Stop Environment
```bash
docker-compose -f docker-compose.staging.yml down
```

### Clean Volumes
```bash
docker-compose -f docker-compose.staging.yml down -v
```

## CI/CD Pipeline

### GitHub Actions Workflow
The staging deployment is managed by `.github/workflows/staging.yml`

#### Pipeline Steps:
1. **Test** - Run unit tests and linting
2. **Build** - Build application and webpack bundles
3. **E2E Tests** - Run Playwright tests
4. **Deploy** - Deploy to Vercel staging
5. **Security Scan** - Run security audits
6. **Notify** - Send deployment notifications

### Manual Trigger
Trigger deployment from GitHub Actions UI:
1. Go to Actions tab
2. Select "Deploy to Staging" workflow
3. Click "Run workflow"
4. Select `staging` branch

## Database

### Migrations
```bash
# Create migration
npx prisma migrate dev --name your_migration_name

# Apply to staging
DATABASE_URL=$STAGING_DATABASE_URL npx prisma migrate deploy
```

### Seeding
```bash
# Seed staging database
DATABASE_URL=$STAGING_DATABASE_URL npx prisma db seed
```

## Monitoring

### Logs
- **Application Logs**: Available in Vercel dashboard
- **Error Tracking**: Sentry (staging project)
- **Performance**: Web Vitals tracked

### Health Checks
```bash
# Check staging health
curl https://staging.synthex.social/api/health

# Check with auth
curl -H "Authorization: Bearer $TOKEN" https://staging.synthex.social/api/v1/user
```

## Rollback

### Vercel Rollback
```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback <deployment-url>
```

### Git Rollback
```bash
# Revert last commit
git revert HEAD
git push origin staging

# Or reset to specific commit
git reset --hard <commit-hash>
git push origin staging --force
```

## Security

### Access Control
- Staging is password protected (optional)
- OAuth uses staging credentials
- API keys are staging-specific

### Headers
- `X-Environment: staging`
- `X-Robots-Tag: noindex, nofollow`
- CORS restricted to staging domain

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm ci
npm run staging:build
```

#### Database Connection
```bash
# Test connection
DATABASE_URL=$STAGING_DATABASE_URL npx prisma db pull
```

#### Docker Issues
```bash
# Reset everything
docker-compose -f docker-compose.staging.yml down -v
docker system prune -a
docker-compose -f docker-compose.staging.yml up --build
```

## Best Practices

1. **Always test in staging before production**
2. **Keep staging data separate from production**
3. **Use staging-specific API keys and credentials**
4. **Monitor staging for performance issues**
5. **Clean up test data regularly**
6. **Document any staging-specific configurations**
7. **Use feature flags for beta features**
8. **Run security scans before promoting to production**

## Contact
For issues with staging environment:
- Check deployment logs in Vercel
- Review GitHub Actions workflow
- Contact DevOps team

## Related Documentation
- [Production Deployment](./PRODUCTION.md)
- [Development Setup](./README.md)
- [CI/CD Pipeline](./.github/workflows/README.md)
- [Environment Variables](./config/environments.js)