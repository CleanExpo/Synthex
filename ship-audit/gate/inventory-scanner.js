#!/usr/bin/env node
/**
 * No-BS Ship Gate v2 - Static Inventory Scanner
 * Discovers all routes, APIs, env vars, and controls
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

class InventoryScanner {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.routes = [];
    this.apiCalls = [];
    this.envUsage = [];
    this.controls = [];
  }

  async scan() {
    console.log('🔍 Starting static inventory scan...');
    
    await this.scanRoutes();
    await this.scanAPICalls();
    await this.scanEnvUsage();
    await this.scanControls();
    
    this.writeResults();
    console.log('✅ Inventory scan complete');
  }

  async scanRoutes() {
    console.log('📍 Scanning routes...');
    
    // Next.js App Router
    const appFiles = await glob('app/**/page.{tsx,ts,jsx,js}', { cwd: this.rootDir });
    const apiFiles = await glob('app/api/**/route.{ts,js}', { cwd: this.rootDir });
    
    appFiles.forEach(file => {
      const routePath = '/' + file
        .replace(/^app\//, '')
        .replace(/\/page\.(tsx|ts|jsx|js)$/, '')
        .replace(/\/?\(.*?\)\/?/g, '/') // Remove route groups
        .replace(/\[([^\]]+)\]/g, ':$1'); // Convert dynamic segments
      
      this.routes.push({
        path: routePath === '/' ? '/' : routePath.replace(/\/$/, ''),
        file,
        type: 'page'
      });
    });
    
    apiFiles.forEach(file => {
      const routePath = '/' + file
        .replace(/\/route\.(ts|js)$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1');
      
      const content = fs.readFileSync(path.join(this.rootDir, file), 'utf-8');
      const methods = this.extractAPIMethods(content);
      
      this.routes.push({
        path: routePath,
        file,
        type: 'api',
        methods
      });
    });
    
    console.log(`  Found ${this.routes.length} routes`);
  }

  extractAPIMethods(content) {
    const methods = [];
    const methodPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/g;
    let match;
    
    while ((match = methodPattern.exec(content)) !== null) {
      methods.push(match[1]);
    }
    
    return methods;
  }

  async scanAPICalls() {
    console.log('🔌 Scanning API calls...');
    
    const sourceFiles = await glob('**/*.{tsx,ts,jsx,js}', {
      cwd: this.rootDir,
      ignore: ['node_modules/**', '.next/**', 'out/**', 'ship-audit/**', 'build/**', '.vercel/**']
    });
    
    // Limit to first 100 files to avoid timeout
    const filesToScan = sourceFiles.slice(0, 100);
    
    for (const file of filesToScan) {
      try {
        const content = fs.readFileSync(path.join(this.rootDir, file), 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Fetch calls
          const fetchMatch = line.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/);
          if (fetchMatch) {
            this.apiCalls.push({
              endpoint: fetchMatch[1],
              method: this.extractMethod(line) || 'GET',
              file,
              line: index + 1
            });
          }
          
          // Axios calls
          const axiosMatch = line.match(/axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);
          if (axiosMatch) {
            this.apiCalls.push({
              endpoint: axiosMatch[2],
              method: axiosMatch[1].toUpperCase(),
              file,
              line: index + 1
            });
          }
        });
      } catch (err) {
        // Skip files that can't be read
      }
    }
    
    console.log(`  Found ${this.apiCalls.length} API calls in first 100 files`);
  }

  extractMethod(line) {
    const methodMatch = line.match(/method:\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`]/);
    return methodMatch ? methodMatch[1] : null;
  }

  async scanEnvUsage() {
    console.log('🔐 Scanning environment variable usage...');
    
    const sourceFiles = await glob('**/*.{tsx,ts,jsx,js,mjs}', {
      cwd: this.rootDir,
      ignore: ['node_modules/**', '.next/**', 'out/**', 'ship-audit/**', 'build/**', '.vercel/**']
    });
    
    const envVars = new Set();
    const filesToScan = sourceFiles.slice(0, 50); // Limit scan
    
    for (const file of filesToScan) {
      try {
        const content = fs.readFileSync(path.join(this.rootDir, file), 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          const envMatch = line.match(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
          if (envMatch) {
            envMatch.forEach(match => {
              const varName = match.replace('process.env.', '');
              this.envUsage.push({
                variable: varName,
                file,
                line: index + 1,
                isPublic: varName.startsWith('NEXT_PUBLIC_')
              });
              envVars.add(varName);
            });
          }
        });
      } catch (err) {
        // Skip files that can't be read
      }
    }
    
    console.log(`  Found ${envVars.size} unique env variables`);
  }

  async scanControls() {
    console.log('🎮 Scanning interactive controls...');
    
    const componentFiles = await glob('**/*.{tsx,jsx}', {
      cwd: this.rootDir,
      ignore: ['node_modules/**', '.next/**', 'out/**', 'ship-audit/**', 'build/**', '.vercel/**']
    });
    
    const filesToScan = componentFiles.slice(0, 50); // Limit scan
    
    for (const file of filesToScan) {
      try {
        const content = fs.readFileSync(path.join(this.rootDir, file), 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Buttons
          if (line.includes('<button') || line.includes('<Button')) {
            const onClickMatch = line.match(/onClick/);
            this.controls.push({
              type: 'button',
              file,
              line: index + 1,
              onClick: !!onClickMatch
            });
          }
          
          // Links
          if (line.includes('<a ') || line.includes('<Link')) {
            const hrefMatch = line.match(/href=["']([^"']+)["']/);
            this.controls.push({
              type: 'link',
              file,
              line: index + 1,
              href: hrefMatch ? hrefMatch[1] : undefined
            });
          }
          
          // Elements with onClick
          if (line.includes('onClick=') && !line.includes('<button') && !line.includes('<Button')) {
            this.controls.push({
              type: 'clickable',
              file,
              line: index + 1,
              onClick: true
            });
          }
        });
      } catch (err) {
        // Skip files that can't be read
      }
    }
    
    console.log(`  Found ${this.controls.length} interactive controls`);
  }

  writeResults() {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        routes: this.routes.length,
        apiCalls: this.apiCalls.length,
        envVars: [...new Set(this.envUsage.map(e => e.variable))].length,
        controls: this.controls.length
      },
      routes: this.routes,
      apiCalls: this.apiCalls,
      envUsage: this.envUsage,
      controls: this.controls
    };
    
    fs.writeFileSync(
      path.join(this.rootDir, 'ship-audit/gate/inventory.json'),
      JSON.stringify(results, null, 2)
    );
    
    // Write individual files for easier processing
    fs.writeFileSync(
      path.join(this.rootDir, 'ship-audit/gate/routes.json'),
      JSON.stringify(this.routes, null, 2)
    );
    
    fs.writeFileSync(
      path.join(this.rootDir, 'ship-audit/gate/apis.json'),
      JSON.stringify(this.apiCalls, null, 2)
    );
    
    fs.writeFileSync(
      path.join(this.rootDir, 'ship-audit/gate/env-usage.json'),
      JSON.stringify(this.envUsage, null, 2)
    );
    
    fs.writeFileSync(
      path.join(this.rootDir, 'ship-audit/gate/controls.json'),
      JSON.stringify(this.controls, null, 2)
    );
  }
}

// Run the scanner
const scanner = new InventoryScanner();
scanner.scan().catch(console.error);