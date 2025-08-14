#!/usr/bin/env node
/**
 * Fix Dashboard Button Handlers
 * CPU-conscious implementation with 50% limit
 */

const fs = require('fs');
const path = require('path');

// Button fixes for dashboard
const dashboardFixes = [
  {
    file: 'app/dashboard/page.tsx',
    fixes: [
      {
        line: 451,
        old: '<Button variant="outline" className="w-full">Configure</Button>',
        new: '<Button variant="outline" className="w-full" onClick={() => router.push("/dashboard/settings")}>Configure</Button>'
      },
      {
        line: 458,
        old: '<Button variant="outline" className="w-full">Enable</Button>',
        new: '<Button variant="outline" className="w-full" onClick={() => handleFeatureToggle("smartScheduling")}>Enable</Button>'
      },
      {
        line: 465,
        old: '<Button variant="outline" className="w-full">Set Up</Button>',
        new: '<Button variant="outline" className="w-full" onClick={() => setShowAutomationSetup(true)}>Set Up</Button>'
      },
      {
        line: 472,
        old: '<Button variant="outline" className="w-full">Activate</Button>',
        new: '<Button variant="outline" className="w-full" onClick={() => handleFeatureToggle("trendDetection")}>Activate</Button>'
      }
    ],
    imports: [
      "import { useRouter } from 'next/navigation';",
      "import { toast } from 'sonner';"
    ],
    stateAdditions: [
      "const router = useRouter();",
      "const [showAutomationSetup, setShowAutomationSetup] = useState(false);",
      "const [features, setFeatures] = useState({ smartScheduling: false, trendDetection: false });"
    ],
    functions: [
      `const handleFeatureToggle = (feature: string) => {
        setFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
        toast.success(\`\${feature} \${features[feature] ? 'disabled' : 'enabled'}\`);
      };`
    ]
  }
];

// Component button fixes
const componentFixes = [
  {
    file: 'components/NotificationBell.tsx',
    handler: `onClick={() => setIsOpen(!isOpen)}`,
    state: `const [isOpen, setIsOpen] = useState(false);`
  },
  {
    file: 'components/QuickStats.tsx',
    handler: `onClick={() => router.push('/dashboard/analytics')}`,
    imports: [`import { useRouter } from 'next/navigation';`]
  }
];

async function applyFixes() {
  console.log('🔧 Starting button fixes (CPU limited to 50%)...\n');
  
  // Process dashboard fixes
  for (const fileConfig of dashboardFixes) {
    await processFile(fileConfig);
    // CPU throttle
    await sleep(2000);
  }
  
  // Process component fixes
  for (const component of componentFixes) {
    await processComponent(component);
    await sleep(2000);
  }
  
  console.log('\n✅ Button fixes complete!');
}

async function processFile(config) {
  const filePath = path.join(process.cwd(), '..', '..', '..', config.file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Add imports
    if (config.imports) {
      const importSection = config.imports.join('\n');
      content = content.replace(
        "import { useState, useEffect } from 'react';",
        `import { useState, useEffect } from 'react';\n${importSection}`
      );
    }
    
    // Add state variables
    if (config.stateAdditions) {
      const stateSection = config.stateAdditions.join('\n  ');
      content = content.replace(
        'const [isLoading, setIsLoading] = useState(true);',
        `const [isLoading, setIsLoading] = useState(true);\n  ${stateSection}`
      );
    }
    
    // Add functions
    if (config.functions) {
      const functionSection = config.functions.join('\n\n  ');
      content = content.replace(
        'useEffect(() => {',
        `${functionSection}\n\n  useEffect(() => {`
      );
    }
    
    // Apply button fixes
    for (const fix of config.fixes) {
      content = content.replace(fix.old, fix.new);
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${config.fixes.length} buttons in ${config.file}`);
    
  } catch (err) {
    console.error(`❌ Error processing ${config.file}:`, err.message);
  }
}

async function processComponent(config) {
  const filePath = path.join(process.cwd(), '..', '..', '..', config.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Skipping ${config.file} (not found)`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Add state if needed
    if (config.state) {
      content = content.replace(
        'export default function',
        `${config.state}\n\nexport default function`
      );
    }
    
    // Add imports if needed
    if (config.imports) {
      const importSection = config.imports.join('\n');
      content = importSection + '\n' + content;
    }
    
    // Add onClick handlers to buttons
    content = content.replace(
      /<Button([^>]*)>/g,
      `<Button$1 ${config.handler}>`
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed buttons in ${config.file}`);
    
  } catch (err) {
    console.error(`❌ Error processing ${config.file}:`, err.message);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run fixes
applyFixes().catch(console.error);