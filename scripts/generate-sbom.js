#!/usr/bin/env node

/**
 * Generate Software Bill of Materials (SBOM)
 * Creates inventory of all dependencies for supply chain security
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateSBOM() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
  );
  
  const packageLock = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package-lock.json'), 'utf8')
  );
  
  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'SYNTHEX',
          name: 'sbom-generator',
          version: '1.0.0'
        }
      ],
      component: {
        type: 'application',
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        licenses: [
          {
            license: {
              id: packageJson.license || 'MIT'
            }
          }
        ]
      }
    },
    components: [],
    dependencies: []
  };
  
  // Process dependencies
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const processedDeps = [];
  
  for (const [name, version] of Object.entries(deps)) {
    const cleanVersion = version.replace(/[\^~><=]/, '');
    const component = {
      type: 'library',
      bom_ref: `pkg:npm/${name}@${cleanVersion}`,
      name,
      version: cleanVersion,
      purl: `pkg:npm/${name}@${cleanVersion}`,
      scope: 'required',
      hashes: []
    };
    
    // Add package info from lock file if available
    if (packageLock.packages && packageLock.packages[`node_modules/${name}`]) {
      const lockInfo = packageLock.packages[`node_modules/${name}`];
      if (lockInfo.integrity) {
        component.hashes.push({
          alg: 'SHA-512',
          content: lockInfo.integrity.replace('sha512-', '')
        });
      }
      if (lockInfo.resolved) {
        component.externalReferences = [
          {
            type: 'distribution',
            url: lockInfo.resolved
          }
        ];
      }
    }
    
    sbom.components.push(component);
    processedDeps.push(name);
  }
  
  // Add dependency relationships
  sbom.dependencies.push({
    ref: `pkg:npm/${packageJson.name}@${packageJson.version}`,
    dependsOn: processedDeps.map(name => {
      const version = deps[name].replace(/[\^~><=]/, '');
      return `pkg:npm/${name}@${version}`;
    })
  });
  
  // Add security information
  sbom.vulnerabilities = [];
  
  // Write SBOM
  const outputDir = path.join(process.cwd(), 'ship-audit', 'artifacts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'sbom.json');
  fs.writeFileSync(outputPath, JSON.stringify(sbom, null, 2));
  
  // Generate summary
  const summary = {
    generated: new Date().toISOString(),
    application: {
      name: packageJson.name,
      version: packageJson.version
    },
    statistics: {
      totalDependencies: sbom.components.length,
      directDependencies: Object.keys(packageJson.dependencies || {}).length,
      devDependencies: Object.keys(packageJson.devDependencies || {}).length
    },
    topDependencies: sbom.components
      .slice(0, 10)
      .map(c => ({ name: c.name, version: c.version }))
  };
  
  const summaryPath = path.join(outputDir, 'sbom-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  
  console.log(`✅ SBOM generated successfully`);
  console.log(`   Total dependencies: ${sbom.components.length}`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Summary: ${summaryPath}`);
  
  return sbom;
}

// Generate SBOM
try {
  generateSBOM();
} catch (error) {
  console.error('❌ Failed to generate SBOM:', error.message);
  process.exit(1);
}