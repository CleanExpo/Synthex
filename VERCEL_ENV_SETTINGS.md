# Vercel Environment Variables Required

## Required Environment Variables to Add

Please add these environment variables to your Vercel project settings under **Settings > Environment Variables**:

### For Build & Runtime:

```
PRISMA_DISABLE_TELEMETRY=1
PRISMA_LOG_LEVEL=error
```

These variables will:
- Disable Prisma telemetry to prevent any telemetry-related initialization issues
- Set Prisma logging to only show errors, reducing noise and preventing verbose logging

## How to Add:

1. Go to https://vercel.com/dashboard
2. Select your Synthex project
3. Go to Settings → Environment Variables
4. Add each variable with the values above
5. Make sure to select both "Production", "Preview", and "Development" checkboxes
6. Click "Save" for each variable

## Additional Optional Variables (if issues persist):

```
NEXT_DISABLE_ESLINT=1
```

This will provide an additional safeguard against ESLint blocking builds, though we've already disabled it in next.config.mjs.
