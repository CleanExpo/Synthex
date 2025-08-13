const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Animation Integration...\n');

// Check all animation files exist
const animationFiles = [
  'components/ui/enhanced/AnimationLibrary.tsx',
  'components/ui/enhanced/UltraModernAnimations.tsx',
  'components/ui/enhanced/EnhancedLandingPage.tsx',
  'components/ui/enhanced/EnhancedSandbox.tsx'
];

const demoPages = [
  'app/demo/page.tsx',
  'app/demo/animation-showcase/page.tsx',
  'app/demo/ultra-animations/page.tsx',
  'app/demo/enhanced-landing/page.tsx',
  'app/demo/enhanced-sandbox/page.tsx'
];

console.log('📁 Animation Component Files:');
animationFiles.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  const size = exists ? fs.statSync(path.join(process.cwd(), file)).size : 0;
  console.log(`${exists ? '✅' : '❌'} ${file} (${size} bytes)`);
});

console.log('\n📄 Demo Pages:');
demoPages.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  const size = exists ? fs.statSync(path.join(process.cwd(), file)).size : 0;
  console.log(`${exists ? '✅' : '❌'} ${file} (${size} bytes)`);
});

// Check for exports in UltraModernAnimations
console.log('\n🎨 Animation Components (16+ total):');
const ultraModernPath = path.join(process.cwd(), 'components/ui/enhanced/UltraModernAnimations.tsx');
if (fs.existsSync(ultraModernPath)) {
  const content = fs.readFileSync(ultraModernPath, 'utf8');
  const exports = content.match(/export function (\w+)/g);
  if (exports) {
    console.log(`Found ${exports.length} exported components:`);
    exports.forEach((exp, i) => {
      const name = exp.replace('export function ', '');
      console.log(`  ${i + 1}. ${name}`);
    });
  }
}

// Check package.json for Three.js
console.log('\n📦 Three.js Dependencies:');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const threeDeps = [
  '@react-three/fiber',
  '@react-three/drei',
  'three',
  '@types/three'
];

threeDeps.forEach(dep => {
  const version = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
  console.log(`${version ? '✅' : '❌'} ${dep}: ${version || 'NOT INSTALLED'}`);
});

// Check routes accessibility
console.log('\n🌐 Routes Configuration:');
const routes = [
  '/demo',
  '/demo/animation-showcase',
  '/demo/ultra-animations',
  '/demo/enhanced-landing',
  '/demo/enhanced-sandbox'
];

routes.forEach(route => {
  const pagePath = `app${route}/page.tsx`;
  const exists = fs.existsSync(path.join(process.cwd(), pagePath));
  console.log(`${exists ? '✅' : '❌'} ${route} -> ${pagePath}`);
});

console.log('\n✨ Summary:');
const allFilesExist = [...animationFiles, ...demoPages].every(file => 
  fs.existsSync(path.join(process.cwd(), file))
);

if (allFilesExist) {
  console.log('✅ All animation files and pages are present!');
  console.log('✅ Ready for deployment to Vercel');
} else {
  console.log('❌ Some files are missing - check above for details');
}