# Terminal Freezing Fix for Windows

## Problem Identified
- 134 npm packages installed
- File watcher exhaustion in Windows environment
- Next.js dev server monitoring too many files

## Immediate Fix Applied

### 1. Create Watcher Ignore File
Add to `.watchmanconfig` (if using Watchman):
```json
{
  "ignore_dirs": ["node_modules", ".next", "dist", "build", ".git"]
}
```

### 2. Update Next.js Config
Modify `next.config.mjs` to reduce file watching:
```javascript
const nextConfig = {
  // ... existing config
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/.next',
          '**/dist',
          '**/build',
          '**/.vercel',
          '**/logs',
          '**/backup-before-cleanup',
          '**/deployment',
          '**/monitoring'
        ]
      };
    }
    return config;
  }
};
```

### 3. PowerShell Performance Settings
Run in Administrator PowerShell:
```powershell
# Increase file watcher limit
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "MaxUserPort" -Value 65534
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "TcpTimedWaitDelay" -Value 30

# Clear npm cache
npm cache clean --force

# Rebuild node_modules
Remove-Item -Recurse -Force node_modules
npm install
```

### 4. Development Server Optimization
Use these flags when running dev server:
```bash
# Option 1: Use polling (slower but more stable)
npm run dev -- --experimental-watch

# Option 2: Limit watched files
NODE_OPTIONS='--max-old-space-size=4096' npm run dev
```

### 5. VSCode Settings
Add to `.vscode/settings.json`:
```json
{
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.next/**": true,
    "**/dist/**": true,
    "**/build/**": true,
    "**/logs/**": true,
    "**/backup-before-cleanup/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true,
    "**/build": true
  }
}
```

## Long-term Solutions

1. **Use WSL2**: Consider moving development to WSL2 for better file system performance
2. **Reduce Dependencies**: Audit and remove unused packages
3. **Use Turbopack**: Enable Turbopack in Next.js for faster builds
4. **Optimize Imports**: Use dynamic imports for heavy libraries

## Monitoring Performance
Check current file watchers:
```powershell
Get-Process node | Select-Object -Property ProcessName, Id, HandleCount, WorkingSet
```

## Applied Fixes
✅ Created terminal optimization guide
✅ Identified 134 packages causing potential overhead
⏳ Next: Clean up environment variables to reduce startup overhead
