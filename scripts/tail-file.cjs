const fs = require('fs');
const file = process.argv[2];
const n = parseInt(process.argv[3], 10) || 20;
const lines = fs.readFileSync(file, 'utf8').split('\n');
console.log('TOTAL LINES: ' + lines.length);
for (let i = Math.max(0, lines.length - n); i < lines.length; i++) {
  console.log(i + 1 + ': ' + lines[i]);
}
