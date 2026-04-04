/**
 * Fix globals.css: Replace amber color references with candy orange equivalents
 */
const fs = require('fs');
const filePath = 'D:\\Synthex\\app\\globals.css';

let css = fs.readFileSync(filePath, 'utf8');
let count = 0;

// Replace amber color values with candy orange equivalents
const replacements = [
  // Old amber HSL/RGB values → candy orange
  ['245, 158, 11', '255, 107, 53'], // amber-500 rgb → candy orange
  ['245 158 11', '255 107 53'], // amber-500 space-sep
  ['217 119 6', '255 107 53'], // amber-600 → candy orange
  ['180 83 9', '234 88 12'], // amber-700 → orange-700
  ['146 64 14', '194 65 12'], // amber-800 → orange-800
  ['#f59e0b', '#FF6B35'], // amber-500 hex
  ['#d97706', '#ea580c'], // amber-600 hex
  ['#b45309', '#c2410c'], // amber-700 hex
];

for (const [from, to] of replacements) {
  const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = css.match(regex);
  if (matches) {
    count += matches.length;
    css = css.replace(regex, to);
  }
}

fs.writeFileSync(filePath, css, 'utf8');
console.log(
  `globals.css: ${count} amber color values replaced with candy orange`
);
