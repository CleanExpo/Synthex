# 🚀 SYNTHEX Deployment Workflow

## Quick Deploy (One Command)
```bash
npm run deploy:safe
```
This runs all checks and deploys if everything passes.

## Manual Deployment Process

### 1. Pre-Deployment Checks
```bash
# Run comprehensive diagnostics
npm run check:deploy

# Or run individual checks:
npm run diagnose        # Detailed build diagnostics
npm run check:quick     # Fast validation
```

### 2. If All Checks Pass
```bash
# Stage, commit, and push
npm run deploy:push
```

### 3. Monitor Deployment
- Watch progress at: https://vercel.com/dashboard
- Check deployment URL after completion

## Available Scripts

| Command | Description | Time |
|---------|-------------|------|
| `npm run check:deploy` | Full pre-deployment validation | ~2 min |
| `npm run diagnose` | Identify specific build issues | ~1 min |
| `npm run check:quick` | Fast dependency & config check | ~30 sec |
| `npm run deploy:safe` | Check everything then deploy | ~3 min |
| `npm run deploy:push` | Git add, commit, and push | ~10 sec |

## Troubleshooting Common Issues

### Build Fails on Vercel
```bash
# Run locally to reproduce
npm run build:vercel

# Check for missing env vars
npm run check:env
```

### Dependency Conflicts
```bash
# Clean install with legacy peer deps
npm run fix:deps
```

### TypeScript Errors
```bash
# Check types without building
npm run type-check
```

### Database Issues
```bash
# Validate and regenerate Prisma
npm run db:validate
```

## Environment Variables Required for Vercel

Make sure these are set in Vercel Dashboard:

- `DATABASE_URL` - PostgreSQL connection string
- `DIRECT_URL` - Direct database URL (for migrations)
- `NEXTAUTH_SECRET` - Random secret for NextAuth
- `NEXTAUTH_URL` - Production URL (https://your-app.vercel.app)
- `JWT_SECRET` - Secret for JWT tokens
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service key
- `OPENROUTER_API_KEY` - OpenRouter API key (if using AI features)

## Emergency Deployment

If you need to deploy immediately despite issues:

```bash
# Force deployment (skips some checks)
npm run deploy:emergency
```

⚠️ **Warning**: Only use this if you understand the risks!

## Post-Deployment Checklist

After successful deployment:

1. ✅ Verify production URL is accessible
2. ✅ Test authentication flow
3. ✅ Check API endpoints are responding
4. ✅ Verify database connections
5. ✅ Test critical user flows
6. ✅ Monitor error logs for 15 minutes

## Rollback Procedure

If issues are detected after deployment:

```bash
# Via Vercel Dashboard
# 1. Go to Deployments tab
# 2. Find previous working deployment
# 3. Click "..." menu → "Promote to Production"

# Or via CLI
vercel rollback
```

## Best Practices

1. **Always run checks before deploying**
   - Saves time by catching issues locally
   - Prevents broken deployments

2. **Commit meaningful messages**
   ```bash
   git commit -m "fix: [what] - [why]"
   git commit -m "feat: [feature] - [benefit]"
   ```

3. **Deploy during low-traffic periods**
   - Early morning or late evening
   - Avoid peak business hours

4. **Keep deployment logs**
   - Screenshot successful deployments
   - Note any warnings or issues

## Support

If deployment fails after following this guide:

1. Check `scripts/diagnose-build.js` output
2. Review Vercel build logs
3. Verify all environment variables are set
4. Check recent commits for breaking changes

---

Last Updated: 2025-08-16
Version: 2.0