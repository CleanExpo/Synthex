/**
 * SYNTHEX Candy Color Migration Script
 * Replaces all amber-* Tailwind references with orange-* equivalents
 * to eliminate the brown tint and align with the candy orange palette.
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'D:\\Synthex';
const DIRS_TO_SCAN = ['components', 'app', 'hooks', 'lib', 'styles', 'src'];
const EXTENSIONS = ['.tsx', '.ts', '.css', '.jsx', '.js'];
// Files to skip (config files we'll handle manually)
const SKIP_FILES = [
  'candy-color-migration.js',
  'tailwind.config.cjs',
  'globals.css',
];

// Replacement map: amber → orange (Tailwind classes)
const REPLACEMENTS = [
  // Shade-specific replacements (most specific first)
  ['amber-950', 'orange-950'],
  ['amber-900', 'orange-900'],
  ['amber-800', 'orange-800'],
  ['amber-700', 'orange-700'],
  ['amber-600', 'orange-600'],
  ['amber-500', 'orange-500'],
  ['amber-400', 'orange-400'],
  ['amber-300', 'orange-300'],
  ['amber-200', 'orange-200'],
  ['amber-100', 'orange-100'],
  ['amber-50', 'orange-50'],
];
let totalFiles = 0;
let totalReplacements = 0;
const changedFiles = [];

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .next, .git, etc.
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      walkDir(fullPath);
    } else if (
      entry.isFile() &&
      EXTENSIONS.includes(path.extname(entry.name))
    ) {
      if (SKIP_FILES.includes(entry.name)) continue;
      processFile(fullPath);
    }
  }
}
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  let fileReplacements = 0;

  for (const [from, to] of REPLACEMENTS) {
    // Use global regex to replace all instances
    const regex = new RegExp(escapeRegex(from), 'g');
    const matches = content.match(regex);
    if (matches) {
      fileReplacements += matches.length;
      content = content.replace(regex, to);
    }
  }

  if (fileReplacements > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    totalReplacements += fileReplacements;
    const rel = path.relative(ROOT, filePath);
    changedFiles.push({ file: rel, count: fileReplacements });
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Run the migration
console.log('=== SYNTHEX Candy Color Migration ===');
console.log('Replacing amber-* → orange-* across codebase...\n');

for (const dir of DIRS_TO_SCAN) {
  const fullDir = path.join(ROOT, dir);
  walkDir(fullDir);
}

console.log(`\n✅ Migration complete!`);
console.log(`   Files changed: ${totalFiles}`);
console.log(`   Total replacements: ${totalReplacements}`);
console.log(`\nTop changed files:`);
changedFiles
  .sort((a, b) => b.count - a.count)
  .slice(0, 20)
  .forEach(f =>
    console.log(`   ${f.count.toString().padStart(4)} │ ${f.file}`)
  );
